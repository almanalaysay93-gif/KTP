use crate::{AppState, auth::Admin, error::ApiError};
use axum::{
    Extension, Json,
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;
use std::net::SocketAddr;

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Filters {
    pub r#type: Option<String>,
    pub stage: Option<String>,
    pub doctor_id: Option<i32>,
    pub status: Option<String>,
    pub search: Option<String>,
}

pub fn validate_status(status: Option<&str>) -> Result<(), ApiError> {
    if status.is_some_and(|s| !["Active", "Inactive", "Deceased", "Transferred"].contains(&s)) {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid patient status"));
    }
    Ok(())
}

pub async fn list(
    State(state): State<AppState>,
    Query(filters): Query<Filters>,
) -> Result<Json<Vec<Value>>, ApiError> {
    validate_status(filters.status.as_deref())?;
    if filters
        .r#type
        .as_deref()
        .is_some_and(|t| !["Recipient", "Donor"].contains(&t))
    {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid patient type"));
    }
    let search = filters
        .search
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{s}%"));
    let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(r#"
        SELECT to_jsonb(p) FROM ktp.patients p
        WHERE ($1::text IS NULL OR p."patientType" = $1)
          AND ($2::text IS NULL OR p.stage = $2)
          AND ($3::integer IS NULL OR p."nephrologistId" = $3 OR p."fellowId" = $3)
          AND ($4::text IS NULL OR p.status = $4)
          AND ($5::text IS NULL OR p."firstName" ILIKE $5 OR p."lastName" ILIKE $5 OR p.hrn ILIKE $5)
        ORDER BY p."lastName", p."firstName"
    "#).bind(filters.r#type).bind(filters.stage.filter(|s| !s.is_empty()))
        .bind(filters.doctor_id.filter(|id| *id != 0)).bind(filters.status).bind(search)
        .fetch_all(&state.pool).await?;
    Ok(Json(rows.into_iter().map(|r| r.0.0).collect()))
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileQuery {
    pub allow_missing: Option<bool>,
}

pub async fn profile(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i32>,
    Query(query): Query<ProfileQuery>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    if id <= 0 {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid patient id"));
    }
    let mut transaction = state.pool.begin().await?;
    let row: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(p) FROM ktp.patients p WHERE id = $1")
            .bind(id)
            .fetch_optional(&mut *transaction)
            .await?;
    let Some((SqlJson(patient),)) = row else {
        return if query.allow_missing.unwrap_or(false) {
            Ok(Json(
                json!({"patient":null,"linkedRecipient":null,"linkedDonors":[]}),
            ))
        } else {
            Err(ApiError(StatusCode::NOT_FOUND, "Patient not found"))
        };
    };
    let linked: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(p) FROM ktp.patients p WHERE id = $1")
            .bind(patient["linkedRecipientId"].as_i64().map(|n| n as i32))
            .fetch_optional(&mut *transaction)
            .await?;
    let donors: Vec<(SqlJson<Value>,)> = if patient["patientType"] == "Recipient" {
        sqlx::query_as(r#"SELECT to_jsonb(p) FROM ktp.patients p WHERE "patientType" = 'Donor' AND "linkedRecipientId" = $1 ORDER BY "lastName", "firstName""#)
            .bind(id).fetch_all(&mut *transaction).await?
    } else {
        Vec::new()
    };
    // The adapter forwards the original IP only over loopback. Remote callers
    // cannot overwrite their audit IP through this header.
    let peer_ip = Some(peer.ip());
    let original_ip = peer_ip
        .filter(|ip| ip.is_loopback())
        .and_then(|_| headers.get("x-ktp-client-ip"))
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<std::net::IpAddr>().ok());
    let ip = original_ip.or(peer_ip).map(|ip| ip.to_string());
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok());
    let details = json!({"hrn":patient["hrn"], "name":format!("{}, {}", patient["lastName"].as_str().unwrap_or_default(), patient["firstName"].as_str().unwrap_or_default())}).to_string();
    sqlx::query(r#"INSERT INTO ktp."activityLog" ("actorUserId", "patientId", action, details, "ipAddress", "userAgent") VALUES ($1,$2,'VIEW_PATIENT_PROFILE',$3,$4,$5)"#)
        .bind(admin.id).bind(id).bind(details).bind(ip).bind(user_agent)
        .execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Json(
        json!({"patient":patient,"linkedRecipient":linked.map(|r|r.0.0),"linkedDonors":donors.into_iter().map(|r|r.0.0).collect::<Vec<_>>()}),
    ))
}
