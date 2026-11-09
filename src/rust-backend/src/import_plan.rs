use crate::{auth, error::ApiError, validation as v};
use chrono::NaiveDate;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

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
    "stage",
    "riskCategory",
    "surgeryDate",
    "status",
    "nephrologist",
    "fellow",
    "linkedRecipientHrn",
    "followupMonths",
];
pub struct Plan {
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub data: Value,
    pub linked_hrn: String,
}

pub fn validate(input: &Value, commit: bool) -> Result<&Vec<Value>, ApiError> {
    v::allowed(
        input,
        if commit {
            &["rows", "fileName"]
        } else {
            &["rows"]
        },
    )?;
    let rows = input["rows"]
        .as_array()
        .ok_or(v::bad("Expected patient rows"))?;
    if !(1..=200).contains(&rows.len()) {
        return Err(v::bad("Import must contain 1 to 200 patients"));
    }
    if commit {
        v::opt_string(input, "fileName", 255)?;
    }
    for row in rows {
        v::allowed(row, FIELDS)?;
        for (key, value) in row.as_object().unwrap() {
            if value.is_null() {
                continue;
            }
            if key == "followupMonths" {
                if value.is_number() {
                    continue;
                }
                if value
                    .as_str()
                    .is_some_and(|s| s.encode_utf16().count() <= 10)
                {
                    continue;
                }
            } else if value
                .as_str()
                .is_some_and(|s| s.encode_utf16().count() <= 400)
            {
                continue;
            }
            return Err(v::bad("Invalid patient import field"));
        }
    }
    Ok(rows)
}

