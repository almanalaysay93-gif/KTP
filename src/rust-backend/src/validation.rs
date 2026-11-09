use crate::error::ApiError;
use axum::http::StatusCode;
use chrono::{FixedOffset, NaiveDate, Utc};
use serde_json::Value;
use std::collections::HashSet;

pub fn bad(message: &'static str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, message)
}
pub fn today() -> String {
    Utc::now()
        .with_timezone(&FixedOffset::east_opt(8 * 3600).unwrap())
        .format("%Y-%m-%d")
        .to_string()
}
pub fn allowed(value: &Value, fields: &[&str]) -> Result<(), ApiError> {
    let object = value.as_object().ok_or(bad("Expected an object"))?;
    if object.keys().any(|key| !fields.contains(&key.as_str())) {
        return Err(bad("Unknown input field"));
    }
    Ok(())
}
pub fn id(value: &Value, key: &str) -> Result<i32, ApiError> {
    value[key]
        .as_i64()
        .and_then(|n| i32::try_from(n).ok())
        .filter(|n| *n > 0)
        .ok_or(bad("Invalid identifier"))
}
pub fn string(value: &Value, key: &str, min: usize, max: usize) -> Result<String, ApiError> {
    let value = value[key].as_str().ok_or(bad("Expected a string"))?.trim();
    if !(min..=max).contains(&value.encode_utf16().count()) {
        return Err(bad("Invalid text length"));
    }
    Ok(value.to_owned())
}
pub fn opt_string(value: &Value, key: &str, max: usize) -> Result<Option<String>, ApiError> {
    if value.get(key).is_none() {
        Ok(None)
    } else {
        string(value, key, 0, max).map(Some)
    }
}
pub fn opt_bool(value: &Value, key: &str) -> Result<bool, ApiError> {
    match value.get(key) {
        None => Ok(false),
        Some(Value::Bool(b)) => Ok(*b),
        _ => Err(bad("Expected a boolean")),
    }
}
pub fn choice(value: &Value, key: &str, choices: &[&str]) -> Result<String, ApiError> {
    let text = value[key]
        .as_str()
        .filter(|s| choices.contains(s))
        .ok_or(bad("Invalid selection"))?;
    Ok(text.to_owned())
}
pub fn date(value: &Value, key: &str, past: bool) -> Result<String, ApiError> {
    let text = value[key]
        .as_str()
        .ok_or(bad("Use a valid calendar date"))?;
    let parsed = NaiveDate::parse_from_str(text, "%Y-%m-%d")
        .map_err(|_| bad("Use a valid calendar date"))?;
    if text.len() != 10 || parsed.format("%Y-%m-%d").to_string() != text || text < "1900-01-01" {
        return Err(bad("Use a valid calendar date"));
    }
    if past && text > today().as_str() {
        return Err(bad("Date cannot be in the future"));
    }
    Ok(text.to_owned())
}
pub fn opt_date(value: &Value, key: &str, past: bool) -> Result<Option<String>, ApiError> {
    if value.get(key).is_none() {
        Ok(None)
    } else {
        date(value, key, past).map(Some)
    }
}
pub const SERVICE_TYPES: &[&str] = &["Meds", "Laboratory", "Tacro", "XrayUsd"];
pub const LAB_PHASES: &[&str] = &["Phase1", "Phase2", "Phase3", "PostKT", "PostDonation"];
pub fn valid_phase(phase: &str, patient_type: &str) -> bool {
    LAB_PHASES.contains(&phase)
        && match patient_type {
            "Recipient" => phase != "PostDonation",
            "Donor" => phase != "PostKT",
            _ => false,
        }
}

pub struct LabValue {
    pub lab_test_id: i32,
    pub value: String,
}
pub fn results(
    value: &Value,
    key: &str,
    required: bool,
    allow_blank: bool,
) -> Result<Vec<LabValue>, ApiError> {
    let array = match value.get(key) {
        None if !required => return Ok(Vec::new()),
        Some(Value::Array(a)) => a,
        _ => return Err(bad("Expected laboratory results")),
    };
    if array.len() > 100 || (required && array.is_empty()) {
        return Err(bad("Invalid result count"));
    }
    let mut ids = HashSet::new();
    array
        .iter()
        .map(|row| {
            allowed(row, &["labTestId", "value"])?;
            let lab_test_id = id(row, "labTestId")?;
            if !ids.insert(lab_test_id) {
                return Err(bad("Each lab test may occur once"));
            }
            Ok(LabValue {
                lab_test_id,
                value: string(row, "value", usize::from(!allow_blank), 100)?,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn validates_real_calendar_dates_and_manila_future_dates() {
        for value in ["2026-02-30", "2026-2-03", "1899-12-31", "2026-09-01junk"] {
            assert!(date(&json!({"day":value}), "day", false).is_err());
        }
        assert!(date(&json!({"day":"2024-02-29"}), "day", true).is_ok());
        assert!(date(&json!({"day":"2999-01-01"}), "day", true).is_err());
    }
    #[test]
    fn distinguishes_missing_null_and_blank_and_rejects_duplicate_results() {
        assert_eq!(opt_string(&json!({}), "note", 10).unwrap(), None);
        assert!(opt_string(&json!({"note":null}), "note", 10).is_err());
        assert_eq!(
            opt_string(&json!({"note":"  "}), "note", 10).unwrap(),
            Some(String::new())
        );
        assert!(
            results(
                &json!({"results":[{"labTestId":1,"value":"1"},{"labTestId":1,"value":"2"}]}),
                "results",
                true,
                false
            )
            .is_err()
        );
    }
}
