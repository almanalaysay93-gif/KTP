use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use ktp_backend::{AppState, app};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tower::ServiceExt;

#[tokio::test]
async fn health_and_unauthenticated_requests_need_no_database_connection() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://unused:unused@127.0.0.1:1/unused")
        .unwrap();
    let app = app(AppState {
        pool,
        secret: Arc::from(b"test-only-secret-at-least-32-bytes".as_slice()),
    });
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health/live")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["cache-control"], "no-store");
    for path in [
        "/api/rust/session",
        "/api/rust/patients",
        "/api/rust/patients/1",
        "/api/rust/metrics",
        "/api/rust/clinical/patients/1",
        "/api/rust/patient/access",
        "/api/rust/patient/profile",
        "/api/rust/patient/clinical",
        "/api/rust/patient/messages",
        "/api/rust/patient/settings",
        "/api/rust/patient/notifications",
        "/api/rust/patient/notifications/unread-count",
        "/api/rust/doctors",
        "/api/rust/admin/entities/settings",
        "/api/rust/admin/messages",
        "/api/rust/admin/automations/config",
        "/api/rust/admin/patient-activity",
        "/api/rust/clinical/appointments",
        "/api/rust/clinical/z-benefit",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(response.headers()["cache-control"], "no-store");
    }
    for path in [
        "/api/rust/patient/consent",
        "/api/rust/patient/contact",
        "/api/rust/patient/labs",
        "/api/rust/patient/appointments/1/response",
        "/api/rust/patient/messages/1/acknowledge",
        "/api/rust/patient/notifications/1/read",
        "/api/rust/patient/notifications/read-all",
        "/api/rust/admin/patients/create",
        "/api/rust/admin/entities/updateSettings",
        "/api/rust/admin/messages",
        "/api/rust/admin/patient-import/commit",
        "/api/rust/admin/automations/runManualSweep",
        "/api/rust/clinical/actions/addServiceRecord",
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
    }
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/rust/auth/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        axum::body::to_bytes(response.into_body(), 1024)
            .await
            .unwrap()
            .as_ref(),
        b"null"
    );
}