pub fn text(row: &Value, key: &str) -> String {
    match &row[key] {
        Value::String(s) => s.trim().to_owned(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

fn doctor_key(name: &str) -> String {
    let lower = name.to_lowercase();
    let bytes = lower.as_bytes();
    let word = |b: u8| b.is_ascii_alphanumeric() || b == b'_';
    let mut cleaned = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let title = i + 2 <= bytes.len()
            && (&bytes[i..i + 2] == b"dr" || &bytes[i..i + 2] == b"md")
            && (i == 0 || !word(bytes[i - 1]))
            && (i + 2 == bytes.len() || !word(bytes[i + 2]));
        if title {
            let is_dr = &bytes[i..i + 2] == b"dr";
            i += 2;
            if is_dr && bytes.get(i) == Some(&b'.') {
                i += 1;
            }
        } else {
            cleaned.push(bytes[i]);
            i += 1;
        }
    }
    cleaned
        .split(|b| !b.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|s| String::from_utf8_lossy(s))
        .collect::<Vec<_>>()
        .join(" ")
}

fn valid_email(s: &str) -> bool {
    let Some((local, domain)) = s.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !s.chars().any(char::is_whitespace)
        && !domain.contains('@')
        && domain
            .char_indices()
            .any(|(index, c)| c == '.' && index > 0 && domain[index + 1..].chars().count() >= 2)
}

fn date_error(value: &str, label: &str, past: bool, today: &str) -> Option<String> {
    let valid = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .ok()
        .is_some_and(|date| {
            value.len() == 10
                && date.format("%Y-%m-%d").to_string() == value
                && value >= "1900-01-01"
        });
    if !valid {
        Some(format!("{label} must be a date in the form YYYY-MM-DD."))
    } else if past && value > today {
        Some(format!("{label} is in the future."))
    } else {
        None
    }
}

fn stage_valid(stage: &str, kind: &str) -> bool {
    match kind {
        "Recipient" => [
            "Orientation",
            "Phase1",
            "Phase2",
            "Clearances",
            "PhilHealthZ",
            "Phase3",
            "PostKT",
        ]
        .contains(&stage),
        "Donor" => [
            "Orientation",
            "Phase1",
            "Phase2",
            "Clearances",
            "Phase3",
            "PostDonation",
        ]
        .contains(&stage),
        _ => false,
    }
}

fn followup(row: &Value) -> Option<i32> {
    let raw = text(row, "followupMonths");
    if raw.is_empty() {
        return Some(1);
    }
    let parsed = if let Some(n) = row["followupMonths"].as_f64() {
        Some(n)
    } else {
        let mut prefixed = None;
        for (prefix, radix) in [
            ("0x", 16),
            ("0X", 16),
            ("0b", 2),
            ("0B", 2),
            ("0o", 8),
            ("0O", 8),
        ] {
            if let Some(digits) = raw.strip_prefix(prefix) {
                prefixed = Some(u64::from_str_radix(digits, radix).ok().map(|n| n as f64));
                break;
            }
        }
        prefixed.unwrap_or_else(|| raw.parse::<f64>().ok())
    }?;
    (parsed.is_finite() && parsed.fract() == 0.0 && (1.0..=3.0).contains(&parsed))
        .then_some(parsed as i32)
}

fn nullable(value: String) -> Value {
    if value.is_empty() {
        Value::Null
    } else {
        json!(value)
    }
}

pub fn plan(rows: &[Value], saved: &[Value], doctors: &[Value], today: &str) -> Vec<Plan> {
    let saved_hrns: HashMap<_, _> = saved
        .iter()
        .map(|row| (row["hrn"].as_str().unwrap_or_default().to_lowercase(), row))
        .collect();
    let saved_emails: HashSet<_> = saved
        .iter()
        .filter_map(|row| row["email"].as_str())
        .filter(|s| !s.is_empty())
        .collect();
    let mut hrn_count = HashMap::<String, usize>::new();
    let mut email_count = HashMap::<String, usize>::new();
    let mut types = HashMap::new();
    for row in rows {
        let hrn = text(row, "hrn").to_lowercase();
        *hrn_count.entry(hrn.clone()).or_default() += 1;
        let email = text(row, "accountEmail").to_lowercase();
        if !email.is_empty() {
            *email_count.entry(email).or_default() += 1;
        }
        types.insert(hrn, text(row, "patientType"));
    }
    rows.iter().map(|row|{
        let mut errors=Vec::new();let mut warnings=Vec::new();
        let hrn=text(row,"hrn");let kind=text(row,"patientType");let email=text(row,"accountEmail").to_lowercase();
        let stage=match text(row,"stage"){s if s.is_empty()=>"Orientation".to_owned(),s=>s};
        let birth=text(row,"birthDate");let surgery=text(row,"surgeryDate");let sex=text(row,"sex").to_uppercase();
        let risk=text(row,"riskCategory");let status=match text(row,"status"){s if s.is_empty()=>"Active".to_owned(),s=>s};
        let interval=followup(row);let linked=text(row,"linkedRecipientHrn");
        if hrn.is_empty(){errors.push("HRN is missing.".to_owned());}
        else if hrn.encode_utf16().count()>64{errors.push("HRN is longer than 64 characters.".to_owned());}
        else if saved_hrns.contains_key(&hrn.to_lowercase()){errors.push(format!("HRN {hrn} is already enrolled."));}
        else if hrn_count.get(&hrn.to_lowercase()).is_some_and(|n|*n>1){errors.push(format!("HRN {hrn} occurs more than one time in this list."));}
        if !["Recipient","Donor"].contains(&kind.as_str()){errors.push("Type must be Recipient or Donor.".to_owned());}
        if text(row,"firstName").is_empty(){errors.push("First name is missing.".to_owned());}
        if text(row,"lastName").is_empty(){errors.push("Last name is missing.".to_owned());}
        for (label,key,limit) in [("First name","firstName",128),("Middle name","middleName",128),("Last name","lastName",128),("Suffix","suffix",32),("Contact number","contactNumber",32)] {
            if text(row,key).encode_utf16().count()>limit{errors.push(format!("{label} is longer than {limit} characters."));}
        }
        if email.is_empty(){warnings.push("No email contact provided.".to_owned());}
        else if !valid_email(&email)||email.encode_utf16().count()>320{errors.push("Email address is not a valid e-mail address.".to_owned());}
        else if auth::has_full_access(&email){errors.push("Email address is on the admin list. A patient cannot use it.".to_owned());}
        else if saved_emails.contains(email.as_str()){errors.push("Email address is already enrolled.".to_owned());}
        else if email_count.get(&email).is_some_and(|n|*n>1){errors.push("Email address occurs more than one time in this list.".to_owned());}
        if text(row,"stage").is_empty(){warnings.push("No stage. Orientation is used.".to_owned());}
        if ["Recipient","Donor"].contains(&kind.as_str()) && !stage_valid(&stage,&kind){errors.push(format!("Stage \"{stage}\" is not a stage of a {}.",kind.to_lowercase()));}
        if !sex.is_empty() && !["M","F"].contains(&sex.as_str()){errors.push("Sex must be M or F.".to_owned());}
        if !birth.is_empty()&& let Some(error)=date_error(&birth,"Birth date",true,today){errors.push(error);}
        if !surgery.is_empty(){if let Some(error)=date_error(&surgery,"Surgery date",false,today){errors.push(error);}}
        else if ["PostKT","PostDonation"].contains(&stage.as_str()){errors.push(format!("Surgery date is necessary for stage {stage}."));}
        if !risk.is_empty() && !["StandardLow","High"].contains(&risk.as_str()){errors.push("Risk must be StandardLow or High.".to_owned());}
        if interval.is_none(){errors.push("Follow-up interval must be 1, 2, or 3 months.".to_owned());}
        if !["Active","Inactive","Deceased","Transferred"].contains(&status.as_str()){errors.push("Status must be one of: Active, Inactive, Deceased, Transferred.".to_owned());}
        if kind=="Donor" {
            if linked.is_empty(){errors.push("A donor needs the HRN of the linked recipient.".to_owned());}
            else if linked.to_lowercase()==hrn.to_lowercase(){errors.push("A donor cannot be linked to the same HRN.".to_owned());}
            else {
                let recipient=saved_hrns.get(&linked.to_lowercase()).map(|row|text(row,"patientType")).or_else(||types.get(&linked.to_lowercase()).cloned());
                if recipient.as_deref()!=Some("Recipient"){errors.push(format!("Linked recipient HRN {linked} is not a recipient in the registry or in this list."));}
            }
        }
        let mut doctor_id=|key:&str,role:&str|{
            let name=text(row,key);
            if name.is_empty(){return Value::Null;}
            let found=doctors.iter().find(|doctor|doctor["role"]==role && doctor_key(&text(doctor,"name"))==doctor_key(&name));
            if let Some(doctor)=found{doctor["id"].clone()}else{warnings.push(format!("{role} \"{name}\" is not in the doctor list. The field stays empty."));Value::Null}
        };
        let nephrologist=doctor_id("nephrologist","Nephrologist");let fellow=doctor_id("fellow","Fellow");
        let data=json!({"hrn":hrn,"patientType":kind,"firstName":text(row,"firstName"),"middleName":nullable(text(row,"middleName")),
            "lastName":text(row,"lastName"),"suffix":nullable(text(row,"suffix")),"sex":nullable(sex),"birthDate":nullable(birth),
            "contactNumber":nullable(text(row,"contactNumber")),"accountEmail":nullable(email),"nephrologistId":nephrologist,"fellowId":fellow,
            "stage":stage,"riskCategory":if kind=="Recipient"{nullable(risk)}else{Value::Null},"surgeryDate":nullable(surgery),
            "followupMonths":interval,"status":status});
        Plan{errors,warnings,data,linked_hrn:linked}
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn errors_and_warnings_match_original_order() {
        let rows = vec![
            json!({"hrn":"","patientType":"Patient","firstName":"","lastName":"X","accountEmail":"not-an-email","stage":"PostKT","birthDate":"2999-01-01","sex":"X","followupMonths":7}),
            json!({"hrn":"P","patientType":"Recipient","firstName":"F","lastName":"L","nephrologist":"Dr. Nobody"}),
        ];
        let plans = plan(&rows, &[], &[], "2026-11-08");
        assert_eq!(
            plans[0].errors,
            vec![
                "HRN is missing.",
                "Type must be Recipient or Donor.",
                "First name is missing.",
                "Email address is not a valid e-mail address.",
                "Sex must be M or F.",
                "Birth date is in the future.",
                "Surgery date is necessary for stage PostKT.",
                "Follow-up interval must be 1, 2, or 3 months."
            ]
        );
        assert_eq!(
            plans[1].warnings,
            vec![
                "No email contact provided.",
                "No stage. Orientation is used.",
                "Nephrologist \"Dr. Nobody\" is not in the doctor list. The field stays empty."
            ]
        );
    }
    #[test]
    fn duplicates_linking_doctors_and_numeric_defaults() {
        let rows = vec![
            json!({"hrn":"D","patientType":"Donor","firstName":"F","lastName":"L","linkedRecipientHrn":"p","nephrologist":"DR. JANE DOE, MD","followupMonths":"0x2","riskCategory":"High"}),
            json!({"hrn":"P","patientType":"Recipient","firstName":"F","lastName":"L"}),
        ];
        let plans = plan(
            &rows,
            &[],
            &[json!({"id":5,"name":"Dr. Jane Doe","role":"Nephrologist"})],
            "2026-11-08",
        );
        assert!(plans.iter().all(|p| p.errors.is_empty()));
        assert_eq!(plans[0].data["nephrologistId"], 5);
        assert_eq!(plans[0].data["followupMonths"], 2);
        assert_eq!(plans[0].data["riskCategory"], Value::Null);
        let duplicate = plan(&[rows[1].clone(), rows[1].clone()], &[], &[], "2026-11-08");
        assert_eq!(
            duplicate[0].errors,
            vec!["HRN P occurs more than one time in this list."]
        );
        let saved = plan(
            &[rows[1].clone()],
            &[json!({"id":1,"hrn":"p","patientType":"Recipient"})],
            &[],
            "2026-11-08",
        );
        assert_eq!(saved[0].errors, vec!["HRN P is already enrolled."]);
        assert_eq!(doctor_key("Dr_Jane MD"), "dr jane");
        assert_eq!(doctor_key("Dr. Jane, M.D."), "jane m d");
    }
    #[test]
    fn boundary_limits_and_dates() {
        assert!(validate(&json!({"rows":[]}), false).is_err());
        assert!(validate(&json!({"rows":[{"actor":1}]}), false).is_err());
        assert!(validate(&json!({"rows":[{"hrn":"x".repeat(401)}]}), false).is_err());
        assert!(validate(&json!({"rows":[{"followupMonths":"12345678901"}]}), false).is_err());
        assert_eq!(
            date_error("2026-02-30", "Birth date", true, "2026-11-08").as_deref(),
            Some("Birth date must be a date in the form YYYY-MM-DD.")
        );
        assert!(date_error("2999-01-01", "Surgery date", false, "2026-11-08").is_none());
    }
}
