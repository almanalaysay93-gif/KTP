use crate::{
    AppState, auth::SessionUser, clinical_core::lab_flag, error::ApiError, portal_access,
    validation as v,
};
use axum::{
    Extension, Json,
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
};
use serde_json::{Value, json};
use std::net::SocketAddr;

struct Upload {
    service_date: String,
    note: String,
    items: Vec<v::LabValue>,
}

fn validate(input: &Value) -> Result<Upload, ApiError> {
    v::allowed(input, &["serviceDate", "note", "items"])?;
    let service_date = v::date(input, "serviceDate", true)?;
    let note = v::opt_string(input, "note", 1000)?;
    let items = v::results(input, "items", true, false)?;
    let note = match note.as_deref().filter(|s| !s.is_empty()) {
        Some(note) => format!("[Patient Upload] {note} — Pending clinical verification"),
        None => "[Patient Upload] Pending clinical verification".to_owned(),
    };
    Ok(Upload {
        service_date,
        note,
        items,
    })
}

/// Patient reports remain separate from clinical staff's approved phase bundles.
/// The eligibility lock, report, values and patient audit share one transaction.
pub async fn submit(
    State(state): State<AppState>,
    Extension(user): Extension<SessionUser>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let input = validate(&input)?;
    let mut access = portal_access::begin(&state, &user, true).await?;
    let patient_id = v::id(&access.patient, "id")?;
    let (record_id,): (i32,) = sqlx::query_as(
        r#"INSERT INTO ktp."serviceRecords"
        ("patientId","serviceType",label,status,"dueDate","serviceDate",phase,note)
        VALUES ($1,'Laboratory','Patient self-uploaded lab report','Done',$2::date,$2::date,NULL,$3)
        RETURNING id"#,
    )
    .bind(patient_id)
    .bind(&input.service_date)
    .bind(&input.note)
    .fetch_one(&mut *access.tx)
    .await?;
    for item in &input.items {
        let catalog: Option<(Option<String>, Option<String>)> = sqlx::query_as(
            r#"SELECT low,high FROM ktp."labTests" WHERE id=$1 AND active=true FOR SHARE"#,
        )
        .bind(item.lab_test_id)
        .fetch_optional(&mut *access.tx)
        .await?;
        let (low, high) = catalog.ok_or(ApiError(StatusCode::NOT_FOUND, "Lab test not found"))?;
        let flag = lab_flag(&item.value, &json!(low), &json!(high));
        sqlx::query(
            r#"INSERT INTO ktp."labResults"
            ("serviceRecordId","labTestId",value,"lowSnapshot","highSnapshot",flag)
            VALUES ($1,$2,$3,$4,$5,$6)"#,
        )
        .bind(record_id)
        .bind(item.lab_test_id)
        .bind(&item.value)
        .bind(low)
        .bind(high)
        .bind(flag)
        .execute(&mut *access.tx)
        .await?;
    }
    portal_access::audit(
        &mut access,
        peer,
        &headers,
        "PATIENT_UPLOAD_LAB",
        json!({"serviceDate":input.service_date,"testCount":input.items.len()}),
    )
    .await?;
    access.tx.commit().await?;
    Ok(Json(json!({"success":true,"recordId":record_id})))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn upload() -> Value {
        json!({"serviceDate":"2024-02-29","items":[{"labTestId":1,"value":" 5.5 "}]})
    }

    #[test]
    fn normalizes_values_and_marks_every_report_pending_verification() {
        let mut source = upload();
        let parsed = validate(&source).unwrap();
        assert_eq!(parsed.items[0].value, "5.5");
        assert_eq!(
            parsed.note,
            "[Patient Upload] Pending clinical verification"
        );
        source["note"] = json!("  Follow-up report  ");
        assert_eq!(
            validate(&source).unwrap().note,
            "[Patient Upload] Follow-up report — Pending clinical verification"
        );
        source["note"] = json!("   ");
        assert_eq!(validate(&source).unwrap().note, parsed.note);
        source["note"] = Value::Null;
        assert!(validate(&source).is_err());
    }

    #[test]
    fn rejects_impersonation_fields_invalid_dates_and_duplicate_or_empty_items() {
        for key in [
            "patientId",
            "actor",
            "nurseApproved",
            "approvedByNurse",
            "phase",
        ] {
            let mut source = upload();
            source[key] = json!(1);
            assert!(validate(&source).is_err());
        }
        for date in ["2026-02-30", "1899-12-31", "2999-01-01", "2026-1-01"] {
            let mut source = upload();
            source["serviceDate"] = json!(date);
            assert!(validate(&source).is_err());
        }
        for items in [
            json!([]),
            json!([{"labTestId":1,"value":"1"},{"labTestId":1,"value":"2"}]),
            json!([{"labTestId":0,"value":"1"}]),
            json!([{"labTestId":2147483648_i64,"value":"1"}]),
            json!([{"labTestId":1,"value":"   "}]),
            json!([{"labTestId":1,"value":"1","patientId":2}]),
        ] {
            let mut source = upload();
            source["items"] = items;
            assert!(validate(&source).is_err());
        }
    }

    #[test]
    fn bounds_batch_and_text_lengths_in_utf16_units() {
        let mut source = upload();
        source["items"] = json!(
            (1..=100)
                .map(|id| json!({"labTestId":id,"value":"😀".repeat(50)}))
                .collect::<Vec<_>>()
        );
        source["note"] = json!("😀".repeat(500));
        assert!(validate(&source).is_ok());
        source["note"] = json!("😀".repeat(501));
        assert!(validate(&source).is_err());
        source["note"] = json!("");
        source["items"][0]["value"] = json!("😀".repeat(51));
        assert!(validate(&source).is_err());
        source["items"] = json!(
            (1..=101)
                .map(|id| json!({"labTestId":id,"value":"1"}))
                .collect::<Vec<_>>()
        );
        assert!(validate(&source).is_err());
    }
}
