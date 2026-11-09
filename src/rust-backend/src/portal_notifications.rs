use crate::{AppState, auth::SessionUser, error::ApiError, portal_access, portal_auth::Empty};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;

pub async fn list(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(
        "SELECT to_jsonb(n) FROM ktp.notifications n WHERE \"patientId\"=$1 ORDER BY id DESC",
    )
    .bind(access.patient["id"].as_i64().unwrap() as i32)
    .fetch_all(&mut *access.tx)
    .await?;
    access.tx.commit().await?;
    Ok(Json(json!(
        rows.into_iter().map(|r| r.0.0).collect::<Vec<_>>()
    )))
}
pub async fn unread(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    let (count,): (i64,) = sqlx::query_as(
        "SELECT count(*) FROM ktp.notifications WHERE \"patientId\"=$1 AND read=false",
    )
    .bind(access.patient["id"].as_i64().unwrap() as i32)
    .fetch_one(&mut *access.tx)
    .await?;
    access.tx.commit().await?;
    Ok(Json(json!(count)))
}
pub async fn mark(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    Path(id): Path<i32>,
    Json(_): Json<Empty>,
) -> Result<Json<Value>, ApiError> {
    if id <= 0 {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid notification id"));
    }
    let mut access = portal_access::begin(&state, &user, true).await?;
    sqlx::query("UPDATE ktp.notifications SET read=true WHERE id=$1 AND \"patientId\"=$2")
        .bind(id)
        .bind(access.patient["id"].as_i64().unwrap() as i32)
        .execute(&mut *access.tx)
        .await?;
    access.tx.commit().await?;
    Ok(Json(json!({"success":true})))
}
pub async fn mark_all(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    Json(_): Json<Empty>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, true).await?;
    sqlx::query("UPDATE ktp.notifications SET read=true WHERE \"patientId\"=$1")
        .bind(access.patient["id"].as_i64().unwrap() as i32)
        .execute(&mut *access.tx)
        .await?;
    access.tx.commit().await?;
    Ok(Json(json!({"success":true})))
}
