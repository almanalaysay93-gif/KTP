use crate::{
    AppState, auth::Admin, clinical_actions, clinical_core, clinical_corrections, clinical_labs,
    error::ApiError, zbenefit,
};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde_json::Value;

pub async fn dispatch(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    Path(operation): Path<String>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    if ![
        "addService",
        "recordResult",
        "addLabResult",
        "addLabResults",
        "updateService",
        "setChecklist",
        "setChecklistMany",
        "addAppointment",
        "cancelAppointment",
        "fileClaim",
        "saveZBenefit",
    ]
    .contains(&operation.as_str())
    {
        return Err(ApiError(StatusCode::NOT_FOUND, "Unknown clinical action"));
    }
    let mut ctx = clinical_core::begin(&state, &admin, &input).await?;
    let result = match operation.as_str() {
        "addService" => clinical_actions::add_service(&mut ctx, &input).await?,
        "recordResult" => clinical_labs::record(&mut ctx, &input).await?,
        "addLabResult" => clinical_labs::add(&mut ctx, &input, true).await?,
        "addLabResults" => clinical_labs::add(&mut ctx, &input, false).await?,
        "updateService" => clinical_corrections::update(&mut ctx, &input).await?,
        "setChecklist" => clinical_actions::checklist(&mut ctx, &input, false).await?,
        "setChecklistMany" => clinical_actions::checklist(&mut ctx, &input, true).await?,
        "addAppointment" => clinical_actions::add_appointment(&mut ctx, &input).await?,
        "cancelAppointment" => clinical_actions::cancel_appointment(&mut ctx, &input).await?,
        "fileClaim" => clinical_actions::file_claim(&mut ctx, &input).await?,
        "saveZBenefit" => zbenefit::save(&mut ctx, &input).await?,
        _ => unreachable!(),
    };
    ctx.tx.commit().await?;
    Ok(Json(result))
}
