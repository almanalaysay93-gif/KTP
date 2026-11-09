use crate::{
    AppState, admin_core, auth::Admin, email_dispatch, email_templates, error::ApiError,
    validation as v,
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::{SecondsFormat, Utc};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder, types::Json as SqlJson};
use std::collections::HashMap;

const CONFIG_KEY: &str = "email_automation_config";
const SWEEP_LOCK: i64 = 0x4b54505f454d4149;

fn defaults() -> Value {
    json!({"masterEnabled":true,"dispatchTimeManila":"08:00","triggers":[
        {"key":"appointment_reminder","label":"Clinic Appointment Notice","description":"Send patient email reminder 2 days before scheduled clinic visit.","enabled":true,"leadDays":2},
        {"key":"overdue_lab","label":"Overdue Lab Workup Alert","description":"Send alert when scheduled laboratory workup due date has passed.","enabled":true,"leadDays":1},
        {"key":"weekly_digest","label":"Weekly Nephrology Digest","description":"Send weekly patient census and pending clearance digest to doctors.","enabled":true,"leadDays":7}
    ],"lastRunAt":null,"lastRunStats":null})
}
async fn config(pool: &sqlx::PgPool) -> Result<Value, ApiError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM ktp.\"appSettings\" WHERE key=$1")
            .bind(CONFIG_KEY)
            .fetch_optional(pool)
            .await?;
    Ok(row
        .and_then(|r| serde_json::from_str::<Value>(&r.0).ok())
        .filter(Value::is_object)
        .unwrap_or_else(defaults))
}
fn validate_config(input: &Value) -> Result<(), ApiError> {
    v::allowed(input, &["masterEnabled", "dispatchTimeManila", "triggers"])?;
    if !input["masterEnabled"].is_boolean() {
        return Err(v::bad("Expected masterEnabled boolean"));
    }
    let time = input["dispatchTimeManila"]
        .as_str()
        .ok_or(v::bad("Use HH:MM dispatch time"))?;
    if time.len() != 5
        || time.as_bytes()[2] != b':'
        || !time
            .bytes()
            .enumerate()
            .all(|(i, b)| i == 2 || b.is_ascii_digit())
    {
        return Err(v::bad("Use HH:MM dispatch time"));
    }
    let triggers = input["triggers"]
        .as_array()
        .ok_or(v::bad("Expected triggers"))?;
    for trigger in triggers {
        v::allowed(
            trigger,
            &["key", "label", "description", "enabled", "leadDays"],
        )?;
        v::choice(
            trigger,
            "key",
            &["appointment_reminder", "overdue_lab", "weekly_digest"],
        )?;
        if !trigger["label"].is_string()
            || !trigger["description"].is_string()
            || !trigger["enabled"].is_boolean()
            || !trigger["leadDays"]
                .as_i64()
                .is_some_and(|days| (1..=30).contains(&days))
        {
            return Err(v::bad("Invalid automation trigger"));
        }
    }
    Ok(())
}
fn query_number(
    query: &HashMap<String, String>,
    key: &str,
    default: i64,
    min: i64,
    max: i64,
) -> Result<i64, ApiError> {
    match query.get(key) {
        None => Ok(default),
        Some(value) => value
            .parse::<i64>()
            .ok()
            .filter(|v| (min..=max).contains(v))
            .ok_or(v::bad("Invalid pagination")),
    }
}

