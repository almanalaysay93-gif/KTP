use crate::{auth, error::ApiError, validation as v};
use serde_json::{Value, json};

pub const FIELDS: &[&str] = &[
    "hrn",
    "patientType",
    "firstName",
    "middleName",
    "lastName",
    "suffix",
    "sex",
    "birthDate",
    "contactNumber",
    "accountEmail",
    "nephrologistId",
    "fellowId",
    "stage",
    "riskCategory",
    "surgeryDate",
    "linkedRecipientId",
    "followupMonths",
    "status",
    "photoFileId",
];

fn raw_text(value: &Value, min: usize, max: usize) -> Result<(), ApiError> {
    let text = value.as_str().ok_or(v::bad("Expected a string"))?;
    if !(min..=max).contains(&text.encode_utf16().count()) {
        return Err(v::bad("Invalid text length"));
    }
    Ok(())
}

fn email(text: &str) -> bool {
    let Some((local, domain)) = text.split_once('@') else {
        return false;
    };
    // Match Zod 4's default email expression used by the existing router.
    !local.is_empty()
        && !local.starts_with('.')
        && local
            .bytes()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric() || b"_+-".contains(&c))
        && !local.contains("..")
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

pub fn normalize(input: &Value, partial: bool) -> Result<Value, ApiError> {
    v::allowed(input, FIELDS)?;
    let mut out = input.clone();
    for (key, min, max, required) in [
        ("hrn", 1, 64, true),
        ("firstName", 1, 128, true),
        ("lastName", 1, 128, true),
        ("middleName", 0, 128, false),
        ("suffix", 0, 32, false),
        ("contactNumber", 0, 32, false),
        ("stage", 1, 32, true),
    ] {
        match input.get(key) {
            None if required && !partial => return Err(v::bad("Required patient field missing")),
            Some(Value::Null) if !required => {}
            Some(value) => raw_text(value, min, max)?,
            None => {}
        }
    }
    for (key, choices, nullable, required) in [
        ("patientType", &["Recipient", "Donor"][..], false, true),
        ("sex", &["M", "F"][..], true, false),
        ("riskCategory", &["StandardLow", "High"][..], true, false),
        (
            "status",
            &["Active", "Inactive", "Deceased", "Transferred"][..],
            false,
            false,
        ),
    ] {
        match input.get(key) {
            None if required && !partial => return Err(v::bad("Required patient field missing")),
            Some(Value::Null) if nullable => {}
            Some(_) => {
                v::choice(input, key, choices)?;
            }
            None => {}
        }
    }
    for key in [
        "nephrologistId",
        "fellowId",
        "linkedRecipientId",
        "photoFileId",
    ] {
        if input.get(key).is_some_and(|value| !value.is_null()) {
            v::id(input, key)?;
        }
    }
    for key in ["birthDate", "surgeryDate"] {
        if input.get(key).is_some_and(|value| !value.is_null()) {
            v::date(input, key, false)?;
        }
    }
    if let Some(value) = input.get("followupMonths")
        && !value.as_i64().is_some_and(|n| (1..=3).contains(&n))
    {
        return Err(v::bad("Follow-up months must be between 1 and 3"));
    }
    if let Some(value) = input.get("accountEmail")
        && !value.is_null()
    {
        let raw = value.as_str().ok_or(v::bad("Expected an e-mail address"))?;
        if raw.is_empty() {
            out["accountEmail"] = Value::Null;
        } else {
            let clean = raw.trim();
            if clean.encode_utf16().count() > 320 || !email(clean) {
                return Err(v::bad("Email address is not a valid e-mail address"));
            }
            out["accountEmail"] = json!(clean);
        }
    }
    if !partial {
        if out.get("followupMonths").is_none() {
            out["followupMonths"] = json!(1);
        }
        if out.get("status").is_none() {
            out["status"] = json!("Active");
        }
        if out.get("accountEmail").is_none() {
            out["accountEmail"] = Value::Null;
        }
    }
    Ok(out)
}

pub fn business(data: &Value, id: Option<i32>) -> Result<(), ApiError> {
    if data["accountEmail"]
        .as_str()
        .is_some_and(auth::has_full_access)
    {
        return Err(v::bad(
            "Patient email cannot be on the admin email allowlist",
        ));
    }
    let kind = data["patientType"].as_str().unwrap_or_default();
    let stage = data["stage"].as_str().unwrap_or_default();
    let stages = match kind {
        "Recipient" => &[
            "Orientation",
            "Phase1",
            "Phase2",
            "Clearances",
            "PhilHealthZ",
            "Phase3",
            "PostKT",
        ][..],
        "Donor" => &[
            "Orientation",
            "Phase1",
            "Phase2",
            "Clearances",
            "Phase3",
            "PostDonation",
        ][..],
        _ => return Err(v::bad("Invalid patient type")),
    };
    if !stages.contains(&stage) {
        return Err(v::bad("Stage is not valid for this patient type"));
    }
    if ["PostKT", "PostDonation"].contains(&stage)
        && !data["surgeryDate"].as_str().is_some_and(|s| !s.is_empty())
    {
        return Err(v::bad("Surgery date is required for this stage"));
    }
    if kind == "Donor" {
        let linked = v::id(data, "linkedRecipientId")
            .map_err(|_| v::bad("Living donor must be linked to a recipient"))?;
        if id == Some(linked) {
            return Err(v::bad("Donor cannot be linked to themselves"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn recipient() -> Value {
        json!({"hrn":"  H  ","firstName":" First ","lastName":"Last","patientType":"Recipient","stage":"Orientation"})
    }
    #[test]
    fn preserves_patient_text_and_optional_updates() {
        let saved = normalize(&recipient(), false).unwrap();
        assert_eq!(saved["hrn"], "  H  ");
        assert_eq!(saved["followupMonths"], 1);
        assert_eq!(saved["accountEmail"], Value::Null);
        assert_eq!(normalize(&json!({}), true).unwrap(), json!({}));
        assert_eq!(
            normalize(&json!({"accountEmail":""}), true).unwrap(),
            json!({"accountEmail":null})
        );
        assert_eq!(
            normalize(&json!({"accountEmail":" User@Example.com "}), true).unwrap()["accountEmail"],
            "User@Example.com"
        );
        assert!(normalize(&json!({"accountEmail":" "}), true).is_err());
        assert!(normalize(&json!({"firstName":null}), true).is_err());
    }
    #[test]
    fn rejects_sensitive_fields_bad_dates_and_business_rule_violations() {
        for key in [
            "actor",
            "linkedUserId",
            "consentVersion",
            "consentAcceptedAt",
        ] {
            let mut input = recipient();
            input[key] = json!(1);
            assert!(normalize(&input, false).is_err());
        }
        assert!(normalize(&json!({"birthDate":"2026-02-30"}), true).is_err());
        assert!(normalize(&json!({"followupMonths":4}), true).is_err());
        let mut data = recipient();
        data["stage"] = json!("PostKT");
        assert!(business(&data, None).is_err());
        data["surgeryDate"] = json!("2026-01-01");
        assert!(business(&data, None).is_ok());
        data["accountEmail"] = json!(" ALMANALAYSAY93@GMAIL.COM ");
        assert!(business(&data, None).is_err());
        data = recipient();
        data["patientType"] = json!("Donor");
        assert!(business(&data, None).is_err());
        data["linkedRecipientId"] = json!(4);
        assert!(business(&data, Some(4)).is_err());
        data["stage"] = json!("PhilHealthZ");
        assert!(business(&data, None).is_err());
    }
}
