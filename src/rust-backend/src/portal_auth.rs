use crate::{
    AppState,
    auth::{self, SessionUser},
    error::ApiError,
    portal_access,
};
use axum::{
    Extension, Json,
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::net::SocketAddr;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Empty {}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let Ok(claims) = auth::verify_session(&headers, &state.secret) else {
        return Ok(Json(Value::Null));
    };
    let user = match auth::load_user(&state.pool, &claims).await {
        Ok(user) => user,
        Err(ApiError(StatusCode::UNAUTHORIZED, _)) => return Ok(Json(Value::Null)),
        Err(error) => return Err(error),
    };
    let is_admin = auth::has_full_access(user.data["email"].as_str().unwrap_or_default());
    let mut data = user.data.clone();
    let mut patient = Value::Null;
    let mut required = false;
    if !is_admin {
        match portal_access::begin(&state, &user, false).await {
            Ok(access) => {
                required = portal_access::consent_required(&access.patient, access.version);
                patient = access.patient;
                access.tx.commit().await?;
            }
            Err(ApiError(StatusCode::UNAUTHORIZED, _)) => {}
            Err(error) => return Err(error),
        }
    }
    data["isAdmin"] = json!(is_admin);
    data["patient"] = patient;
    data["consentRequired"] = json!(required);
    Ok(Json(data))
}

pub async fn notice(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key,value FROM ktp.\"appSettings\" WHERE key IN ('consentNoticeText','consentVersion')")
        .fetch_all(&state.pool).await?;
    let value = |key| rows.iter().find(|r| r.0 == key).map(|r| r.1.as_str());
    let version = portal_access::consent_version(value("consentVersion"))?;
    Ok(Json(
        json!({"consentNoticeText":value("consentNoticeText").unwrap_or("By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination."),"consentVersion":version}),
    ))
}

pub async fn access(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
) -> Result<Json<Value>, ApiError> {
    let access = portal_access::begin(&state, &user, false).await?;
    let result = portal_access::access_json(&access);
    access.tx.commit().await?;
    Ok(Json(result))
}

pub async fn accept(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(_): Json<Empty>,
) -> Result<Json<Value>, ApiError> {
    let mut access = portal_access::begin(&state, &user, false).await?;
    let (sqlx::types::Json(patient),): (sqlx::types::Json<Value>,) = sqlx::query_as(r#"UPDATE ktp.patients SET "consentVersion"=$1,"consentAcceptedAt"=now(),"updatedAt"=now() WHERE id=$2 RETURNING to_jsonb(patients.*)"#)
        .bind(access.version).bind(access.patient["id"].as_i64().unwrap() as i32)
        .fetch_one(&mut *access.tx).await?;
    let version = access.version;
    portal_access::audit(
        &mut access,
        peer,
        &headers,
        "ACCEPT_CONSENT",
        json!({"consentVersion":version}),
    )
    .await?;
    access.tx.commit().await?;
    Ok(Json(
        json!({"success":true,"consentVersion":version,"patient":patient}),
    ))
}
