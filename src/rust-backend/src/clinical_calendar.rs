use crate::{AppState, clinical, error::ApiError};
use axum::{Json, extract::State};
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;

pub async fn list(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let rows:Vec<(SqlJson<Value>,)>=sqlx::query_as(r#"SELECT to_jsonb(a) || jsonb_build_object(
        'respondedAt',CAST(a."respondedAt" AS TEXT),'hrn',p.hrn,'firstName',p."firstName",'lastName',p."lastName",'patientType',p."patientType",'stage',p.stage,'contactNumber',NULLIF(p."contactNumber",''),
        'patientName',p."lastName" || ', ' || p."firstName")
        FROM ktp.appointments a JOIN ktp.patients p ON p.id=a."patientId" WHERE p.status='Active' ORDER BY a."startsAt" ASC,a.id DESC"#)
        .fetch_all(&state.pool).await?;
    let mut result = Vec::with_capacity(rows.len());
    for (SqlJson(mut row),) in rows {
        row["startsAt"] = clinical::timestamp_iso(&row["startsAt"])?;
        if !row["cancelledAt"].is_null() {
            row["cancelledAt"] = clinical::timestamp_iso(&row["cancelledAt"])?;
        }
        result.push(row);
    }
    Ok(Json(json!(result)))
}
