use crate::{AppState, admin_core, auth::Admin, error::ApiError, validation as v};
use axum::{Extension, Json, extract::State};
use serde_json::{Value, json};
use sqlx::{Postgres, QueryBuilder, types::Json as SqlJson};

struct Broadcast {
    subject: String,
    body: String,
    target_type: String,
    stage: Option<String>,
    patient_id: Option<i32>,
}
fn validate(input: &Value) -> Result<Broadcast, ApiError> {
    v::allowed(
        input,
        &[
            "subject",
            "body",
            "targetType",
            "targetStage",
            "targetPatientId",
        ],
    )?;
    let subject = v::string(input, "subject", 1, 200)?;
    let body = v::string(input, "body", 1, 4000)?;
    let target_type = v::choice(
        input,
        "targetType",
        &["All", "Recipient", "Donor", "Stage", "Specific"],
    )?;
    let stage = input
        .get("targetStage")
        .map(|value| {
            value
                .as_str()
                .map(str::to_owned)
                .ok_or(v::bad("Expected a string"))
        })
        .transpose()?;
    let patient_id = input
        .get("targetPatientId")
        .map(|_| v::id(input, "targetPatientId"))
        .transpose()?;
    // A missing scope must never turn a targeted message into a broadcast.
    if target_type == "Stage" && stage.as_deref().is_none_or(|s| s.trim().is_empty()) {
        return Err(v::bad("Choose a target stage"));
    }
    if target_type == "Specific" && patient_id.is_none() {
        return Err(v::bad("Choose a target patient"));
    }
    Ok(Broadcast {
        subject,
        body,
        target_type,
        stage,
        patient_id,
    })
}
fn preview(body: &str) -> String {
    // Match JavaScript slice(0,150), including replacement of a split surrogate
    // when the driver encodes the notification as UTF-8.
    String::from_utf16_lossy(&body.encode_utf16().take(150).collect::<Vec<_>>())
}

pub async fn create(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let input = validate(&input)?;
    let mut tx = admin_core::begin(&state, &admin).await?;
    let mut query: QueryBuilder<Postgres> =
        QueryBuilder::new("SELECT id FROM ktp.patients WHERE status='Active'");
    match input.target_type.as_str() {
        "Recipient" | "Donor" => {
            query
                .push(" AND \"patientType\"=")
                .push_bind(&input.target_type);
        }
        "Stage" => {
            query
                .push(" AND stage=")
                .push_bind(input.stage.as_deref().unwrap());
        }
        "Specific" => {
            query.push(" AND id=").push_bind(input.patient_id.unwrap());
        }
        _ => {}
    }
    // Keep selected patients active through commit while enrollment/status
    // changes wait, so delivered recipients match the validated target.
    query.push(" ORDER BY id FOR SHARE");
    let recipients: Vec<(i32,)> = query.build_query_as().fetch_all(&mut *tx).await?;
    if recipients.is_empty() {
        return Err(v::bad(
            "No active patients match the chosen broadcast target",
        ));
    }
    let (id,): (i32,) = sqlx::query_as(r#"INSERT INTO ktp.messages ("senderUserId",subject,body,"targetType","targetStage","targetPatientId") VALUES ($1,$2,$3,$4,$5,$6) RETURNING id"#)
        .bind(admin.id).bind(&input.subject).bind(&input.body).bind(&input.target_type)
        .bind(&input.stage).bind(input.patient_id).fetch_one(&mut *tx).await?;
    let snippet = preview(&input.body);
    for (patient_id,) in &recipients {
        sqlx::query(
            r#"INSERT INTO ktp."messageRecipients" ("messageId","patientId") VALUES ($1,$2)"#,
        )
        .bind(id)
        .bind(patient_id)
        .execute(&mut *tx)
        .await?;
        sqlx::query(r#"INSERT INTO ktp.notifications ("patientId",title,message,type,"linkUrl") VALUES ($1,$2,$3,'info','/me/messages')"#)
            .bind(patient_id).bind(&input.subject).bind(&snippet).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(json!({"id":id,"recipientCount":recipients.len()})))
}

pub async fn list(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let rows: Vec<(SqlJson<Value>,)> = sqlx::query_as(r#"
        SELECT to_jsonb(r) FROM (
            SELECT m.id,m."senderUserId",m.subject,m.body,m."targetType",NULLIF(m."targetStage",'') AS "targetStage",m."targetPatientId",
                CAST(m."createdAt" AS TEXT) AS "createdAt",
                (SELECT COUNT(*) FROM ktp."messageRecipients" mr WHERE mr."messageId"=m.id) AS "recipientCount",
                (SELECT COUNT(*) FROM ktp."messageRecipients" mr WHERE mr."messageId"=m.id AND mr."readAt" IS NOT NULL) AS "readCount",
                (SELECT COUNT(*) FROM ktp."messageAcknowledgments" ma WHERE ma."messageId"=m.id) AS "acknowledgedCount"
            FROM ktp.messages m ORDER BY m.id DESC
        ) r"#).fetch_all(&state.pool).await?;
    Ok(Json(json!(
        rows.into_iter().map(|row| row.0.0).collect::<Vec<_>>()
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scoped_messages_require_target_and_trim_content() {
        for target in ["Stage", "Specific"] {
            assert!(validate(&json!({"subject":"Hi","body":"News","targetType":target})).is_err());
        }
        assert!(
            validate(
                &json!({"subject":"Hi","body":"News","targetType":"Stage","targetStage":"  "})
            )
            .is_err()
        );
        let message = validate(
            &json!({"subject":" Hi ","body":" News ","targetType":"Specific","targetPatientId":1}),
        )
        .unwrap();
        assert_eq!(message.subject, "Hi");
        assert_eq!(message.body, "News");
        assert_eq!(message.patient_id, Some(1));
    }
    #[test]
    fn previews_count_javascript_utf16_units() {
        assert_eq!(preview(&"a".repeat(200)), "a".repeat(150));
        assert_eq!(preview(&"🩺".repeat(100)), "🩺".repeat(75));
        assert_eq!(
            preview(&format!("{}🩺", "a".repeat(149))),
            format!("{}�", "a".repeat(149))
        );
    }
}
