use crate::{AppState, clinical_core::Write, error::ApiError, validation as v};
use axum::{Json, extract::State};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder, types::Json as SqlJson};
use std::collections::{HashMap, HashSet};

fn validate(input: &Value) -> Result<&Vec<Value>, ApiError> {
    v::allowed(input, &["patientId", "entries"])?;
    v::id(input, "patientId")?;
    let entries = input["entries"]
        .as_array()
        .ok_or(v::bad("Expected entries"))?;
    if !(1..=4).contains(&entries.len()) {
        return Err(v::bad("Expected one to four entries"));
    }
    let mut types = HashSet::new();
    for entry in entries {
        v::allowed(
            entry,
            &[
                "serviceType",
                "doneDate",
                "nextDue",
                "claimDue",
                "claimFiled",
            ],
        )?;
        if !types.insert(v::choice(entry, "serviceType", v::SERVICE_TYPES)?) {
            return Err(v::bad("Each service type may occur once"));
        }
        v::opt_date(entry, "doneDate", true)?;
        v::opt_date(entry, "nextDue", false)?;
        v::opt_date(entry, "claimFiled", true)?;
        if entry.get("claimDue").is_some_and(|date| !date.is_null()) {
            v::date(entry, "claimDue", false)?;
        }
    }
    Ok(entries)
}

fn label(service_type: &str) -> &'static str {
    match service_type {
        "Meds" => "Medicines claim",
        "Laboratory" => "Laboratory",
        "Tacro" => "Tacrolimus test",
        _ => "X-ray and ultrasound",
    }
}

// SQL DATE values in to_jsonb are canonical date strings. Missing dates sort
// like JavaScript String(null), after dates, preserving the original id order.
fn day<'a>(row: &'a Value, key: &str) -> Option<&'a str> {
    row[key].as_str().and_then(|text| text.get(..10))
}
fn ordered(records: &[Value], status: &str, key: &str) -> Vec<usize> {
    let mut indices: Vec<_> = records
        .iter()
        .enumerate()
        .filter(|(_, row)| row["status"] == status)
        .map(|(i, _)| i)
        .collect();
    indices.sort_by(|a, b| {
        day(&records[*a], key)
            .unwrap_or("null")
            .cmp(day(&records[*b], key).unwrap_or("null"))
    });
    indices
}
fn open_claim(records: &[Value], done: &[usize]) -> Option<usize> {
    let open: Vec<_> = done
        .iter()
        .copied()
        .filter(|i| day(&records[*i], "claimFiledDate").is_none())
        .collect();
    let mut deadlines: Vec<_> = open
        .iter()
        .copied()
        .filter(|i| day(&records[*i], "claimDeadline").is_some())
        .collect();
    deadlines.sort_by(|a, b| {
        day(&records[*a], "claimDeadline").cmp(&day(&records[*b], "claimDeadline"))
    });
    deadlines.first().copied().or_else(|| open.last().copied())
}

