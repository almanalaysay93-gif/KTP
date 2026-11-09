use crate::{AppState, admin_core, auth::Admin, error::ApiError, validation as v};
use axum::{
    Extension, Json,
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;
use std::{collections::HashMap, net::SocketAddr};

const ROLES: &[&str] = &["Nephrologist", "Fellow"];
const SETTINGS: &[(&str, &str)] = &[
    ("appTitle", "KTP"),
    ("orgName", "Organ Transplant Services"),
    ("contactEmail", ""),
    (
        "emergencyHotlineText",
        "KT Unit Hotline: 0917-000-0000 | Hospital Trunk: (082) 227-2731 loc 4100",
    ),
    (
        "consentNoticeText",
        "By accessing the KTP portal, you consent to the collection and processing of your health information under Republic Act No. 10173 (Data Privacy Act of 2012) for kidney transplant monitoring and care coordination.",
    ),
    ("consentVersion", "1"),
];

// Doctor and settings schemas preserve whitespace, unlike message text.
fn text(input: &Value, key: &str, min: usize, max: usize) -> Result<String, ApiError> {
    let text = input[key].as_str().ok_or(v::bad("Expected a string"))?;
    if !(min..=max).contains(&text.encode_utf16().count()) {
        return Err(v::bad("Invalid text length"));
    }
    Ok(text.to_owned())
}
fn optional_bool(input: &Value, key: &str) -> Result<Option<bool>, ApiError> {
    input
        .get(key)
        .map(|value| value.as_bool().ok_or(v::bad("Expected a boolean")))
        .transpose()
}
fn email_valid(email: &str) -> bool {
    if email.is_empty() {
        return true;
    }
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    let local_valid = !local.is_empty()
        && !local.starts_with('.')
        && !local.contains("..")
        && local
            .as_bytes()
            .last()
            .is_some_and(|b| b.is_ascii_alphanumeric() || b"_+-".contains(b))
        && local
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_'+-.".contains(&b));
    let labels: Vec<_> = domain.split('.').collect();
    local_valid
        && labels.len() >= 2
        && labels.iter().all(|label| {
            !label.is_empty()
                && label
                    .as_bytes()
                    .first()
                    .is_some_and(u8::is_ascii_alphanumeric)
                && label
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
        && labels
            .last()
            .is_some_and(|last| last.len() >= 2 && last.bytes().all(|b| b.is_ascii_alphabetic()))
}
fn settings_input(input: &Value) -> Result<Vec<(&'static str, String)>, ApiError> {
    v::allowed(
        input,
        &SETTINGS.iter().map(|(key, _)| *key).collect::<Vec<_>>(),
    )?;
    let mut values = Vec::new();
    // Preserve Node schema order in updatedKeys regardless of JSON key order.
    for (key, max) in [
        ("emergencyHotlineText", 1000),
        ("consentNoticeText", 5000),
        ("consentVersion", 0),
        ("appTitle", 128),
        ("orgName", 128),
        ("contactEmail", usize::MAX),
    ] {
        if input.get(key).is_none() {
            continue;
        }
        let value = if key == "consentVersion" {
            input[key]
                .as_u64()
                .filter(|n| *n >= 1 && *n <= 9_007_199_254_740_991)
                .ok_or(v::bad("Invalid consent version"))?
                .to_string()
        } else {
            text(input, key, 0, max)?
        };
        if key == "contactEmail" && !email_valid(&value) {
            return Err(v::bad("Invalid email address"));
        }
        values.push((key, value));
    }
    Ok(values)
}

pub async fn read(
    State(state): State<AppState>,
    Path(operation): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {
    match operation.as_str() {
        "doctors" => {
            if query
                .keys()
                .any(|key| !["role", "activeOnly"].contains(&key.as_str()))
            {
                return Err(v::bad("Unknown query field"));
            }
            let role = query.get("role");
            if role.is_some_and(|role| !ROLES.contains(&role.as_str())) {
                return Err(v::bad("Invalid doctor role"));
            }
            let active_only = match query.get("activeOnly").map(String::as_str) {
                None | Some("true") => true,
                Some("false") => false,
                _ => return Err(v::bad("Expected a boolean")),
            };
            let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(
                "SELECT to_jsonb(d) FROM ktp.doctors d WHERE (NOT $1 OR active) AND ($2::text IS NULL OR role=$2) ORDER BY name")
                .bind(active_only).bind(role).fetch_all(&state.pool).await?;
            Ok(Json(json!(
                rows.into_iter().map(|row| row.0.0).collect::<Vec<_>>()
            )))
        }
        "doctor" => {
            if query.keys().any(|key| key != "id") {
                return Err(v::bad("Unknown query field"));
            }
            let id = query
                .get("id")
                .and_then(|s| s.parse::<i32>().ok())
                .filter(|id| *id > 0)
                .ok_or(v::bad("Invalid identifier"))?;
            let row: Option<(SqlJson<Value>,)> =
                sqlx::query_as("SELECT to_jsonb(d) FROM ktp.doctors d WHERE id=$1")
                    .bind(id)
                    .fetch_optional(&state.pool)
                    .await?;
            Ok(Json(
                row.ok_or(ApiError(StatusCode::NOT_FOUND, "Doctor not found"))?
                    .0
                    .0,
            ))
        }
        "settings" => {
            if !query.is_empty() {
                return Err(v::bad("Unknown query field"));
            }
            let rows: Vec<(String, String)> =
                sqlx::query_as("SELECT key,value FROM ktp.\"appSettings\"")
                    .fetch_all(&state.pool)
                    .await?;
            let values: HashMap<_, _> = rows.into_iter().collect();
            let output: serde_json::Map<String, Value> = SETTINGS
                .iter()
                .map(|(key, default)| {
                    (
                        (*key).to_owned(),
                        json!(values.get(*key).map(String::as_str).unwrap_or(default)),
                    )
                })
                .collect();
            Ok(Json(Value::Object(output)))
        }
        _ => Err(ApiError(StatusCode::NOT_FOUND, "Unknown admin operation")),
    }
}

pub async fn mutate(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(operation): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let mut tx = admin_core::begin(&state, &admin).await?;
    let result = match operation.as_str() {
        "createDoctor" => {
            v::allowed(&input, &["name", "role", "active"])?;
            let name = text(&input, "name", 1, 128)?;
            let role = v::choice(&input, "role", ROLES)?;
            let active = optional_bool(&input, "active")?.unwrap_or(true);
            let (SqlJson(row),): (SqlJson<Value>,) = sqlx::query_as(
                "INSERT INTO ktp.doctors AS d (name,role,active) VALUES ($1,$2,$3) RETURNING to_jsonb(d)",
            )
            .bind(name)
            .bind(role)
            .bind(active)
            .fetch_one(&mut *tx)
            .await?;
            row
        }
        "updateDoctor" => {
            v::allowed(&input, &["id", "name", "role", "active"])?;
            let id = v::id(&input, "id")?;
            let name = input
                .get("name")
                .map(|_| text(&input, "name", 1, 128))
                .transpose()?;
            let role = input
                .get("role")
                .map(|_| v::choice(&input, "role", ROLES))
                .transpose()?;
            let active = optional_bool(&input, "active")?;
            let row: Option<(SqlJson<Value>,)> = sqlx::query_as(
                r#"UPDATE ktp.doctors AS d SET name=COALESCE($2,name),role=COALESCE($3,role),active=COALESCE($4,active),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 RETURNING to_jsonb(d)"#)
                .bind(id).bind(name).bind(role).bind(active).fetch_optional(&mut *tx).await?;
            row.ok_or(ApiError(StatusCode::NOT_FOUND, "Doctor not found"))?
                .0
                .0
        }
        "updateSettings" => {
            let values = settings_input(&input)?;
            for (key, value) in &values {
                sqlx::query(r#"INSERT INTO ktp."appSettings" (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,"updatedAt"=CURRENT_TIMESTAMP"#)
                    .bind(key).bind(value).execute(&mut *tx).await?;
            }
            admin_core::audit(
                &mut tx,
                admin.id,
                None,
                "UPDATE_SETTINGS",
                json!({"updatedKeys":values.iter().map(|(key,_)|*key).collect::<Vec<_>>()}),
                peer,
                &headers,
            )
            .await?;
            json!({"success":true})
        }
        _ => return Err(ApiError(StatusCode::NOT_FOUND, "Unknown admin operation")),
    };
    tx.commit().await?;
    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn settings_preserve_whitespace_and_report_schema_order() {
        assert_eq!(
            settings_input(&json!({"appTitle":"  KTP  ","consentVersion":2})).unwrap(),
            vec![
                ("consentVersion", "2".into()),
                ("appTitle", "  KTP  ".into())
            ]
        );
        assert!(settings_input(&json!({"contactEmail":"bad"})).is_err());
        assert!(settings_input(&json!({"consentVersion":0})).is_err());
        assert!(settings_input(&json!({"orgName":null})).is_err());
        assert!(settings_input(&json!({"contactEmail":""})).is_ok());
    }
}
