use crate::{AppState, auth::SessionUser, clinical, error::ApiError, portal_access};
use axum::{Extension, Json, extract::State};
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;

pub async fn profile(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    let doctor =
        sqlx::query_as::<_, (SqlJson<Value>,)>("SELECT to_jsonb(d) FROM ktp.doctors d WHERE id=$1")
            .bind(access.patient["nephrologistId"].as_i64().map(|v| v as i32))
            .fetch_optional(&mut *access.tx)
            .await?;
    let fellow =
        sqlx::query_as::<_, (SqlJson<Value>,)>("SELECT to_jsonb(d) FROM ktp.doctors d WHERE id=$1")
            .bind(access.patient["fellowId"].as_i64().map(|v| v as i32))
            .fetch_optional(&mut *access.tx)
            .await?;
    let recipient: Option<(String, String)> =
        sqlx::query_as("SELECT \"firstName\",\"lastName\" FROM ktp.patients WHERE id=$1")
            .bind(
                access.patient["linkedRecipientId"]
                    .as_i64()
                    .map(|v| v as i32),
            )
            .fetch_optional(&mut *access.tx)
            .await?;
    access.tx.commit().await?;
    Ok(Json(
        json!({"patient":access.patient,"nephrologist":doctor.map(|d|d.0.0),"fellow":fellow.map(|d|d.0.0),"linkedRecipientName":recipient.map(|r|format!("{} {}",r.0,r.1))}),
    ))
}

pub async fn clinical(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    let result = clinical::read(&mut access.tx, &access.patient).await?;
    access.tx.commit().await?;
    Ok(Json(result))
}

pub async fn messages(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(r#"
        SELECT to_jsonb(r) FROM (
            SELECT m.id,m.subject,m.body,CAST(m."createdAt" AS TEXT) AS "createdAt",
                CAST(mr."readAt" AS TEXT) AS "readAt",CAST(ma."acknowledgedAt" AS TEXT) AS "acknowledgedAt"
            FROM ktp."messageRecipients" mr JOIN ktp.messages m ON m.id=mr."messageId"
            LEFT JOIN ktp."messageAcknowledgments" ma ON ma."messageId"=m.id AND ma."patientId"=mr."patientId"
            WHERE mr."patientId"=$1 ORDER BY m.id DESC
        ) r
    "#).bind(access.patient["id"].as_i64().unwrap() as i32).fetch_all(&mut *access.tx).await?;
    access.tx.commit().await?;
    Ok(Json(json!(
        rows.into_iter().map(|r| r.0.0).collect::<Vec<_>>()
    )))
}

pub async fn settings(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    let hotline: Option<(String,)> =
        sqlx::query_as("SELECT value FROM ktp.\"appSettings\" WHERE key='emergencyHotlineText'")
            .fetch_optional(&mut *access.tx)
            .await?;
    access.tx.commit().await?;
    Ok(Json(
        json!({"emergencyHotlineText":hotline.map(|v|v.0).unwrap_or_else(||"KT Unit Hotline: 0917-000-0000 | Hospital Trunk: (082) 227-2731 loc 4100".to_owned())}),
    ))
}
