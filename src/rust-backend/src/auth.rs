use crate::{AppState, error::ApiError};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use sqlx::types::Json as SqlJson;

const ADMIN_EMAILS: [&str; 3] = [
    "nncluster@spmcdvo.net",
    "share@spmcdvo.net",
    "almanalaysay93@gmail.com",
];

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Claims {
    pub open_id: String,
    pub exp: u64,
    pub credential_revision: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Admin {
    pub id: i32,
    pub name: Option<String>,
    pub email: String,
}

#[derive(Clone, Debug)]
pub struct SessionUser {
    pub id: i32,
    pub data: Value,
}

pub fn has_full_access(email: &str) -> bool {
    if std::env::var("KTP_LOCAL_MODE").as_deref() == Ok("1") {
        return email.trim().eq_ignore_ascii_case("local.admin@localhost");
    }
    ADMIN_EMAILS.contains(&email.trim().to_lowercase().as_str())
}

pub fn verify_session(headers: &HeaderMap, secret: &[u8]) -> Result<Claims, ApiError> {
    let token = headers
        .get_all(axum::http::header::COOKIE)
        .iter()
        .filter_map(|h| h.to_str().ok())
        .flat_map(|h| h.split(';'))
        .filter_map(|part| part.trim().split_once('='))
        .find_map(|(key, value)| (key == "app_session_id").then_some(value))
        .ok_or(ApiError(StatusCode::UNAUTHORIZED, "Invalid session"))?;
    let mut validation = Validation::new(Algorithm::HS256);
    validation.leeway = 0;
    validation.validate_nbf = true;
    let claims = decode::<Claims>(token, &DecodingKey::from_secret(secret), &validation)
        .map_err(|_| ApiError(StatusCode::UNAUTHORIZED, "Invalid session"))?
        .claims;
    if claims.open_id.trim().is_empty() {
        return Err(ApiError(StatusCode::UNAUTHORIZED, "Invalid session"));
    }
    if std::env::var("KTP_LOCAL_MODE").as_deref() == Ok("1") {
        let revision = std::env::var("LOCAL_APP_DATA_DIR")
            .ok()
            .and_then(|dir| std::fs::read(std::path::Path::new(&dir).join("credentials.json")).ok())
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
            .and_then(|value| value["revision"].as_str().map(str::to_owned));
        if claims.open_id != "ktp-local-admin"
            || revision.is_none()
            || claims.credential_revision != revision
        {
            return Err(ApiError(StatusCode::UNAUTHORIZED, "Invalid local session"));
        }
    }
    Ok(claims)
}

pub async fn load_user(pool: &PgPool, claims: &Claims) -> Result<SessionUser, ApiError> {
    let user: Option<(SqlJson<Value>,)> = sqlx::query_as(
        r#"UPDATE ktp.users SET
            role = CASE WHEN lower(btrim(email)) = ANY($2) THEN 'admin' ELSE 'user' END,
            "lastSignedIn" = now(), "updatedAt" = now()
            WHERE "openId" = $1 RETURNING to_jsonb(users.*)"#,
    )
    .bind(&claims.open_id)
    .bind(if std::env::var("KTP_LOCAL_MODE").as_deref() == Ok("1") {
        vec!["local.admin@localhost"]
    } else {
        ADMIN_EMAILS.to_vec()
    })
    .fetch_optional(pool)
    .await?;
    let (SqlJson(data),) = user.ok_or(ApiError(StatusCode::UNAUTHORIZED, "Invalid session"))?;
    Ok(SessionUser {
        id: data["id"].as_i64().expect("database user id") as i32,
        data,
    })
}

pub async fn load_admin(pool: &PgPool, claims: &Claims) -> Result<Admin, ApiError> {
    let user = load_user(pool, claims).await?;
    let email = user.data["email"].as_str().unwrap_or_default().to_owned();
    if !has_full_access(&email) {
        return Err(ApiError(StatusCode::FORBIDDEN, "Admin access required"));
    }
    Ok(Admin {
        id: user.id,
        name: user.data["name"].as_str().map(str::to_owned),
        email,
    })
}

pub async fn require_user(
    State(state): State<AppState>,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, ApiError> {
    let claims = verify_session(request.headers(), &state.secret)?;
    let user = load_user(&state.pool, &claims).await?;
    request.extensions_mut().insert(user);
    Ok(next.run(request).await)
}

pub async fn require_admin(
    State(state): State<AppState>,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, ApiError> {
    let claims = verify_session(request.headers(), &state.secret)?;
    let admin = load_admin(&state.pool, &claims).await?;
    request.extensions_mut().insert(admin);
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{EncodingKey, Header, encode};
    use std::time::{SystemTime, UNIX_EPOCH};

    const KEY: &[u8] = b"test-only-key-for-session-contract-32bytes";

    fn headers(claims: serde_json::Value, algorithm: Algorithm, key: &[u8]) -> HeaderMap {
        let token = encode(
            &Header::new(algorithm),
            &claims,
            &EncodingKey::from_secret(key),
        )
        .unwrap();
        let mut headers = HeaderMap::new();
        headers.insert(
            "cookie",
            format!("other=x; app_session_id={token}; tail=y")
                .parse()
                .unwrap(),
        );
        headers
    }

    #[test]
    fn accepts_node_shape_without_iat_and_ignores_token_privileges() {
        let exp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 600;
        let headers = headers(
            serde_json::json!({"openId":"google-sub", "exp":exp, "appId":"app", "name":"Test", "role":"admin"}),
            Algorithm::HS256,
            KEY,
        );
        assert_eq!(verify_session(&headers, KEY).unwrap().open_id, "google-sub");
    }

    #[test]
    fn rejects_missing_expired_wrong_key_algorithm_and_empty_subject() {
        assert!(verify_session(&HeaderMap::new(), KEY).is_err());
        for claims in [
            serde_json::json!({"openId":"x","exp":1}),
            serde_json::json!({"openId":"x"}),
            serde_json::json!({"openId":" ","exp":4102444800_u64}),
            serde_json::json!({"openId":"x","exp":4102444800_u64,"nbf":4102444700_u64}),
        ] {
            assert!(verify_session(&headers(claims, Algorithm::HS256, KEY), KEY).is_err());
        }
        let claims = serde_json::json!({"openId":"x","exp":4102444800_u64});
        assert!(verify_session(&headers(claims.clone(), Algorithm::HS256, b"wrong"), KEY).is_err());
        assert!(verify_session(&headers(claims, Algorithm::HS384, KEY), KEY).is_err());
    }

    #[test]
    fn uses_exact_normalized_allowlist() {
        assert!(has_full_access("  ALMANALAYSAY93@GMAIL.COM "));
        assert!(!has_full_access("admin@example.com"));
        assert!(!has_full_access("almanalaysay93@gmail.com.attacker.test"));
    }
}
