mod admin_core;
mod admin_entities;
mod admin_messages;
pub mod auth;
mod automation;
mod clinical;
mod clinical_actions;
mod clinical_calendar;
mod clinical_core;
mod clinical_corrections;
mod clinical_labs;
mod clinical_write;
mod dashboard;
mod email_dispatch;
mod email_templates;
pub mod error;
mod import_plan;
pub mod metrics;
mod patient_import;
mod patient_validation;
mod patient_write;
mod patients;
mod portal_access;
mod portal_actions;
mod portal_auth;
mod portal_data;
mod portal_labs;
mod portal_notifications;
mod validation;
mod zbenefit;

use axum::{
    Extension, Json, Router,
    extract::State,
    http::{HeaderValue, header},
    middleware,
    routing::{get, post},
};
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub secret: Arc<[u8]>,
}

pub fn app(state: AppState) -> Router {
    let protected = Router::new()
        .route(
            "/api/rust/admin/automations/{operation}",
            get(automation::read).post(automation::mutate),
        )
        .route(
            "/api/rust/admin/patient-import/{operation}",
            post(patient_import::dispatch),
        )
        .route(
            "/api/rust/admin/entities/{operation}",
            get(admin_entities::read).post(admin_entities::mutate),
        )
        .route(
            "/api/rust/admin/messages",
            get(admin_messages::list).post(admin_messages::create),
        )
        .route(
            "/api/rust/session",
            get(|Extension(admin): Extension<auth::Admin>| async move { Json(admin) }),
        )
        .route("/api/rust/patients", get(patients::list))
        .route("/api/rust/patients/{id}", get(patients::profile))
        .route(
            "/api/rust/admin/patients/{operation}",
            post(patient_write::dispatch),
        )
        .route(
            "/api/rust/admin/patient-activity",
            get(patient_write::activity),
        )
        .route("/api/rust/metrics", get(dashboard::metrics))
        .route("/api/rust/clinical/patients/{id}", get(clinical::admin_get))
        .route(
            "/api/rust/clinical/actions/{operation}",
            post(clinical_write::dispatch),
        )
        .route(
            "/api/rust/clinical/appointments",
            get(clinical_calendar::list),
        )
        .route("/api/rust/clinical/z-benefit", get(zbenefit::list))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_admin,
        ));
    let portal = Router::new()
        .route("/api/rust/doctors", get(|state:State<AppState>,query:axum::extract::Query<std::collections::HashMap<String,String>>|async move {
            admin_entities::read(state,axum::extract::Path("doctors".to_owned()),query).await
        }))
        .route("/api/rust/patient/access", get(portal_auth::access))
        .route("/api/rust/patient/consent", post(portal_auth::accept))
        .route("/api/rust/patient/profile", get(portal_data::profile))
        .route("/api/rust/patient/clinical", get(portal_data::clinical))
        .route("/api/rust/patient/messages", get(portal_data::messages))
        .route("/api/rust/patient/settings", get(portal_data::settings))
        .route("/api/rust/patient/labs", post(portal_labs::submit))
        .route(
            "/api/rust/patient/notifications",
            get(portal_notifications::list),
        )
        .route(
            "/api/rust/patient/notifications/unread-count",
            get(portal_notifications::unread),
        )
        .route(
            "/api/rust/patient/notifications/{id}/read",
            post(portal_notifications::mark),
        )
        .route(
            "/api/rust/patient/notifications/read-all",
            post(portal_notifications::mark_all),
        )
        .route("/api/rust/patient/contact", post(portal_actions::contact))
        .route(
            "/api/rust/patient/appointments/{id}/response",
            post(portal_actions::respond),
        )
        .route(
            "/api/rust/patient/messages/{id}/acknowledge",
            post(portal_actions::acknowledge),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_user,
        ));
    Router::new()
        .route("/api/rust/auth/me", get(portal_auth::me))
        .route("/api/rust/auth/consent-notice", get(portal_auth::notice))
        .route(
            "/health/live",
            get(|| async { Json(serde_json::json!({"status":"ok"})) }),
        )
        .route(
            "/health/ready",
            get(|State(state): State<AppState>| async move {
                sqlx::query("SELECT 1 FROM ktp.users LIMIT 1")
                    .execute(&state.pool)
                    .await
                    .map_err(error::ApiError::from)?;
                Ok::<_, error::ApiError>(Json(serde_json::json!({"status":"ready"})))
            }),
        )
        .merge(protected)
        .merge(portal)
        .layer(middleware::from_fn(
            |request: axum::extract::Request, next: middleware::Next| async move {
                let mut response = next.run(request).await;
                response
                    .headers_mut()
                    .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
                response.headers_mut().insert(
                    header::X_CONTENT_TYPE_OPTIONS,
                    HeaderValue::from_static("nosniff"),
                );
                response
            },
        ))
        .with_state(state)
}
