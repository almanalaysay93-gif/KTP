use crate::{
    clinical_core::{Write, lab_flag},
    clinical_labs,
    error::ApiError,
    validation as v,
};
use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;

fn nullable_date(input: &Value, key: &str, past: bool) -> Result<(), ApiError> {
    if input.get(key).is_some_and(|value| !value.is_null()) {
        v::date(input, key, past)?;
    }
    Ok(())
}

fn merged(input: &Value, before: &Value) -> Value {
    let mut after = before.clone();
    for key in [
        "label",
        "dueDate",
        "serviceDate",
        "claimDeadline",
        "claimFiledDate",
        "note",
    ] {
        if let Some(value) = input.get(key) {
            after[key] = value.clone();
        }
    }
    if input.get("note").is_some() && after["note"].as_str() == Some("") {
        after["note"] = Value::Null;
    }
    after
}

async fn labs(ctx: &mut Write, id: i32) -> Result<Vec<Value>, ApiError> {
    let rows:Vec<(SqlJson<Value>,)>=sqlx::query_as(r#"SELECT to_jsonb(r) FROM ktp."labResults" r WHERE "serviceRecordId"=$1 ORDER BY "labTestId",id"#)
        .bind(id).fetch_all(&mut *ctx.tx).await?;
    Ok(rows.into_iter().map(|row| row.0.0).collect())
}

fn snapshot(mut fields: Value, labs: &[Value]) -> Value {
    fields["labs"] = json!(
        labs.iter()
            .map(|row| json!({"labTestId":row["labTestId"],"value":row["value"]}))
            .collect::<Vec<_>>()
    );
    fields
}

pub async fn update(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    v::allowed(
        input,
        &[
            "patientId",
            "id",
            "reason",
            "label",
            "dueDate",
            "serviceDate",
            "claimDeadline",
            "claimFiledDate",
            "note",
            "results",
        ],
    )?;
    let id = v::id(input, "id")?;
    let reason = if input.get("reason").is_some() {
        v::string(input, "reason", 1, 500)?
    } else {
        "Correction".to_owned()
    };
    let mut normalized = input.clone();
    if input.get("label").is_some() {
        normalized["label"] = json!(v::string(input, "label", 1, 200)?);
    }
    v::opt_date(input, "dueDate", false)?;
    v::opt_date(input, "serviceDate", true)?;
    nullable_date(input, "claimDeadline", false)?;
    nullable_date(input, "claimFiledDate", true)?;
    if input.get("note").is_some_and(|value| !value.is_null()) {
        normalized["note"] = json!(v::string(input, "note", 0, 4000)?);
    }
    let results = v::results(input, "results", false, true)?;
    let current:Option<(SqlJson<Value>,)>=sqlx::query_as(r#"SELECT to_jsonb(s) FROM ktp."serviceRecords" s WHERE id=$1 AND "patientId"=$2 FOR UPDATE"#)
        .bind(id).bind(ctx.patient_id).fetch_optional(&mut *ctx.tx).await?;
    let current = current
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Service not found"))?
        .0
        .0;
    if current["status"] == "Superseded" {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Superseded services cannot be edited",
        ));
    }
    if current["status"] == "Planned"
        && (input.get("serviceDate").is_some()
            || input["claimFiledDate"].is_string()
            || !results.is_empty())
    {
        return Err(v::bad("Record a result before editing result details"));
    }
    if !results.is_empty()
        && !["Laboratory", "Tacro"].contains(&current["serviceType"].as_str().unwrap_or_default())
    {
        return Err(v::bad(
            "Lab values require a laboratory or tacrolimus service",
        ));
    }
    let before = json!({"label":current["label"],"dueDate":current["dueDate"],"serviceDate":current["serviceDate"],
        "claimDeadline":current["claimDeadline"],"claimFiledDate":current["claimFiledDate"],"note":current["note"]});
    let after = merged(&normalized, &before);
    if let Some(date) = after["serviceDate"].as_str() {
        if after["claimDeadline"]
            .as_str()
            .is_some_and(|deadline| deadline < date)
        {
            return Err(v::bad("Claim deadline cannot precede service date"));
        }
        if after["claimFiledDate"]
            .as_str()
            .is_some_and(|filed| filed < date)
        {
            return Err(v::bad("Claim filing cannot precede service date"));
        }
    }
    let labs_before = labs(ctx, id).await?;
    sqlx::query(r#"UPDATE ktp."serviceRecords" SET label=$1,"dueDate"=$2::date,"serviceDate"=$3::date,
        "claimDeadline"=$4::date,"claimFiledDate"=$5::date,note=$6,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$7 AND "patientId"=$8"#)
        .bind(after["label"].as_str()).bind(after["dueDate"].as_str()).bind(after["serviceDate"].as_str())
        .bind(after["claimDeadline"].as_str()).bind(after["claimFiledDate"].as_str()).bind(after["note"].as_str())
        .bind(id).bind(ctx.patient_id).execute(&mut *ctx.tx).await?;
    for result in results {
        let saved = labs_before
            .iter()
            .find(|row| row["labTestId"].as_i64() == Some(i64::from(result.lab_test_id)));
        if result.value.is_empty() {
            if saved.is_some() {
                sqlx::query(
                    r#"DELETE FROM ktp."labResults" WHERE "serviceRecordId"=$1 AND "labTestId"=$2"#,
                )
                .bind(id)
                .bind(result.lab_test_id)
                .execute(&mut *ctx.tx)
                .await?;
            }
        } else if let Some(saved) = saved {
            sqlx::query(r#"UPDATE ktp."labResults" SET value=$1,flag=$2 WHERE "serviceRecordId"=$3 AND "labTestId"=$4"#)
                .bind(&result.value).bind(lab_flag(&result.value,&saved["lowSnapshot"],&saved["highSnapshot"]))
                .bind(id).bind(result.lab_test_id).execute(&mut *ctx.tx).await?;
        } else {
            let catalog = clinical_labs::test(ctx, result.lab_test_id).await?;
            clinical_labs::insert(ctx, id, result.lab_test_id, &result.value, &catalog).await?;
        }
    }
    let labs_after = labs(ctx, id).await?;
    let before = snapshot(before, &labs_before);
    let after = snapshot(after, &labs_after);
    if before == after {
        return Err(v::bad("No change to save"));
    }
    sqlx::query(r#"INSERT INTO ktp."recordRevisions" ("entityType","entityId","before","after",reason,"userId") VALUES ('serviceRecord',$1,$2,$3,$4,$5)"#)
        .bind(id).bind(before.to_string()).bind(after.to_string()).bind(&reason).bind(ctx.actor).execute(&mut *ctx.tx).await?;
    ctx.audit("clinical.service.update", id, json!({"reason":reason}))
        .await?;
    Ok(json!({"id":id}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn omissions_keep_saved_values_and_explicit_null_or_blank_clear() {
        let before = json!({"label":"Saved","dueDate":"2026-01-01","serviceDate":"2026-01-02","claimDeadline":"2026-02-01","claimFiledDate":null,"note":"Saved note"});
        assert_eq!(merged(&json!({}), &before), before);
        assert_eq!(merged(&json!({}), &json!({"note":""}))["note"], "");
        let after = merged(&json!({"claimDeadline":null,"note":""}), &before);
        assert_eq!(after["claimDeadline"], Value::Null);
        assert_eq!(after["note"], Value::Null);
        assert_eq!(after["serviceDate"], before["serviceDate"]);
    }
    #[test]
    fn revision_labs_exclude_snapshots_flags_and_storage_ids() {
        let result = snapshot(
            json!({"note":null}),
            &[json!({"id":2,"labTestId":3,"value":"4","flag":"High","lowSnapshot":"1"})],
        );
        assert_eq!(
            result,
            json!({"note":null,"labs":[{"labTestId":3,"value":"4"}]})
        );
        assert!(nullable_date(&json!({"claimDeadline":null}), "claimDeadline", false).is_ok());
        assert!(nullable_date(&json!({"claimDeadline":""}), "claimDeadline", false).is_err());
    }
}
