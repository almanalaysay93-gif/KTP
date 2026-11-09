use crate::{
    AppState,
    auth::{self, Admin},
    error::ApiError,
};
use axum::http::{HeaderMap, StatusCode};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use std::net::SocketAddr;

pub async fn begin(
    state: &AppState,
    admin: &Admin,
) -> Result<Transaction<'static, Postgres>, ApiError> {
    let mut tx = state.pool.begin().await?;
    let user: Option<(Option<String>,)> =
        sqlx::query_as("SELECT email FROM ktp.users WHERE id=$1 FOR SHARE")
            .bind(admin.id)
            .fetch_optional(&mut *tx)
            .await?;
    if !user.is_some_and(|r| auth::has_full_access(r.0.as_deref().unwrap_or_default())) {
        return Err(ApiError(StatusCode::FORBIDDEN, "Admin access required"));
    }
    Ok(tx)
}
pub async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    actor: i32,
    patient_id: Option<i32>,
    action: &str,
    details: Value,
    peer: SocketAddr,
    headers: &HeaderMap,
) -> Result<(), ApiError> {
    let original = peer
        .ip()
        .is_loopback()
        .then(|| headers.get("x-ktp-client-ip"))
        .flatten()
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<std::net::IpAddr>().ok());
    let ip = original.unwrap_or(peer.ip()).to_string();
    let agent = headers.get("user-agent").and_then(|v| v.to_str().ok());
    sqlx::query(r#"INSERT INTO ktp."activityLog" ("actorUserId","patientId",action,details,"ipAddress","userAgent") VALUES ($1,$2,$3,$4,$5,$6)"#)
        .bind(actor).bind(patient_id).bind(action).bind(details.to_string()).bind(ip).bind(agent).execute(&mut **tx).await?;
    Ok(())
}
