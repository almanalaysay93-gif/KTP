use crate::{
    AppState,
    auth::{self, Admin},
    error::ApiError,
    validation,
};
use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction, types::Json as SqlJson};

pub struct Write {
    pub tx: Transaction<'static, Postgres>,
    pub patient: Value,
    pub patient_id: i32,
    pub actor: i32,
}
impl Write {
    pub async fn audit(&mut self, action: &str, id: i32, extra: Value) -> Result<(), ApiError> {
        let mut details = json!({"id":id});
        if let Some(extra) = extra.as_object() {
            for (key, value) in extra {
                details[key] = value.clone();
            }
        }
        sqlx::query(r#"INSERT INTO ktp."activityLog" ("actorUserId","patientId",action,details) VALUES ($1,$2,$3,$4)"#)
            .bind(self.actor).bind(self.patient_id).bind(action).bind(details.to_string()).execute(&mut *self.tx).await?;
        Ok(())
    }
}
pub async fn begin(state: &AppState, admin: &Admin, input: &Value) -> Result<Write, ApiError> {
    let patient_id = validation::id(input, "patientId")?;
    let mut tx = state.pool.begin().await?;
    let user: Option<(Option<String>,)> =
        sqlx::query_as("SELECT email FROM ktp.users WHERE id=$1 FOR SHARE")
            .bind(admin.id)
            .fetch_optional(&mut *tx)
            .await?;
    if !user.is_some_and(|r| auth::has_full_access(r.0.as_deref().unwrap_or_default())) {
        return Err(ApiError(StatusCode::FORBIDDEN, "Admin access required"));
    }
    // A patient lock serializes overlapping batches and corrections without
    // introducing new database constraints or allowing duplicate lab bundles.
    let row: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(p) FROM ktp.patients p WHERE id=$1 FOR UPDATE")
            .bind(patient_id)
            .fetch_optional(&mut *tx)
            .await?;
    let patient = row
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Patient not found"))?
        .0
        .0;
    Ok(Write {
        tx,
        patient,
        patient_id,
        actor: admin.id,
    })
}

fn numeric(raw: &str) -> Option<f64> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Some(0.0);
    }
    for (prefix, radix) in [
        ("0x", 16),
        ("0X", 16),
        ("0b", 2),
        ("0B", 2),
        ("0o", 8),
        ("0O", 8),
    ] {
        if let Some(digits) = raw.strip_prefix(prefix) {
            return u64::from_str_radix(digits, radix).ok().map(|n| n as f64);
        }
    }
    raw.parse::<f64>().ok().filter(|n| n.is_finite())
}
pub fn lab_flag(value: &str, low: &Value, high: &Value) -> Option<&'static str> {
    let number = numeric(value)?;
    let bound = |v: &Value| {
        if v.is_null() || v.as_str().is_some_and(|s| s.trim().is_empty()) {
            None
        } else if let Some(s) = v.as_str() {
            numeric(s)
        } else {
            v.as_f64().filter(|n| n.is_finite())
        }
    };
    let (low, high) = (bound(low), bound(high));
    if low.is_none() && high.is_none() {
        None
    } else if low.is_some_and(|n| number < n) {
        Some("Low")
    } else if high.is_some_and(|n| number > n) {
        Some("High")
    } else {
        Some("Normal")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn flags_respect_saved_ranges_and_non_numeric_results() {
        assert_eq!(lab_flag("1.2", &json!("1"), &json!("2")), Some("Normal"));
        assert_eq!(lab_flag("0", &json!("1"), &json!("2")), Some("Low"));
        assert_eq!(lab_flag("3", &json!("1"), &json!("2")), Some("High"));
        assert_eq!(lab_flag("negative", &json!("1"), &json!("2")), None);
        assert_eq!(lab_flag("10", &Value::Null, &json!("")), None);
        assert_eq!(lab_flag("0x10", &json!("1"), &json!("15")), Some("High"));
    }
}
