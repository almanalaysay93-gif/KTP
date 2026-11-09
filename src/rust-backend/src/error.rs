use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError(pub StatusCode, pub &'static str);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": self.1}))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        if error
            .as_database_error()
            .is_some_and(|e| e.is_unique_violation())
        {
            return Self(StatusCode::CONFLICT, "Record already exists");
        }
        // SQL errors can contain patient values. Never log their text.
        tracing::error!(kind = ?error.as_database_error().map(|e| e.code()), "database operation failed");
        Self(StatusCode::SERVICE_UNAVAILABLE, "Database unavailable")
    }
}
