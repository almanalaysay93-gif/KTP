use crate::{AppState, auth::SessionUser, error::ApiError};
use axum::http::{HeaderMap, StatusCode};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction, types::Json as SqlJson};
use std::net::SocketAddr;

pub struct PatientAccess {
    pub tx: Transaction<'static, Postgres>,
    pub patient: Value,
    pub user: Value,
    pub version: i32,
}

pub fn consent_version(value: Option<&str>) -> Result<i32, ApiError> {
    match value {
        None => Ok(1),
        Some(value) => value
            .trim()
            .parse::<i32>()
            .ok()
            .filter(|v| *v > 0)
            .ok_or(ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Invalid consent configuration",
            )),
    }
}

pub fn consent_required(patient: &Value, version: i32) -> bool {
    patient["consentVersion"].as_i64().unwrap_or(0) < i64::from(version)
}

/// Lock current user, consent settings, and patient so mutations cannot proceed
/// on an enrollment or email that changed after middleware authenticated it.
pub async fn begin(
    state: &AppState,
    user: &SessionUser,
    enforce_consent: bool,
) -> Result<PatientAccess, ApiError> {
    let mut tx = state.pool.begin().await?;
    let current: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(u) FROM ktp.users u WHERE id=$1 FOR UPDATE")
            .bind(user.id)
            .fetch_optional(&mut *tx)
            .await?;
    let user = current
        .ok_or(ApiError(StatusCode::UNAUTHORIZED, "Invalid session"))?
        .0
        .0;
    let email = user["email"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    if email.is_empty() {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "Patient access required",
        ));
    }
    let setting: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM ktp.\"appSettings\" WHERE key='consentVersion' FOR SHARE",
    )
    .fetch_optional(&mut *tx)
    .await?;
    let version = consent_version(setting.as_ref().map(|s| s.0.as_str()))?;
    let linked: Option<(SqlJson<Value>,)> = sqlx::query_as(
        "SELECT to_jsonb(p) FROM ktp.patients p WHERE \"linkedUserId\"=$1 FOR UPDATE",
    )
    .bind(user["id"].as_i64().unwrap() as i32)
    .fetch_optional(&mut *tx)
    .await?;
    let patient = if let Some((SqlJson(patient),)) = linked {
        patient
    } else {
        // Never take an enrollment already owned by a different Google account.
        let row: Option<(SqlJson<Value>,)> = sqlx::query_as(r#"UPDATE ktp.patients SET "linkedUserId"=$1, "updatedAt"=now()
            WHERE lower("accountEmail")=$2 AND status='Active' AND "linkedUserId" IS NULL RETURNING to_jsonb(patients.*)"#)
            .bind(user["id"].as_i64().unwrap() as i32).bind(&email).fetch_optional(&mut *tx).await?;
        row.ok_or(ApiError(
            StatusCode::UNAUTHORIZED,
            "Patient access required",
        ))?
        .0
        .0
    };
    let patient_email = patient["accountEmail"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_lowercase();
    if patient["status"] != "Active" || patient_email.is_empty() || patient_email != email {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "Patient access required",
        ));
    }
    if enforce_consent && consent_required(&patient, version) {
        return Err(ApiError(StatusCode::FORBIDDEN, "CONSENT_REQUIRED"));
    }
    Ok(PatientAccess {
        tx,
        patient,
        user,
        version,
    })
}

pub async fn audit(
    access: &mut PatientAccess,
    peer: SocketAddr,
    headers: &HeaderMap,
    action: &str,
    details: Value,
) -> Result<(), ApiError> {
    let original = peer
        .ip()
        .is_loopback()
        .then(|| headers.get("x-ktp-client-ip"))
        .flatten()
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<std::net::IpAddr>().ok());
    let ip = original.unwrap_or(peer.ip()).to_string();
    let agent = headers.get("user-agent").and_then(|v| v.to_str().ok());
    sqlx::query(r#"INSERT INTO ktp."activityLog" ("actorUserId","patientId",action,details,"ipAddress","userAgent") VALUES ($1,$2,$3,$4,$5,$6)"#)
        .bind(access.user["id"].as_i64().unwrap() as i32).bind(access.patient["id"].as_i64().unwrap() as i32)
        .bind(action).bind(details.to_string()).bind(ip).bind(agent).execute(&mut *access.tx).await?;
    Ok(())
}

pub fn access_json(access: &PatientAccess) -> Value {
    json!({"patient":access.patient,"consentRequired":consent_required(&access.patient, access.version)})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_version_defaults_but_malformed_versions_fail_closed() {
        assert_eq!(consent_version(None).unwrap(), 1);
        assert_eq!(consent_version(Some(" 2 ")).unwrap(), 2);
        for value in ["", "0", "-1", "NaN", "2junk", "1.5", "2147483648"] {
            assert!(consent_version(Some(value)).is_err(), "{value}");
        }
        assert!(consent_required(&json!({"consentVersion":null}), 1));
        assert!(!consent_required(&json!({"consentVersion":2}), 2));
    }
}
