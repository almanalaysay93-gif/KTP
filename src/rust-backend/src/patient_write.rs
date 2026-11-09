use crate::{
    AppState, admin_core, auth::Admin, error::ApiError, patient_validation as pv, validation as v,
};
use axum::{
    Extension, Json,
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction, types::Json as SqlJson};
use std::net::SocketAddr;

async fn load(tx: &mut Transaction<'_, Postgres>, id: i32) -> Result<Value, ApiError> {
    let row: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(p) FROM ktp.patients p WHERE id=$1 FOR UPDATE")
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?;
    Ok(row
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Patient not found"))?
        .0
        .0)
}

async fn check(
    tx: &mut Transaction<'_, Postgres>,
    data: &Value,
    id: Option<i32>,
) -> Result<(), ApiError> {
    pv::business(data, id)?;
    let duplicate: (bool,bool)=sqlx::query_as(r#"SELECT
        EXISTS(SELECT 1 FROM ktp.patients WHERE hrn=$1 AND ($3::integer IS NULL OR id<>$3)),
        EXISTS(SELECT 1 FROM ktp.patients WHERE lower("accountEmail")=lower($2) AND ($3::integer IS NULL OR id<>$3))"#)
        .bind(data["hrn"].as_str()).bind(data["accountEmail"].as_str()).bind(id).fetch_one(&mut **tx).await?;
    if duplicate.0 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "A patient with this HRN already exists",
        ));
    }
    if duplicate.1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "A patient with this Email address is already enrolled",
        ));
    }
    if data["patientType"] == "Donor" {
        let linked = v::id(data, "linkedRecipientId")?;
        let recipient: Option<(String,)> =
            sqlx::query_as("SELECT \"patientType\" FROM ktp.patients WHERE id=$1 FOR SHARE")
                .bind(linked)
                .fetch_optional(&mut **tx)
                .await?;
        if !recipient.is_some_and(|r| r.0 == "Recipient") {
            return Err(v::bad(
                "Linked recipient not found or is not a recipient profile",
            ));
        }
    }
    Ok(())
}

async fn save(
    tx: &mut Transaction<'_, Postgres>,
    data: Value,
    id: Option<i32>,
) -> Result<Value, ApiError> {
    // Column names originate exclusively from the fixed schema whitelist.
    // Only mutable patient profile fields are copied from the JSON record.
    let columns = pv::FIELDS
        .iter()
        .map(|key| format!("\"{key}\""))
        .collect::<Vec<_>>()
        .join(",");
    let sql = if id.is_some() {
        format!(
            "UPDATE ktp.patients p SET ({columns})=(SELECT {columns} FROM jsonb_populate_record(NULL::ktp.patients,$1)),\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=$2 RETURNING to_jsonb(p)"
        )
    } else {
        format!(
            "INSERT INTO ktp.patients AS p ({columns}) SELECT {columns} FROM jsonb_populate_record(NULL::ktp.patients,$1) RETURNING to_jsonb(p)"
        )
    };
    let query = sqlx::query_as::<_, (SqlJson<Value>,)>(&sql).bind(SqlJson(data));
    let row = if let Some(id) = id {
        query.bind(id).fetch_one(&mut **tx).await?
    } else {
        query.fetch_one(&mut **tx).await?
    };
    Ok(row.0.0)
}

pub async fn dispatch(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(operation): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let mut tx = admin_core::begin(&state, &admin).await?;
    let (saved, action, details) = match operation.as_str() {
        "create" => {
            let data = pv::normalize(&input, false)?;
            check(&mut tx, &data, None).await?;
            let saved = save(&mut tx, data, None).await?;
            let details =
                json!({"hrn":saved["hrn"],"type":saved["patientType"],"stage":saved["stage"]});
            (saved, "ENROLL_PATIENT", details)
        }
        "update" => {
            v::allowed(&input, &["id", "data"])?;
            let id = v::id(&input, "id")?;
            let data = pv::normalize(&input["data"], true)?;
            let existing = load(&mut tx, id).await?;
            let mut merged = existing.clone();
            for (key, value) in data.as_object().unwrap() {
                merged[key] = value.clone();
            }
            check(&mut tx, &merged, Some(id)).await?;
            let changes = pv::FIELDS
                .iter()
                .filter(|key| data.get(**key).is_some())
                .collect::<Vec<_>>();
            let mut details = json!({"changes":changes});
            if let Some(stage) = data.get("stage") {
                details["fromStage"] = existing["stage"].clone();
                details["toStage"] = stage.clone();
            }
            (
                save(&mut tx, merged, Some(id)).await?,
                "UPDATE_PATIENT",
                details,
            )
        }
        "archive" => {
            v::allowed(&input, &["id", "status", "reason"])?;
            let id = v::id(&input, "id")?;
            let status = v::choice(&input, "status", &["Inactive", "Deceased", "Transferred"])?;
            if let Some(reason) = input.get("reason")
                && !reason.is_string()
            {
                return Err(v::bad("Expected a string"));
            }
            let mut existing = load(&mut tx, id).await?;
            let mut details = json!({"previousStatus":existing["status"],"newStatus":status});
            if let Some(reason) = input.get("reason") {
                details["reason"] = reason.clone();
            }
            existing["status"] = json!(status);
            (
                save(&mut tx, existing, Some(id)).await?,
                "ARCHIVE_PATIENT",
                details,
            )
        }
        _ => return Err(ApiError(StatusCode::NOT_FOUND, "Unknown patient operation")),
    };
    let id = saved["id"]
        .as_i64()
        .and_then(|id| i32::try_from(id).ok())
        .ok_or(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Invalid saved patient",
        ))?;
    admin_core::audit(&mut tx, admin.id, Some(id), action, details, peer, &headers).await?;
    tx.commit().await?;
    Ok(Json(saved))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActivityQuery {
    pub patient_id: i32,
    pub limit: Option<i64>,
}

pub async fn activity(
    State(state): State<AppState>,
    Query(input): Query<ActivityQuery>,
) -> Result<Json<Vec<Value>>, ApiError> {
    if input.patient_id <= 0 {
        return Err(v::bad("Invalid patient id"));
    }
    let limit = input.limit.unwrap_or(50);
    if limit < 0 {
        return Err(v::bad("Invalid activity limit"));
    }
    let rows:Vec<(SqlJson<Value>,)>=sqlx::query_as(r#"SELECT to_jsonb(a) FROM ktp."activityLog" a WHERE "patientId"=$1 ORDER BY id DESC LIMIT $2"#)
        .bind(input.patient_id).bind(limit).fetch_all(&state.pool).await?;
    Ok(Json(rows.into_iter().map(|row| row.0.0).collect()))
}