pub async fn read(
    State(state): State<AppState>,
    Path(operation): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    match operation.as_str() {
        "config" => {
            if !query.is_empty() {
                return Err(v::bad("Unknown query field"));
            }
            Ok(Json(config(&state.pool).await?))
        }
        "preview" => {
            if query
                .keys()
                .any(|key| !["templateName", "sampleData"].contains(&key.as_str()))
            {
                return Err(v::bad("Unknown query field"));
            }
            let name = query
                .get("templateName")
                .ok_or(v::bad("Choose an email template"))?;
            email_templates::validate_name(name)?;
            let data = match query.get("sampleData") {
                None => email_templates::sample(false),
                Some(data) => serde_json::from_str::<Value>(data)
                    .ok()
                    .filter(Value::is_object)
                    .ok_or(v::bad("Invalid sample data"))?,
            };
            Ok(Json(email_templates::render(name, &data)))
        }
        "logs" => {
            if query
                .keys()
                .any(|key| !["status", "search", "limit", "offset"].contains(&key.as_str()))
            {
                return Err(v::bad("Unknown query field"));
            }
            let limit = query_number(&query, "limit", 50, 1, 100)?;
            let offset = query_number(&query, "offset", 0, 0, i64::MAX)?;
            let mut sql: QueryBuilder<Postgres> = QueryBuilder::new(
                r#"SELECT to_jsonb(r) FROM (
                SELECT l.id,l."recipientEmail",l.subject,l."templateName",l.status,l."errorMessage",l."patientId",
                    CASE WHEN p."firstName" IS NOT NULL AND p."firstName"<>'' THEN p."firstName"||' '||p."lastName" ELSE NULL END AS "patientName",
                    NULLIF(p.hrn,'') AS "patientHrn",to_char(l."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
                FROM ktp."emailLogs" l LEFT JOIN ktp.patients p ON p.id=l."patientId" WHERE TRUE"#,
            );
            if let Some(status) = query
                .get("status")
                .filter(|s| !s.is_empty() && s.as_str() != "all")
            {
                sql.push(" AND l.status=").push_bind(status);
            }
            // The source API accepts search but does not apply a search filter.
            sql.push(" ORDER BY l.id DESC LIMIT ")
                .push_bind(limit)
                .push(" OFFSET ")
                .push_bind(offset)
                .push(") r");
            let rows: Vec<(SqlJson<Value>,)> = sql.build_query_as().fetch_all(&state.pool).await?;
            Ok(Json(
                json!({"items":rows.into_iter().map(|r|r.0.0).collect::<Vec<_>>()}),
            ))
        }
        _ => Err(ApiError(
            StatusCode::NOT_FOUND,
            "Unknown automation operation",
        )),
    }
}

pub async fn mutate(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    Path(operation): Path<String>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    // Recheck database authorization and release its row lock before any send.
    let mut tx = admin_core::begin(&state, &admin).await?;
    match operation.as_str() {
        "updateConfig" => {
            validate_config(&input)?;
            // Serialize updates to preserve last-run metadata from concurrent sweeps.
            let (acquired,): (bool,) = sqlx::query_as("SELECT pg_try_advisory_xact_lock($1)")
                .bind(SWEEP_LOCK)
                .fetch_one(&mut *tx)
                .await?;
            if !acquired {
                return Err(ApiError(
                    StatusCode::CONFLICT,
                    "Email sweep already running",
                ));
            }
            let existing: Option<(String,)> =
                sqlx::query_as("SELECT value FROM ktp.\"appSettings\" WHERE key=$1")
                    .bind(CONFIG_KEY)
                    .fetch_optional(&mut *tx)
                    .await?;
            let mut value = existing
                .and_then(|r| serde_json::from_str::<Value>(&r.0).ok())
                .filter(Value::is_object)
                .unwrap_or_else(defaults);
            for key in ["masterEnabled", "dispatchTimeManila", "triggers"] {
                value[key] = input[key].clone();
            }
            sqlx::query(r#"INSERT INTO ktp."appSettings" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,"updatedAt"=CURRENT_TIMESTAMP"#)
                .bind(CONFIG_KEY).bind(value.to_string()).execute(&mut *tx).await?;
            tx.commit().await?;
            Ok(Json(json!({"success":true})))
        }
        "sendTestEmail" => {
            v::allowed(&input, &["to", "templateName"])?;
            let to = input["to"]
                .as_str()
                .filter(|s| email_dispatch::valid_address(s))
                .ok_or(v::bad("Invalid email address"))?;
            let template = input["templateName"]
                .as_str()
                .ok_or(v::bad("Choose an email template"))?;
            email_templates::validate_name(template)?;
            tx.commit().await?;
            let rendered = email_templates::render(template, &email_templates::sample(true));
            let result =
                email_dispatch::send(&state.pool, to, template, &rendered, None, None).await?;
            Ok(Json(
                json!({"success":result.status!="failed","status":result.status,"id":result.id}),
            ))
        }
        "runManualSweep" => {
            v::allowed(&input, &[])?;
            tx.commit().await?;
            Ok(Json(json!({"success":true,"stats":sweep(&state).await?})))
        }
        _ => Err(ApiError(
            StatusCode::NOT_FOUND,
            "Unknown automation operation",
        )),
    }
}

async fn sweep(state: &AppState) -> Result<Value, ApiError> {
    let mut lock = state.pool.acquire().await?;
    // Session lock survives individual autocommit statements; closing on drop
    // also releases it if the request is cancelled during provider dispatch.
    lock.close_on_drop();
    let (acquired,): (bool,) = sqlx::query_as("SELECT pg_try_advisory_lock($1)")
        .bind(SWEEP_LOCK)
        .fetch_one(&mut *lock)
        .await?;
    if !acquired {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Email sweep already running",
        ));
    }
    let mut config = config(&state.pool).await?;
    if config["masterEnabled"] != true {
        return Ok(json!({"created":0,"sent":0,"failed":0,"skipped":0}));
    }
    let (mut sent, mut failed, mut skipped) = (0, 0, 0);
    let enabled = config["triggers"]
        .as_array()
        .and_then(|triggers| triggers.iter().find(|t| t["key"] == "appointment_reminder"))
        .is_some_and(|t| t["enabled"] == true);
    if enabled {
        // Existing behavior deliberately uses two days, independently of the
        // configurable leadDays. Other trigger keys remain configuration only.
        let appointments: Vec<(SqlJson<Value>,)> = sqlx::query_as(
            r#"SELECT to_jsonb(r) FROM (
            SELECT a.id,a."patientId",a.kind,a."startsAt",a.location,p."firstName",p."lastName",p."accountEmail",p.hrn
            FROM ktp.appointments a JOIN ktp.patients p ON p.id=a."patientId"
            WHERE a."cancelledAt" IS NULL AND a."startsAt"::date >= $1::date
                AND a."startsAt"::date <= ($1::date + interval '2 days') ORDER BY a.id) r"#,
        )
        .bind(v::today())
        .fetch_all(&state.pool)
        .await?;
        for (SqlJson(appointment),) in appointments {
            let Some(to) = appointment["accountEmail"]
                .as_str()
                .filter(|s| s.contains('@'))
            else {
                skipped += 1;
                continue;
            };
            let appointment_id = appointment["id"].as_i64().unwrap() as i32;
            let patient_id = appointment["patientId"].as_i64().unwrap() as i32;
            let starts = appointment["startsAt"].as_str().unwrap_or_default();
            let date = starts.get(..10).unwrap_or_default();
            let trigger = format!("appointment_reminder:{date}");
            let (exists,): (bool,) = sqlx::query_as(r#"SELECT EXISTS(SELECT 1 FROM ktp."reminderOutbox" WHERE "appointmentId"=$1 AND "triggerType"=$2 AND status IN ('pending','sent'))"#)
                .bind(appointment_id).bind(&trigger).fetch_one(&state.pool).await?;
            if exists {
                skipped += 1;
                continue;
            }
            let (outbox_id,): (i32,) = sqlx::query_as(r#"INSERT INTO ktp."reminderOutbox" ("patientId","appointmentId","triggerType","scheduledFor") VALUES ($1,$2,$3,CURRENT_TIMESTAMP) RETURNING id"#)
                .bind(patient_id).bind(appointment_id).bind(&trigger).fetch_one(&state.pool).await?;
            let patient = format!(
                "{} {}",
                appointment["firstName"].as_str().unwrap_or_default(),
                appointment["lastName"].as_str().unwrap_or_default()
            );
            let rendered = email_templates::render(
                "AppointmentNotice",
                &json!({"patientName":patient,"hrn":appointment["hrn"],
                "appointmentDate":date,"doctorName":appointment["location"].as_str().filter(|s|!s.is_empty()).unwrap_or("SPMC Nephrology Clinic"),"kind":appointment["kind"]}),
            );
            let key = format!("ktp-appointment-{appointment_id}-{date}");
            let delivery = email_dispatch::send(
                &state.pool,
                to,
                "AppointmentNotice",
                &rendered,
                Some(patient_id),
                Some(&key),
            )
            .await;
            let delivery = match delivery {
                Ok(delivery) => delivery,
                Err(error) => {
                    // send() only returns an error before provider contact.
                    sqlx::query(r#"UPDATE ktp."reminderOutbox" SET status='failed',"errorMessage"='Email dispatch could not start' WHERE id=$1"#)
                        .bind(outbox_id).execute(&state.pool).await?;
                    return Err(error);
                }
            };
            let status = if delivery.uncertain {
                failed += 1;
                "pending"
            } else if delivery.status == "failed" {
                failed += 1;
                "failed"
            } else {
                sent += 1;
                "sent"
            };
            sqlx::query(r#"UPDATE ktp."reminderOutbox" SET status=$2,"sentAt"=CASE WHEN $2='sent' THEN CURRENT_TIMESTAMP ELSE NULL END,"errorMessage"=CASE WHEN $2='failed' THEN 'Email delivery failed' WHEN $2='pending' THEN 'Email delivery unconfirmed; reconcile before retry' ELSE NULL END WHERE id=$1"#)
                .bind(outbox_id).bind(status).execute(&state.pool).await?;
        }
    }
    config["lastRunAt"] = json!(Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true));
    config["lastRunStats"] = json!({"sent":sent,"failed":failed,"skipped":skipped});
    sqlx::query(r#"INSERT INTO ktp."appSettings" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,"updatedAt"=CURRENT_TIMESTAMP"#)
        .bind(CONFIG_KEY).bind(config.to_string()).execute(&state.pool).await?;
    lock.close().await?;
    Ok(json!({"created":sent+failed,"sent":sent,"failed":failed,"skipped":skipped}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_and_config_validation_match_router() {
        let mut input = defaults();
        input.as_object_mut().unwrap().remove("lastRunAt");
        input.as_object_mut().unwrap().remove("lastRunStats");
        assert!(validate_config(&input).is_ok());
        assert_eq!(input["triggers"].as_array().unwrap().len(), 3);
        input["triggers"][0]["leadDays"] = json!(31);
        assert!(validate_config(&input).is_err());
        input["triggers"][0]["leadDays"] = json!(1);
        input["dispatchTimeManila"] = json!("8:00");
        assert!(validate_config(&input).is_err());
    }
    #[test]
    fn pagination_bounds_are_enforced() {
        let mut query = HashMap::new();
        assert_eq!(query_number(&query, "limit", 50, 1, 100).unwrap(), 50);
        query.insert("limit".into(), "101".into());
        assert!(query_number(&query, "limit", 50, 1, 100).is_err());
    }
}
