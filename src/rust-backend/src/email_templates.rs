use crate::{error::ApiError, validation as v};
use chrono::{SecondsFormat, Utc};
use serde_json::{Value, json};
pub const NAMES: &[&str] = &[
    "AppointmentNotice",
    "OverdueLabAlert",
    "WeeklyClinicalDigest",
    "TestNotice",
];
pub fn validate_name(name: &str) -> Result<(), ApiError> {
    if NAMES.contains(&name) {
        Ok(())
    } else {
        Err(v::bad("Invalid email template"))
    }
}
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}
fn string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        Value::Object(_) => "[object Object]".into(),
        Value::Array(a) => a.iter().map(string).collect::<Vec<_>>().join(","),
        _ => value.to_string(),
    }
}
fn truthy(value: &Value) -> bool {
    !matches!(value, Value::Null | Value::Bool(false))
        && value.as_str() != Some("")
        && value.as_f64() != Some(0.0)
}
fn get(data: &Value, key: &str, default: &str) -> String {
    data.get(key)
        .filter(|v| truthy(v))
        .map(string)
        .unwrap_or_else(|| default.into())
}
fn raw(data: &Value, key: &str) -> String {
    data.get(key)
        .map(string)
        .unwrap_or_else(|| "undefined".into())
}
fn base(title: &str, banner: &str, body: &str) -> String {
    let banner = if banner.is_empty() {
        String::new()
    } else {
        format!(r#"<div class="banner">{banner}</div>"#)
    };
    format!(
        r###"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{0}</title>
  <style>
    body {{ margin:0; padding:0; background-color:#e2e5d5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#2a301e; }}
    .wrapper {{ width:100%; max-width:600px; margin:24px auto; background-color:#fbfbf7; border-radius:12px; border:1px solid #cbd0bb; overflow:hidden; }}
    .header {{ background-color:#f3f4ec; padding:20px 24px; border-bottom:1px solid #cbd0bb; }}
    .title {{ font-size:18px; font-weight:700; margin:0; color:#2a301e; }}
    .sub {{ font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#545b45; margin-top:4px; }}
    .banner {{ background-color:#d8dcc9; padding:12px 24px; font-size:12px; font-family:monospace; color:#2a301e; border-bottom:1px solid #cbd0bb; }}
    .content {{ padding:24px; font-size:14px; line-height:1.5; color:#2a301e; }}
    .footer {{ background-color:#f3f4ec; padding:16px 24px; font-size:11px; color:#545b45; border-top:1px solid #cbd0bb; }}
    .btn {{ display:inline-block; background-color:#ae3c30; color:#fffaf6; text-decoration:none; padding:10px 18px; font-size:13px; font-weight:600; border-radius:6px; margin-top:16px; }}
    .highlight {{ background-color:#dcefdc; color:#1d6433; padding:2px 6px; border-radius:4px; font-weight:600; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="title">SPMC Kidney Transplant Service</h1>
      <div class="sub">Clinical Notification System · Confidential</div>
    </div>
    {1}
    <div class="content">
      {2}
    </div>
    <div class="footer">
      Southern Philippines Medical Center · Kidney Transplant Program<br>
      This notification is sent automatically. For urgent clinical emergencies, visit the emergency department.
    </div>
  </div>
</body>
</html>"###,
        escape(title),
        banner,
        body
    )
}
pub fn sample(test: bool) -> Value {
    if test {
        json!({"patientName":"Sample Test Patient","hrn":"KTP-2026-TEST","appointmentDate":"2026-10-08","time":"10:00 AM","doctorName":"Dr. Nephrologist","labTitle":"Serum Creatinine and Electrolytes","dueDate":"2026-10-04","activeCount":42,"pendingLabs":8,"upcomingVisits":14,"evalCount":12})
    } else {
        json!({"patientName":"Juan Dela Cruz","hrn":"KTP-2026-0001","appointmentDate":"2026-10-06","time":"09:30 AM","doctorName":"Dr. Maria Santos","labTitle":"Complete Blood Count and Creatinine","dueDate":"2026-10-03","activeCount":38,"pendingLabs":6,"upcomingVisits":11,"evalCount":9})
    }
}
pub fn render(name: &str, data: &Value) -> Value {
    let patient = get(data, "patientName", "Patient");
    let hrn = get(data, "hrn", "KTP-2026-0000");
    let today = v::today();
    let (subject, title, banner, body, text) = match name {
        "AppointmentNotice" => (
            format!(
                r###"Appointment Notice: {0} ({1}) on {2}"###,
                patient,
                hrn,
                get(data, "appointmentDate", &today)
            ),
            "Clinic Appointment Notice",
            format!(
                r###"PATIENT: {0} | HRN: {1} | VISIT: {2}"###,
                escape(&patient),
                escape(&hrn),
                escape(&get(data, "kind", "FollowUp"))
            ),
            format!(
                r###"
      <p>Dear <strong>{0}</strong>,</p>
      <p>This is an automated reminder of your upcoming kidney transplant clinic appointment:</p>
      <div style="background-color:#f3f4ec; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #cbd0bb;">
        <p style="margin:0 0 8px 0;"><strong>Date and Time:</strong> <span class="highlight">{1} at {2}</span></p>
        <p style="margin:0 0 8px 0;"><strong>Attending Doctor:</strong> {3}</p>
        <p style="margin:0;"><strong>Location:</strong> SPMC Kidney Transplant Clinic, OPD Building</p>
      </div>
      <p>Please arrive 15 minutes before your scheduled time. Bring your previous lab results and PhilHealth identification.</p>
      <a href="https://ktp-beryl.vercel.app/me/calendar" class="btn">View Appointment in Patient Portal</a>
    "###,
                escape(&patient),
                escape(&get(data, "appointmentDate", "")),
                escape(&get(data, "time", "09:00 AM")),
                escape(&get(data, "doctorName", "Transplant Specialist"))
            ),
            format!(
                r###"SPMC Kidney Transplant Appointment Reminder
Patient: {0} ({1})
Date: {2} at {3}
Doctor: {4}
Location: SPMC Kidney Transplant Clinic"###,
                patient,
                hrn,
                raw(data, "appointmentDate"),
                raw(data, "time"),
                raw(data, "doctorName")
            ),
        ),
        "OverdueLabAlert" => (
            format!(
                r###"Action Required: Scheduled Lab Workup Due for {0} ({1})"###,
                patient, hrn
            ),
            "Overdue Lab Workup Alert",
            format!(
                r###"PATIENT: {0} | HRN: {1} | ALERT: Due Lab Service"###,
                escape(&patient),
                escape(&hrn)
            ),
            format!(
                r###"
      <p>Dear <strong>{0}</strong>,</p>
      <p>Our records show a scheduled laboratory workup has reached its due date without recorded results:</p>
      <div style="background-color:#fbe1e8; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #ae3c30;">
        <p style="margin:0 0 8px 0; color:#ae3c30;"><strong>Laboratory Requirement:</strong> {1}</p>
        <p style="margin:0; color:#2a301e;"><strong>Target Due Date:</strong> {2}</p>
      </div>
      <p>Routine lab monitoring is critical to protect your graft function. Please complete your blood draw and upload your results or submit them to the transplant coordinator.</p>
      <a href="https://ktp-beryl.vercel.app/me/labs" class="btn">Upload Results to Portal</a>
    "###,
                escape(&patient),
                escape(&get(data, "labTitle", "Periodic Blood Chemistry")),
                escape(&get(data, "dueDate", &today))
            ),
            format!(
                r###"SPMC Kidney Transplant Lab Workup Alert
Patient: {0} ({1})
Requirement: {2}
Due Date: {3}"###,
                patient,
                hrn,
                raw(data, "labTitle"),
                raw(data, "dueDate")
            ),
        ),
        "WeeklyClinicalDigest" => (
            format!(
                r###"Weekly Kidney Transplant Clinical Digest: {0}"###,
                get(data, "date", &today)
            ),
            "Weekly Clinical Digest",
            r###"CLINICAL DIGEST | SPMC TRANSPLANT SERVICE | CENSUS SUMMARY"###.to_string(),
            format!(
                r###"
      <p>Dear <strong>{0}</strong>,</p>
      <p>Here is the weekly active patient census and workup status summary:</p>
      <div style="background-color:#f3f4ec; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #cbd0bb;">
        <p style="margin:0 0 8px 0;"><strong>Active Transplant Patients:</strong> <span class="highlight">{1}</span></p>
        <p style="margin:0 0 8px 0;"><strong>Pending Lab Workups:</strong> {2}</p>
        <p style="margin:0 0 8px 0;"><strong>Upcoming Clinic Visits (7 Days):</strong> {3}</p>
        <p style="margin:0;"><strong>Patients in Pre-Transplant Evaluation:</strong> {4}</p>
      </div>
      <a href="https://ktp-beryl.vercel.app/dashboard" class="btn">Open Transplant Dashboard</a>
    "###,
                escape(&get(data, "doctorName", "Transplant Team")),
                escape(&get(data, "activeCount", "0")),
                escape(&get(data, "pendingLabs", "0")),
                escape(&get(data, "upcomingVisits", "0")),
                escape(&get(data, "evalCount", "0"))
            ),
            format!(
                r###"Weekly Transplant Digest
Active Patients: {0}
Pending Labs: {1}
Upcoming Visits: {2}"###,
                raw(data, "activeCount"),
                raw(data, "pendingLabs"),
                raw(data, "upcomingVisits")
            ),
        ),
        _ => (
            format!(
                r###"KTP Notification System Test ({0})"###,
                get(data, "testId", "Ping")
            ),
            "Notification System Test",
            String::new(),
            format!(
                r###"
    <p>This is a test notification confirming email delivery connectivity for the SPMC Kidney Transplant Program.</p>
    <p>Timestamp: <strong>{0}</strong></p>
    <p>Status: All automated clinical dispatch pipelines operational.</p>
  "###,
                Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
            ),
            "KTP Email Test OK".to_owned(),
        ),
    };
    json!({"subject":subject,"html":base(title,&banner,&body),"text":text})
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn templates_escape_every_html_merge_field() {
        let data =
            json!({"patientName":"<script>&\"'","activeCount":"<img>","doctorName":"<script>"});
        for name in NAMES {
            let result = render(name, &data);
            assert!(!result["html"].as_str().unwrap().contains("<script>"));
            assert!(!result["html"].as_str().unwrap().contains("<img>"));
        }
        assert!(
            render("AppointmentNotice", &data)["html"]
                .as_str()
                .unwrap()
                .contains("&lt;script&gt;&amp;&quot;&#039;")
        );
    }
}
