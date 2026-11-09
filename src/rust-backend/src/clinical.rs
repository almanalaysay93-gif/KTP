use crate::{AppState, error::ApiError};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::{DateTime, NaiveDateTime, SecondsFormat};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction, types::Json as SqlJson};

pub(crate) fn timestamp_iso(value: &Value) -> Result<Value, ApiError> {
    let text = value.as_str().ok_or(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "Invalid clinical timestamp",
    ))?;
    let timestamp = DateTime::parse_from_rfc3339(text)
        .map(|value| value.to_utc())
        .or_else(|_| {
            NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%.f")
                .or_else(|_| NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S%.f"))
                .map(|value| value.and_utc())
        })
        .map_err(|_| {
            ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Invalid clinical timestamp",
            )
        })?;
    Ok(Value::String(
        timestamp.to_rfc3339_opts(SecondsFormat::Millis, true),
    ))
}

fn values(rows: Vec<(SqlJson<Value>,)>) -> Vec<Value> {
    rows.into_iter().map(|row| row.0.0).collect()
}

/// Read the existing clinical projection within the caller's authorization transaction.
/// Catalog synchronization remains the responsibility of the Node adapter.
pub async fn read(tx: &mut Transaction<'_, Postgres>, patient: &Value) -> Result<Value, ApiError> {
    let patient_id = patient["id"]
        .as_i64()
        .and_then(|value| i32::try_from(value).ok())
        .filter(|value| *value > 0)
        .ok_or(ApiError(StatusCode::BAD_REQUEST, "Invalid patient id"))?;
    let patient_type = patient["patientType"].as_str().ok_or(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "Invalid patient profile",
    ))?;
    let services = sqlx::query_as::<_, (SqlJson<Value>,)>(
        r#"
        SELECT to_jsonb(s) FROM ktp."serviceRecords" s
        WHERE s."patientId" = $1 ORDER BY s."dueDate" DESC, s.id DESC
    "#,
    )
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    let tests = sqlx::query_as::<_, (SqlJson<Value>,)>(
        r#"
        SELECT to_jsonb(t) FROM ktp."labTests" t
        WHERE t.active = true ORDER BY t."sortOrder", t.name
    "#,
    )
    .fetch_all(&mut **tx)
    .await?;
    let labs = sqlx::query_as::<_, (SqlJson<Value>,)>(
        r#"
        SELECT to_jsonb(row) FROM (
            SELECT r.*, t.name AS "testName", t.unit, s."serviceDate", s.phase
            FROM ktp."labResults" r JOIN ktp."labTests" t ON t.id = r."labTestId"
            JOIN ktp."serviceRecords" s ON s.id = r."serviceRecordId"
            WHERE s."patientId" = $1 AND s.status = 'Done'
            ORDER BY s."serviceDate" DESC, r.id DESC
        ) row
    "#,
    )
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    let checklist = sqlx::query_as::<_, (SqlJson<Value>,)>(
        r#"
        SELECT to_jsonb(row) FROM (
            SELECT c.*, c.id AS "catalogId", COALESCE(p.status, 'Pending') AS status,
                p."doneDate", p.note
            FROM ktp."checklistCatalog" c LEFT JOIN ktp."patientChecklist" p
                ON p."catalogId" = c.id AND p."patientId" = $1
            WHERE c.active = true AND (c."appliesTo" = 'Both' OR c."appliesTo" = $2)
            ORDER BY c.phase, c."sortOrder", c.id
        ) row
    "#,
    )
    .bind(patient_id)
    .bind(patient_type)
    .fetch_all(&mut **tx)
    .await?;
    let visits = sqlx::query_as::<_, (SqlJson<Value>,)>(
        r#"
        SELECT to_jsonb(a) FROM ktp.appointments a
        WHERE a."patientId" = $1 ORDER BY a."startsAt" DESC, a.id DESC
    "#,
    )
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    let mut appointments = values(visits);
    for appointment in &mut appointments {
        appointment["startsAt"] = timestamp_iso(&appointment["startsAt"])?;
        if !appointment["cancelledAt"].is_null() {
            appointment["cancelledAt"] = timestamp_iso(&appointment["cancelledAt"])?;
        }
    }
    // PostgreSQL to_jsonb emits DATE fields as YYYY-MM-DD and booleans as bools,
    // matching the original service/checklist/lab date-only conversions.
    Ok(json!({
        "services": values(services),
        "labTests": values(tests),
        "labResults": values(labs),
        "checklist": values(checklist),
        "appointments": appointments,
    }))
}

/// Parent router applies the existing admin middleware before this handler.
pub async fn admin_get(
    State(state): State<AppState>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, ApiError> {
    if id <= 0 {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid patient id"));
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *tx)
        .await?;
    let patient: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(p) FROM ktp.patients p WHERE p.id = $1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?;
    let patient = patient
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Patient not found"))?
        .0
        .0;
    let clinical = read(&mut tx, &patient).await?;
    tx.commit().await?;
    Ok(Json(clinical))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appointment_timestamps_match_javascript_iso_utc_milliseconds() {
        for (source, expected) in [
            ("2026-10-05T09:00:00+08:00", "2026-10-05T01:00:00.000Z"),
            ("2026-10-05T01:00:00", "2026-10-05T01:00:00.000Z"),
            ("2026-10-05 01:00:00.123456", "2026-10-05T01:00:00.123Z"),
            ("2026-10-05T01:00:00Z", "2026-10-05T01:00:00.000Z"),
        ] {
            assert_eq!(timestamp_iso(&json!(source)).unwrap(), json!(expected));
        }
        assert!(timestamp_iso(&json!("not a timestamp")).is_err());
    }
}
