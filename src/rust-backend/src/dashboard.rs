use crate::{AppState, error::ApiError, metrics, patients::validate_status};
use axum::{
    Json,
    extract::{Query, State},
};
use chrono::{FixedOffset, Utc};
use serde::Deserialize;
use serde_json::Value;
use sqlx::types::Json as SqlJson;

#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MetricsQuery {
    status: Option<String>,
}

pub async fn metrics(
    State(state): State<AppState>,
    Query(query): Query<MetricsQuery>,
) -> Result<Json<Value>, ApiError> {
    validate_status(query.status.as_deref())?;
    let mut tx = state.pool.begin().await?;
    // All six datasets must describe one snapshot, including status and donor links.
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *tx)
        .await?;
    let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(r#"
        SELECT to_jsonb(r) FROM (
            SELECT p."patientType", p.stage, p.status,
            CASE WHEN EXISTS (
                SELECT 1 FROM ktp."checklistCatalog" c
                LEFT JOIN ktp."patientChecklist" pc ON pc."catalogId" = c.id AND pc."patientId" = p.id
                WHERE c.name = 'Ethics committee' AND c.active = true
                  AND (c."appliesTo" = 'Both' OR c."appliesTo" = p."patientType")
                  AND COALESCE(pc.status, 'Pending') = 'Pending'
            ) THEN 'Pending' ELSE NULL END AS "ethicsStatus"
            FROM ktp.patients p WHERE $1::text IS NULL OR p.status = $1
        ) r
    "#).bind(query.status.as_deref()).fetch_all(&mut *tx).await?;
    let patients = sqlx::query_as::<_, (SqlJson<Value>,)>("SELECT to_jsonb(p) FROM ktp.patients p")
        .fetch_all(&mut *tx)
        .await?;
    let checklist = sqlx::query_as::<_, (SqlJson<Value>,)>(r#"
        SELECT to_jsonb(r) FROM (
            SELECT p.id AS "patientId", c.name, c.category, COALESCE(pc.status, 'Pending') AS status,
                c."asIndicated", (pc.id IS NOT NULL) AS recorded
            FROM ktp.patients p JOIN ktp."checklistCatalog" c ON c.active = true
                AND (c."appliesTo" = 'Both' OR c."appliesTo" = p."patientType")
            LEFT JOIN ktp."patientChecklist" pc ON pc."patientId" = p.id AND pc."catalogId" = c.id
        ) r
    "#).fetch_all(&mut *tx).await?;
    let services =
        sqlx::query_as::<_, (SqlJson<Value>,)>(r#"SELECT to_jsonb(s) FROM ktp."serviceRecords" s"#)
            .fetch_all(&mut *tx)
            .await?;
    let appointments =
        sqlx::query_as::<_, (SqlJson<Value>,)>("SELECT to_jsonb(a) FROM ktp.appointments a")
            .fetch_all(&mut *tx)
            .await?;
    let events = sqlx::query_as::<_, (SqlJson<Value>,)>(r#"SELECT to_jsonb(a) FROM ktp."activityLog" a WHERE action IN ('UPDATE_PATIENT','ENROLL_PATIENT') ORDER BY "createdAt", id"#).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let today = Utc::now()
        .with_timezone(&FixedOffset::east_opt(8 * 3600).unwrap())
        .format("%Y-%m-%d")
        .to_string();
    let values = |rows: Vec<(SqlJson<Value>,)>| rows.into_iter().map(|r| r.0.0).collect::<Vec<_>>();
    Ok(Json(metrics::metrics(
        &values(rows),
        &values(patients),
        &values(checklist),
        &values(services),
        &values(appointments),
        &values(events),
        &today,
        query.status.as_deref(),
    )))
}
