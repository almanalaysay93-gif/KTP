use crate::{clinical_core::Write, error::ApiError, validation as v};
use axum::http::StatusCode;
use chrono::DateTime;
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;
use std::collections::HashSet;

pub async fn add_service(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    v::allowed(
        input,
        &["patientId", "serviceType", "label", "dueDate", "note"],
    )?;
    let kind = v::choice(input, "serviceType", v::SERVICE_TYPES)?;
    let label = v::string(input, "label", 1, 200)?;
    let due = v::date(input, "dueDate", false)?;
    let note = v::opt_string(input, "note", 4000)?;
    let (id,):(i32,)=sqlx::query_as(r#"INSERT INTO ktp."serviceRecords" ("patientId","serviceType",label,"dueDate",note) VALUES ($1,$2,$3,$4::text::date,$5) RETURNING id"#)
        .bind(ctx.patient_id).bind(kind).bind(label).bind(due).bind(note).fetch_one(&mut *ctx.tx).await?;
    ctx.audit("clinical.service.add", id, Value::Null).await?;
    Ok(json!({"id":id}))
}

struct Checklist {
    id: i32,
    status: String,
    done: Option<String>,
    note: Option<String>,
}
fn checklist_input(input: &Value, single: bool) -> Result<Checklist, ApiError> {
    v::allowed(
        input,
        if single {
            &["patientId", "catalogId", "status", "doneDate", "note"]
        } else {
            &["catalogId", "status", "doneDate", "note"]
        },
    )?;
    let id = v::id(input, "catalogId")?;
    let status = v::choice(input, "status", &["Pending", "Done", "NA"])?;
    let done = v::opt_date(input, "doneDate", true)?;
    if status == "Done" && done.is_none() {
        return Err(v::bad("Completion date is required"));
    }
    Ok(Checklist {
        id,
        done: if status == "Done" { done } else { None },
        status,
        note: v::opt_string(input, "note", 4000)?,
    })
}
async fn write_checklist(ctx: &mut Write, item: Checklist) -> Result<i32, ApiError> {
    let catalog:Option<(i32,)> =sqlx::query_as(r#"SELECT id FROM ktp."checklistCatalog" WHERE id=$1 AND active=true AND ("appliesTo"='Both' OR "appliesTo"=$2) FOR SHARE"#)
        .bind(item.id).bind(ctx.patient["patientType"].as_str()).fetch_optional(&mut *ctx.tx).await?;
    if catalog.is_none() {
        return Err(ApiError(
            StatusCode::NOT_FOUND,
            "Checklist item not found for this patient",
        ));
    }
    let(id,):(i32,)=sqlx::query_as(r#"INSERT INTO ktp."patientChecklist" ("patientId","catalogId",status,"doneDate",note) VALUES ($1,$2,$3,$4::text::date,$5)
        ON CONFLICT ("patientId","catalogId") DO UPDATE SET status=excluded.status,"doneDate"=excluded."doneDate",note=excluded.note,"updatedAt"=now() RETURNING id"#)
        .bind(ctx.patient_id).bind(item.id).bind(item.status).bind(item.done).bind(item.note).fetch_one(&mut *ctx.tx).await?;
    ctx.audit("clinical.checklist.update", id, Value::Null)
        .await?;
    Ok(id)
}
pub async fn checklist(ctx: &mut Write, input: &Value, many: bool) -> Result<Value, ApiError> {
    if !many {
        return Ok(json!({"id":write_checklist(ctx,checklist_input(input,true)?).await?}));
    }
    v::allowed(input, &["patientId", "items"])?;
    let items = input["items"]
        .as_array()
        .filter(|a| !a.is_empty() && a.len() <= 100)
        .ok_or(v::bad("Invalid checklist item count"))?;
    let mut ids = HashSet::new();
    let items = items
        .iter()
        .map(|item| {
            let item = checklist_input(item, false)?;
            if !ids.insert(item.id) {
                return Err(v::bad("Each checklist item may occur once"));
            }
            Ok(item)
        })
        .collect::<Result<Vec<_>, ApiError>>()?;
    let count = items.len();
    for item in items {
        write_checklist(ctx, item).await?;
    }
    Ok(json!({"count":count}))
}

pub async fn add_appointment(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    v::allowed(
        input,
        &["patientId", "title", "kind", "startsAt", "location", "note"],
    )?;
    let title = v::string(input, "title", 1, 200)?;
    let kind = v::choice(
        input,
        "kind",
        &["FollowUp", "Biopsy", "Workup", "Clearance", "Other"],
    )?;
    let timestamp = input["startsAt"]
        .as_str()
        .ok_or(v::bad("Invalid appointment time"))?;
    let starts = DateTime::parse_from_rfc3339(timestamp)
        .map_err(|_| v::bad("Invalid appointment time"))?
        .to_utc()
        .to_rfc3339();
    let location = v::opt_string(input, "location", 300)?;
    let note = v::opt_string(input, "note", 4000)?;
    let (id,):(i32,)=sqlx::query_as(r#"INSERT INTO ktp.appointments ("patientId",title,kind,"startsAt",location,note) VALUES ($1,$2,$3,$4::text::timestamptz AT TIME ZONE 'UTC',$5,$6) RETURNING id"#)
        .bind(ctx.patient_id).bind(title).bind(kind).bind(starts).bind(location).bind(note).fetch_one(&mut *ctx.tx).await?;
    ctx.audit("clinical.appointment.add", id, Value::Null)
        .await?;
    Ok(json!({"id":id}))
}
pub async fn cancel_appointment(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    v::allowed(input, &["patientId", "id"])?;
    let id = v::id(input, "id")?;
    let row:Option<(i32,)> =sqlx::query_as(r#"UPDATE ktp.appointments SET "cancelledAt"=now(),"updatedAt"=now() WHERE id=$1 AND "patientId"=$2 AND "cancelledAt" IS NULL RETURNING id"#)
        .bind(id).bind(ctx.patient_id).fetch_optional(&mut *ctx.tx).await?;
    if row.is_none() {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Appointment missing or already cancelled",
        ));
    }
    ctx.audit("clinical.appointment.cancel", id, Value::Null)
        .await?;
    Ok(json!({"id":id}))
}
pub async fn file_claim(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    v::allowed(input, &["patientId", "id", "claimFiledDate"])?;
    let id = v::id(input, "id")?;
    let date = v::date(input, "claimFiledDate", true)?;
    let row:Option<(SqlJson<Value>,)> =sqlx::query_as(r#"SELECT to_jsonb(s) FROM ktp."serviceRecords" s WHERE id=$1 AND "patientId"=$2 FOR UPDATE"#)
        .bind(id).bind(ctx.patient_id).fetch_optional(&mut *ctx.tx).await?;
    let service = row
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Service not found"))?
        .0
        .0;
    if service["serviceDate"].is_null() || service["status"] == "Planned" {
        return Err(v::bad("Record a result before filing a claim"));
    }
    if date.as_str() < service["serviceDate"].as_str().unwrap_or_default() {
        return Err(v::bad("Claim filing cannot precede service date"));
    }
    let changed:Option<(i32,)> =sqlx::query_as(r#"UPDATE ktp."serviceRecords" SET "claimFiledDate"=$1::text::date,"updatedAt"=now() WHERE id=$2 AND "patientId"=$3 AND "claimFiledDate" IS NULL RETURNING id"#)
        .bind(date).bind(id).bind(ctx.patient_id).fetch_optional(&mut *ctx.tx).await?;
    if changed.is_none() {
        return Err(ApiError(StatusCode::CONFLICT, "Claim already filed"));
    }
    ctx.audit("clinical.claim.file", id, Value::Null).await?;
    Ok(json!({"id":id}))
}
