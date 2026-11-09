use crate::error::ApiError;
use serde_json::{Value, json};
use sqlx::PgPool;
use std::time::Duration;

pub struct Delivery {
    pub id: i32,
    pub status: &'static str,
    pub uncertain: bool,
}

fn missing_key_status(production: bool) -> (&'static str, Option<&'static str>) {
    if production {
        ("failed", Some("Email provider is not configured"))
    } else {
        ("mock", None)
    }
}

pub fn valid_address(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !local.starts_with('.')
        && !local.contains("..")
        && local
            .bytes()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric() || b"_+-".contains(&c))
        && local
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_'+-.".contains(&c))
        && domain.contains('.')
        && domain.split('.').all(|label| {
            !label.is_empty()
                && !label.starts_with('-')
                && label
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'-')
        })
        && domain
            .rsplit('.')
            .next()
            .is_some_and(|s| s.len() >= 2 && s.bytes().all(|c| c.is_ascii_alphabetic()))
}

// Only the runtime dispatch path reads provider configuration. Tests exercise
// mock policy and templates without sending requests or reading credentials.
pub async fn send(
    pool: &PgPool,
    to: &str,
    template: &str,
    rendered: &Value,
    patient_id: Option<i32>,
    idempotency_key: Option<&str>,
) -> Result<Delivery, ApiError> {
    // Reserve the visible log before any external side effect. Failure here
    // proves no provider request was made and is safe for the outbox to retry.
    let (id,): (i32,) = sqlx::query_as(r#"INSERT INTO ktp."emailLogs" ("recipientEmail",subject,"templateName",status,"errorMessage","patientId") VALUES ($1,$2,$3,'pending','Delivery started; outcome not yet recorded',$4) RETURNING id"#)
        .bind(to).bind(rendered["subject"].as_str().unwrap_or_default()).bind(template)
        .bind(patient_id).fetch_one(pool).await?;
    let api_key = std::env::var("RESEND_API_KEY")
        .ok()
        .filter(|key| !key.is_empty() && std::env::var("KTP_LOCAL_MODE").as_deref() != Ok("1"));
    let mut uncertain = false;
    let (status, error) = if let Some(key) = api_key {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(5))
            .redirect(reqwest::redirect::Policy::none())
            .build();
        match client {
            Ok(client) => {
                let from = std::env::var("EMAIL_FROM")
                    .ok()
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "KTP Notifications <notifications@spmcdvo.net>".into());
                let mut request = client
                    .post("https://api.resend.com/emails")
                    .bearer_auth(key)
                    .json(&json!({"from":from,"to":[to],"subject":rendered["subject"],
                        "html":rendered["html"],"text":rendered["text"]}));
                if let Some(key) = idempotency_key {
                    request = request.header("Idempotency-Key", key);
                }
                match request.send().await {
                    Ok(response) if response.status().is_success() => ("sent", None),
                    Ok(_) => ("failed", Some("Email provider rejected delivery")),
                    Err(_) => {
                        // A timeout can happen after provider acceptance. Do not
                        // automatically resend an outcome we cannot establish.
                        uncertain = true;
                        (
                            "failed",
                            Some("Email delivery unconfirmed; reconcile before retry"),
                        )
                    }
                }
            }
            Err(_) => ("failed", Some("Email provider client unavailable")),
        }
    } else {
        missing_key_status(
            std::env::var("NODE_ENV").is_ok_and(|value| value == "production")
                && std::env::var("KTP_LOCAL_MODE").as_deref() != Ok("1"),
        )
    };
    if let Err(error) =
        sqlx::query(r#"UPDATE ktp."emailLogs" SET status=$2,"errorMessage"=$3 WHERE id=$1"#)
            .bind(id)
            .bind(status)
            .bind(error)
            .execute(pool)
            .await
    {
        // Keep the known delivery outcome so the caller can finalize its outbox
        // reservation even when updating the audit log failed.
        let _ = ApiError::from(error);
        tracing::error!("Email delivery log requires reconciliation");
    }
    Ok(Delivery {
        id,
        status,
        uncertain,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn production_requires_provider_and_development_can_mock() {
        assert_eq!(missing_key_status(false), ("mock", None));
        assert_eq!(
            missing_key_status(true),
            ("failed", Some("Email provider is not configured"))
        );
    }
    #[test]
    fn test_recipient_validation_matches_router_email_rules() {
        assert!(valid_address("clinic+test@example.com"));
        for value in [
            "",
            "a@b",
            "a..b@example.com",
            "a.@example.com",
            "a@example.com\n",
        ] {
            assert!(!valid_address(value));
        }
    }
}