async fn change(ctx: &mut Write, record: &mut Value, fields: Value) -> Result<(), ApiError> {
    let mut before = json!({});
    let mut update: QueryBuilder<Postgres> =
        QueryBuilder::new("UPDATE ktp.\"serviceRecords\" SET ");
    for (index, (key, value)) in fields.as_object().unwrap().iter().enumerate() {
        before[key] = record[key].clone();
        if index > 0 {
            update.push(", ");
        }
        // Keys originate exclusively from fixed field objects below.
        let column = match key.as_str() {
            "status" => "status",
            "serviceDate" => "\"serviceDate\"",
            "dueDate" => "\"dueDate\"",
            "claimDeadline" => "\"claimDeadline\"",
            "claimFiledDate" => "\"claimFiledDate\"",
            _ => unreachable!(),
        };
        update
            .push(column)
            .push(" = ")
            .push_bind(value.as_str().map(str::to_owned));
        if key != "status" {
            update.push("::date");
        }
    }
    let id = record["id"].as_i64().unwrap() as i32;
    update
        .push(", \"updatedAt\" = CURRENT_TIMESTAMP WHERE id = ")
        .push_bind(id)
        .push(" AND \"patientId\" = ")
        .push_bind(ctx.patient_id);
    update.build().execute(&mut *ctx.tx).await?;
    sqlx::query(r#"INSERT INTO ktp."recordRevisions" ("entityType","entityId","before","after",reason,"userId") VALUES ('serviceRecord',$1,$2,$3,'Z Benefit record',$4)"#)
        .bind(id).bind(before.to_string()).bind(fields.to_string()).bind(ctx.actor)
        .execute(&mut *ctx.tx).await?;
    for (key, value) in fields.as_object().unwrap() {
        record[key] = value.clone();
    }
    Ok(())
}

async fn insert(
    ctx: &mut Write,
    records: &mut Vec<Value>,
    service_type: &str,
    status: &str,
    due: &str,
    date: Option<&str>,
) -> Result<usize, ApiError> {
    let (SqlJson(row),): (SqlJson<Value>,) = sqlx::query_as(
        r#"INSERT INTO ktp."serviceRecords" AS s ("patientId","serviceType",label,status,"dueDate","serviceDate") VALUES ($1,$2,$3,$4,$5::date,$6::date) RETURNING to_jsonb(s)"#)
        .bind(ctx.patient_id).bind(service_type).bind(label(service_type)).bind(status)
        .bind(due).bind(date).fetch_one(&mut *ctx.tx).await?;
    records.push(row);
    Ok(records.len() - 1)
}

pub async fn save(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    let entries = validate(input)?;
    if ctx.patient["patientType"] != "Recipient" {
        return Err(v::bad("The Z Benefit record is for a recipient"));
    }
    let mut changes = 0;
    for entry in entries {
        let service_type = entry["serviceType"].as_str().unwrap();
        let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(
            r#"SELECT to_jsonb(s) FROM ktp."serviceRecords" s WHERE "patientId"=$1 AND "serviceType"=$2 AND status<>'Superseded' ORDER BY id"#)
            .bind(ctx.patient_id).bind(service_type).fetch_all(&mut *ctx.tx).await?;
        let mut records: Vec<_> = rows.into_iter().map(|r| r.0.0).collect();
        let done = ordered(&records, "Done", "serviceDate");
        let mut planned = ordered(&records, "Planned", "dueDate");
        let mut claim_record = open_claim(&records, &done);
        if let Some(date) = entry["doneDate"].as_str() {
            let target = if service_type == "Meds" {
                done.first()
            } else {
                done.last()
            }
            .copied();
            let newer = target.is_some_and(|i| {
                service_type != "Meds"
                    && day(&records[i], "serviceDate").is_some_and(|previous| date > previous)
            });
            if let Some(i) = target.filter(|_| !newer) {
                if day(&records[i], "claimFiledDate").is_some_and(|filed| filed < date) {
                    return Err(v::bad(
                        "The date cannot be after the date that the claim was filed.",
                    ));
                }
                if day(&records[i], "serviceDate") != Some(date) {
                    change(ctx, &mut records[i], json!({"serviceDate": date})).await?;
                    changes += 1;
                }
                if day(&records[i], "claimFiledDate").is_none() {
                    claim_record = Some(i);
                }
            } else {
                claim_record = Some(if !planned.is_empty() {
                    let i = planned.remove(0);
                    change(
                        ctx,
                        &mut records[i],
                        json!({"status":"Done", "serviceDate":date}),
                    )
                    .await?;
                    i
                } else {
                    insert(ctx, &mut records, service_type, "Done", date, Some(date)).await?
                });
                changes += 1;
            }
        }
        if entry.get("claimDue").is_some() || entry.get("claimFiled").is_some() {
            let i = claim_record.ok_or(v::bad(
                "Enter the date of the service before the claim dates.",
            ))?;
            let service_date = day(&records[i], "serviceDate").map(str::to_owned);
            if let Some(due) = entry.get("claimDue") {
                if due
                    .as_str()
                    .zip(service_date.as_deref())
                    .is_some_and(|(due, date)| due < date)
                {
                    return Err(v::bad(
                        "The claim due date cannot be before the service date.",
                    ));
                }
                change(ctx, &mut records[i], json!({"claimDeadline":due})).await?;
                changes += 1;
            }
            if let Some(filed) = entry["claimFiled"].as_str() {
                if service_date.as_deref().is_some_and(|date| filed < date) {
                    return Err(v::bad(
                        "The claim filed date cannot be before the service date.",
                    ));
                }
                change(ctx, &mut records[i], json!({"claimFiledDate":filed})).await?;
                changes += 1;
            }
        }
        if let Some(due) = entry["nextDue"].as_str() {
            if let Some(&i) = planned.first() {
                if day(&records[i], "dueDate") != Some(due) {
                    change(ctx, &mut records[i], json!({"dueDate":due})).await?;
                    changes += 1;
                }
            } else {
                insert(ctx, &mut records, service_type, "Planned", due, None).await?;
                changes += 1;
            }
        }
    }
    if changes == 0 {
        return Err(v::bad("No change to save"));
    }
    sqlx::query(r#"INSERT INTO ktp."activityLog" ("actorUserId","patientId",action,details) VALUES ($1,$2,'clinical.zbenefit.update',$3)"#)
        .bind(ctx.actor).bind(ctx.patient_id).bind(json!({"entries":entries}).to_string())
        .execute(&mut *ctx.tx).await?;
    Ok(json!({"changes":changes}))
}

fn summary(services: &[Value]) -> Value {
    let mut output = json!({});
    for service_type in v::SERVICE_TYPES {
        let records: Vec<_> = services
            .iter()
            .filter(|s| s["serviceType"] == *service_type)
            .collect();
        let done: Vec<_> = records.iter().filter(|s| s["status"] == "Done").collect();
        let dates: Vec<_> = done.iter().filter_map(|s| day(s, "serviceDate")).collect();
        output[*service_type] = json!({
            "firstDate": dates.iter().min(), "lastDate": dates.iter().max(),
            "nextDue": records.iter().filter(|s| s["status"] == "Planned").filter_map(|s| day(s,"dueDate")).min(),
            "claimDue": done.iter().filter(|s| day(s,"claimFiledDate").is_none()).filter_map(|s| day(s,"claimDeadline")).min(),
        });
    }
    output
}

pub async fn list(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let recipients: Vec<(SqlJson<Value>,)> = sqlx::query_as(r#"
        SELECT jsonb_build_object('patientId',p.id,'hrn',p.hrn,'firstName',p."firstName",'lastName',p."lastName",
            'suffix',p.suffix,'stage',p.stage,'nephrologist',n.name,'fellow',f.name,
            'nephrologistId',p."nephrologistId",'fellowId',p."fellowId")
        FROM ktp.patients p LEFT JOIN ktp.doctors n ON n.id=p."nephrologistId"
        LEFT JOIN ktp.doctors f ON f.id=p."fellowId"
        WHERE p.status='Active' AND p."patientType"='Recipient' ORDER BY p."lastName",p."firstName",p.id"#)
        .fetch_all(&mut *tx).await?;
    let services: Vec<(SqlJson<Value>,)> = sqlx::query_as(r#"
        SELECT to_jsonb(s) FROM (
            SELECT s."patientId",s."serviceType",s.status,s."dueDate",s."serviceDate",s."claimDeadline",s."claimFiledDate"
            FROM ktp."serviceRecords" s JOIN ktp.patients p ON p.id=s."patientId"
            WHERE p.status='Active' AND p."patientType"='Recipient' AND s.status<>'Superseded'
        ) s"#).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let mut grouped: HashMap<i64, Vec<Value>> = HashMap::new();
    for (SqlJson(row),) in services {
        if let Some(id) = row["patientId"].as_i64() {
            grouped.entry(id).or_default().push(row);
        }
    }
    let rows: Vec<_> = recipients
        .into_iter()
        .map(|(SqlJson(mut row),)| {
            let services = grouped
                .remove(&row["patientId"].as_i64().unwrap())
                .unwrap_or_default();
            row["services"] = summary(&services);
            row
        })
        .collect();
    Ok(Json(json!(rows)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_uses_service_extremes_and_only_unfiled_done_deadlines() {
        let rows = vec![
            json!({"serviceType":"Meds","status":"Done","serviceDate":"2026-09-02","claimDeadline":"2026-10-02"}),
            json!({"serviceType":"Meds","status":"Done","serviceDate":"2026-07-02","claimDeadline":"2026-07-30","claimFiledDate":"2026-07-15"}),
            json!({"serviceType":"Meds","status":"Planned","dueDate":"2026-11-01","claimDeadline":"2026-06-01"}),
            json!({"serviceType":"Meds","status":"Planned","dueDate":"2026-10-01"}),
            json!({"serviceType":"Tacro","status":"Done","serviceDate":null}),
        ];
        let result = summary(&rows);
        assert_eq!(
            result["Meds"],
            json!({"firstDate":"2026-07-02","lastDate":"2026-09-02","nextDue":"2026-10-01","claimDue":"2026-10-02"})
        );
        for service_type in ["Laboratory", "Tacro", "XrayUsd"] {
            assert_eq!(
                result[service_type],
                json!({"firstDate":null,"lastDate":null,"nextDue":null,"claimDue":null})
            );
        }
    }

    #[test]
    fn claim_selection_prefers_earliest_open_deadline_then_latest_unfiled() {
        let mut rows = vec![
            json!({"status":"Done","serviceDate":"2026-01-01","claimDeadline":"2026-05-01"}),
            json!({"status":"Done","serviceDate":"2026-02-01","claimDeadline":"2026-04-01"}),
            json!({"status":"Done","serviceDate":"2026-03-01","claimFiledDate":"2026-03-02","claimDeadline":"2026-03-01"}),
        ];
        let done = ordered(&rows, "Done", "serviceDate");
        assert_eq!(open_claim(&rows, &done), Some(1));
        rows[0]["claimDeadline"] = Value::Null;
        rows[1]["claimDeadline"] = Value::Null;
        assert_eq!(open_claim(&rows, &done), Some(1));
        rows[1]["claimFiledDate"] = json!("2026-02-02");
        assert_eq!(open_claim(&rows, &done), Some(0));
    }

    #[test]
    fn entries_validate_unique_types_and_real_dates_with_only_nullable_claim_due() {
        assert!(
            validate(&json!({"patientId":1,"entries":[{"serviceType":"Meds","claimDue":null}]}))
                .is_ok()
        );
        for entries in [
            json!([]),
            json!([{"serviceType":"Meds"},{"serviceType":"Meds"}]),
            json!([{"serviceType":"Meds","doneDate":"2026-02-30"}]),
            json!([{"serviceType":"Meds","doneDate":"2999-01-01"}]),
            json!([{"serviceType":"Meds","nextDue":null}]),
        ] {
            assert!(validate(&json!({"patientId":1,"entries":entries})).is_err());
        }
    }
}
