use crate::{AppState, auth::SessionUser, error::ApiError, portal_access, portal_auth::Empty};
use axum::{
    Extension, Json,
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;
use std::net::SocketAddr;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Contact {
    contact_number: Value,
}

pub async fn contact(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    Json(input): Json<Contact>,
) -> Result<Json<Value>, ApiError> {
    let value = match &input.contact_number {
        Value::Null => None,
        Value::String(s) if s.encode_utf16().count() <= 32 => Some(s.as_str()),
        _ => return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid contact number")),
    };
    let mut access = portal_access::begin(&state, &user, true).await?;
    let (SqlJson(patient),): (SqlJson<Value>,) = sqlx::query_as(r#"UPDATE ktp.patients SET "contactNumber"=$1,"updatedAt"=now() WHERE id=$2 RETURNING to_jsonb(patients.*)"#)
        .bind(value).bind(access.patient["id"].as_i64().unwrap() as i32).fetch_one(&mut *access.tx).await?;
    access.tx.commit().await?;
    Ok(Json(patient))
}

#[derive(Deserialize)]
pub enum AppointmentResponse {
    Confirmed,
    RescheduleRequested,
}
impl AppointmentResponse {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Confirmed => "Confirmed",
            Self::RescheduleRequested => "RescheduleRequested",
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResponseInput {
    response: AppointmentResponse,
    response_note: Option<String>,
}

pub async fn respond(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i32>,
    headers: HeaderMap,
    Json(input): Json<ResponseInput>,
) -> Result<Json<Value>, ApiError> {
    if id <= 0 {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid appointment id"));
    }
    let note = input.response_note.as_deref().map(str::trim);
    if note.is_some_and(|s| s.encode_utf16().count() > 1000) {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid response note"));
    }
    let mut access = portal_access::begin(&state, &user, true).await?;
    let row: Option<(i32,)> = sqlx::query_as(r#"UPDATE ktp.appointments SET response=$1,"responseNote"=$2,"respondedAt"=now(),"updatedAt"=now()
        WHERE id=$3 AND "patientId"=$4 AND "cancelledAt" IS NULL RETURNING id"#)
        .bind(input.response.as_str()).bind(note).bind(id).bind(access.patient["id"].as_i64().unwrap() as i32).fetch_optional(&mut *access.tx).await?;
    if row.is_none() {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Appointment missing or cancelled",
        ));
    }
    // Actor is the authenticated user, rather than the legacy patient ID.
    portal_access::audit(
        &mut access,
        peer,
        &headers,
        &format!("clinical.appointment.respond.{}", input.response.as_str()),
        json!({"id":id}),
    )
    .await?;
    access.tx.commit().await?;
    Ok(Json(json!({"id":id,"response":input.response.as_str()})))
}

pub async fn acknowledge(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    Path(id): Path<i32>,
    Json(_): Json<Empty>,
) -> Result<Json<Value>, ApiError> {
    if id <= 0 {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid message id"));
    }
    let mut access = portal_access::begin(&state, &user, true).await?;
    let patient_id = access.patient["id"].as_i64().unwrap() as i32;
    let recipient: Option<(i32,)> = sqlx::query_as(r#"SELECT id FROM ktp."messageRecipients" WHERE "messageId"=$1 AND "patientId"=$2 FOR UPDATE"#)
        .bind(id).bind(patient_id).fetch_optional(&mut *access.tx).await?;
    if recipient.is_none() {
        return Err(ApiError(StatusCode::NOT_FOUND, "Message not found"));
    }
    sqlx::query(r#"UPDATE ktp."messageRecipients" SET "readAt"=COALESCE("readAt",now()) WHERE "messageId"=$1 AND "patientId"=$2"#)
        .bind(id).bind(patient_id).execute(&mut *access.tx).await?;
    sqlx::query(r#"INSERT INTO ktp."messageAcknowledgments" ("messageId","patientId") SELECT $1,$2
        WHERE NOT EXISTS (SELECT 1 FROM ktp."messageAcknowledgments" WHERE "messageId"=$1 AND "patientId"=$2)"#)
        .bind(id).bind(patient_id).execute(&mut *access.tx).await?;
    access.tx.commit().await?;
    Ok(Json(json!({"success":true})))
}
