use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

fn text<'a>(v: &'a Value, key: &str) -> &'a str {
    v[key].as_str().unwrap_or("")
}
fn id(v: &Value, key: &str) -> i64 {
    v[key].as_i64().unwrap_or(0)
}
fn truth(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}
fn preop(p: &Value) -> bool {
    !matches!(text(p, "stage"), "PostKT" | "PostDonation")
}
fn ethics(c: &Value) -> bool {
    matches!(
        text(c, "name"),
        "Ethics committee" | "HTEC evaluation and approval"
    )
}
fn date_key(v: &Value) -> String {
    let Some(s) = v.as_str() else {
        return String::new();
    };
    if s.len() < 10 || !s.is_char_boundary(10) || (s.len() != 10 && s.as_bytes()[10] != b'T') {
        return String::new();
    }
    let day = &s[..10];
    if NaiveDate::parse_from_str(day, "%Y-%m-%d").is_err() {
        return String::new();
    }
    if s.len() > 10 && timestamp(s).is_none() {
        return String::new();
    }
    day.to_string()
}
fn timestamp(s: &str) -> Option<i64> {
    if let Ok(d) = DateTime::parse_from_rfc3339(s) {
        return Some(d.timestamp_millis());
    }
    for fmt in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%d %H:%M:%S%.f"] {
        if let Ok(d) = NaiveDateTime::parse_from_str(s.trim_end_matches('Z'), fmt) {
            return Some(d.and_utc().timestamp_millis());
        }
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .ok()?
        .and_hms_opt(0, 0, 0)
        .map(|d| d.and_utc().timestamp_millis())
}
fn metric_date(v: &Value) -> String {
    let Some(s) = v.as_str() else {
        return String::new();
    };
    if s.len() > 10 && s.as_bytes()[10] == b' ' {
        return date_key(&Value::String(format!("{}Z", s.replacen(' ', "T", 1))));
    }
    date_key(v)
}
fn days(a: &str, b: &str) -> i64 {
    let parse = |s| NaiveDate::parse_from_str(s, "%Y-%m-%d").expect("validated metric date");
    (parse(a) - parse(b)).num_days()
}
fn mean(values: &[i64]) -> Value {
    if values.is_empty() {
        Value::Null
    } else {
        json!((values.iter().sum::<i64>() as f64 / values.len() as f64).round() as i64)
    }
}
fn unique_push<T: PartialEq>(values: &mut Vec<T>, value: T) {
    if !values.contains(&value) {
        values.push(value);
    }
}
fn parsed_details(v: &Value) -> Result<Value, serde_json::Error> {
    if let Some(s) = v.as_str() {
        let s = if let Some(rest) = s.strip_prefix("```") {
            rest.strip_prefix("json").unwrap_or(rest).trim_start()
        } else {
            s
        };
        let s = s.strip_suffix("```").map(str::trim_end).unwrap_or(s);
        serde_json::from_str(s)
    } else {
        Ok(v.clone())
    }
}

/// Patient metrics parity with shared/metrics.ts and shared/metricsAnalysis.ts.
/// Summary rows are already filtered; all patients are needed for donor matching.
#[allow(clippy::too_many_arguments)]
pub fn metrics(
    rows: &[Value],
    patients: &[Value],
    checklist: &[Value],
    services: &[Value],
    appointments: &[Value],
    stage_events: &[Value],
    today: &str,
    status: Option<&str>,
) -> Value {
    let selected: Vec<_> = patients
        .iter()
        .filter(|p| status.is_none_or(|s| s.is_empty() || text(p, "status") == s))
        .collect();
    let selected_ids: HashSet<_> = selected.iter().map(|p| id(p, "id")).collect();
    let recipient_ids: HashSet<_> = selected
        .iter()
        .filter(|p| text(p, "patientType") == "Recipient")
        .map(|p| id(p, "id"))
        .collect();
    let mut by_patient: HashMap<i64, Vec<&Value>> = HashMap::new();
    for c in checklist {
        by_patient.entry(id(c, "patientId")).or_default().push(c);
    }
    let items = |patient_id| by_patient.get(&patient_id).cloned().unwrap_or_default();
    let required = |patient_id| {
        items(patient_id)
            .into_iter()
            .filter(|c| !truth(&c["asIndicated"]) || truth(&c["recorded"]))
            .collect::<Vec<_>>()
    };
    let pending = |patient_id| {
        required(patient_id)
            .into_iter()
            .filter(|c| !matches!(text(c, "status"), "Done" | "NA"))
            .collect::<Vec<_>>()
    };
    let approved = |patient_id| {
        let cs: Vec<_> = items(patient_id)
            .into_iter()
            .filter(|c| ethics(c))
            .collect();
        cs.iter().any(|c| text(c, "name") == "Ethics committee")
            && cs
                .iter()
                .any(|c| text(c, "name") == "HTEC evaluation and approval")
            && cs.iter().all(|c| text(c, "status") == "Done")
    };
    let complete = |p: &Value| {
        text(p, "stage") == "Phase3"
            && !required(id(p, "id")).is_empty()
            && pending(id(p, "id")).is_empty()
            && approved(id(p, "id"))
    };
    let candidates: Vec<_> = selected
        .iter()
        .filter(|p| text(p, "patientType") == "Recipient" && preop(p))
        .collect();
    let (mut without_donor, mut under_evaluation, mut qualified_donor, mut ready, mut blocked) =
        (0, 0, 0, 0, HashSet::new());
    let mut blockers: Vec<(&str, usize)> = Vec::new();
    for p in &candidates {
        let donors: Vec<_> = patients
            .iter()
            .filter(|d| {
                text(d, "patientType") == "Donor"
                    && d["linkedRecipientId"].as_i64() == p["id"].as_i64()
                    && text(d, "status") == "Active"
                    && preop(d)
            })
            .collect();
        let qualified = donors.iter().any(|d| complete(d));
        if donors.is_empty() {
            without_donor += 1;
        } else if qualified {
            qualified_donor += 1;
        } else {
            under_evaluation += 1;
        }
        if text(p, "status") == "Active" && complete(p) && qualified {
            ready += 1;
        }
        let mut reasons = Vec::new();
        for c in pending(id(p, "id")) {
            unique_push(
                &mut reasons,
                if ethics(c) {
                    "Ethics approval"
                } else {
                    match text(c, "category") {
                        "Lab" => "Laboratory requirements",
                        "Clearance" => "Clearances",
                        "Imaging" => "Imaging requirements",
                        _ => "Other milestones",
                    }
                },
            );
        }
        if !approved(id(p, "id")) {
            unique_push(&mut reasons, "Ethics approval");
        }
        if donors.is_empty() {
            unique_push(&mut reasons, "No active linked donor");
        } else if !qualified {
            unique_push(&mut reasons, "Donor requirements incomplete");
        }
        if text(p, "stage") != "Phase3" {
            unique_push(&mut reasons, "Not in Phase 3");
        }
        if !reasons.is_empty() {
            blocked.insert(id(p, "id"));
        }
        for reason in reasons {
            if let Some((_, n)) = blockers.iter_mut().find(|(r, _)| *r == reason) {
                *n += 1;
            } else {
                blockers.push((reason, 1));
            }
        }
    }
    blockers.sort_by_key(|a| std::cmp::Reverse(a.1));
    let preoperative: Vec<_> = selected.iter().filter(|p| preop(p)).collect();
    let (mut awaiting, mut approved_count, mut not_applicable, mut unknown) = (0, 0, 0, 0);
    for p in &preoperative {
        let cs: Vec<_> = items(id(p, "id"))
            .into_iter()
            .filter(|c| ethics(c))
            .collect();
        if cs.is_empty() {
            unknown += 1;
        } else if approved(id(p, "id")) {
            approved_count += 1;
        } else if cs.iter().all(|c| text(c, "status") == "NA") {
            not_applicable += 1;
        } else {
            awaiting += 1;
        }
    }
    let mut events: Vec<_> = stage_events.iter().collect();
    events.sort_by(|a, b| {
        match (
            timestamp(text(a, "createdAt")),
            timestamp(text(b, "createdAt")),
        ) {
            (Some(a), Some(b)) => a.cmp(&b),
            _ => std::cmp::Ordering::Equal,
        }
    });
    let mut entered: HashMap<i64, (String, String)> = HashMap::new();
    for event in events {
        let patient_id = id(event, "patientId");
        let Ok(details) = parsed_details(&event["details"]) else {
            entered.remove(&patient_id);
            continue;
        };
        let day = metric_date(&event["createdAt"]);
        if let Some(stage) = details["toStage"].as_str() {
            if details["fromStage"] != details["toStage"]
                && !day.is_empty()
                && day.as_str() <= today
            {
                entered.insert(patient_id, (stage.to_string(), day));
            }
        } else if details["changes"]
            .as_array()
            .is_some_and(|a| a.iter().any(|v| v == "stage"))
            || details["changes"]
                .as_str()
                .is_some_and(|s| s.contains("stage"))
        {
            entered.remove(&patient_id);
        } else if let Some(stage) = details["stage"].as_str()
            && !day.is_empty()
            && day.as_str() <= today
        {
            entered.insert(patient_id, (stage.to_string(), day));
        }
    }
    let current_wait: Vec<_> = selected
        .iter()
        .filter_map(|p| {
            let (stage, day) = entered.get(&id(p, "id"))?;
            (stage == text(p, "stage")).then(|| (stage.as_str(), days(today, day)))
        })
        .collect();
    let enrollment_wait: Vec<_> = preoperative
        .iter()
        .map(|p| metric_date(&p["createdAt"]))
        .filter(|d| !d.is_empty() && d.as_str() <= today)
        .map(|d| days(today, &d))
        .collect();
    let completed_wait: Vec<_> = selected
        .iter()
        .filter(|p| text(p, "patientType") == "Recipient" && text(p, "stage") == "PostKT")
        .filter_map(|p| {
            let start = metric_date(&p["createdAt"]);
            let end = metric_date(&p["surgeryDate"]);
            (!start.is_empty() && !end.is_empty() && end >= start && end.as_str() <= today)
                .then(|| days(&end, &start))
        })
        .collect();
    let mut stages = Vec::new();
    for p in &selected {
        unique_push(&mut stages, text(p, "stage"));
    }
    let waiting_stages: Vec<_> = stages
        .iter()
        .map(|stage| {
            let values: Vec<_> = current_wait
                .iter()
                .filter(|(s, _)| s == stage)
                .map(|(_, n)| *n)
                .collect();
            json!({"stage":stage,"averageDays":mean(&values),"samples":values.len()})
        })
        .collect();
    let day = NaiveDate::parse_from_str(today, "%Y-%m-%d").expect("today is a valid Manila date");
    let monthly: Vec<_> = (0..12).map(|index| {
        let month_number = day.year() * 12 + day.month0() as i32 - 11 + index;
        let month = format!("{:04}-{:02}", month_number.div_euclid(12), month_number.rem_euclid(12) + 1);
        let count = |field: &str, kind: &str, stage: Option<&str>| selected.iter().filter(|p| {
            let date = if field == "createdAt" { metric_date(&p[field]) } else { date_key(&p[field]) };
            date.starts_with(&month) && date.as_str() <= today && text(p, "patientType") == kind && stage.is_none_or(|s| text(p, "stage") == s)
        }).count();
        json!({"month":month,"recipients":count("createdAt","Recipient",None),"donors":count("createdAt","Donor",None),"transplants":count("surgeryDate","Recipient",Some("PostKT")),"donations":count("surgeryDate","Donor",Some("PostDonation"))})
    }).collect();
    let services: Vec<_> = services
        .iter()
        .filter(|s| selected_ids.contains(&id(s, "patientId")))
        .collect();
    let overdue: Vec<_> = services
        .iter()
        .filter(|s| {
            let d = date_key(&s["dueDate"]);
            text(s, "status") == "Planned"
                && !d.is_empty()
                && d.as_str() < today
                && matches!(text(s, "serviceType"), "Laboratory" | "Tacro")
        })
        .collect();
    let overdue_ids: HashSet<_> = overdue.iter().map(|s| id(s, "patientId")).collect();
    let past_followups: Vec<_> = appointments
        .iter()
        .filter(|a| {
            let d = metric_date(&a["startsAt"]);
            selected_ids.contains(&id(a, "patientId"))
                && text(a, "kind") == "FollowUp"
                && !truth(&a["cancelledAt"])
                && !d.is_empty()
                && d.as_str() < today
        })
        .collect();
    let post_ids: HashSet<_> = selected
        .iter()
        .filter(|p| text(p, "patientType") == "Recipient" && text(p, "stage") == "PostKT")
        .map(|p| id(p, "id"))
        .collect();
    let (mut claim_pending, mut due_soon, mut overdue_claims, mut filed, mut missing) =
        (0, 0, 0, 0, 0);
    for service in services.iter().filter(|s| {
        recipient_ids.contains(&id(s, "patientId"))
            && matches!(text(s, "status"), "Done" | "Superseded")
    }) {
        if !date_key(&service["claimFiledDate"]).is_empty() {
            filed += 1;
            continue;
        }
        claim_pending += 1;
        let deadline = date_key(&service["claimDeadline"]);
        if deadline.is_empty() {
            missing += 1;
        } else {
            let diff = days(&deadline, today);
            if diff < 0 {
                overdue_claims += 1;
            } else if diff <= 7 {
                due_soon += 1;
            }
        }
    }
    let count = |kind: &str, stage: Option<&str>| {
        rows.iter()
            .filter(|p| {
                text(p, "patientType") == kind && stage.is_none_or(|s| text(p, "stage") == s)
            })
            .count()
    };
    let ethics_rows: Vec<_> = rows
        .iter()
        .filter(|p| text(p, "stage") == "Clearances" && text(p, "ethicsStatus") == "Pending")
        .collect();
    let summary_stages: Vec<_> = ["Orientation","Phase1","Phase2","Clearances","PhilHealthZ","Phase3","PostKT","PostDonation"].iter().map(|stage| json!({"stage":stage,"recipients":count("Recipient",Some(stage)),"donors":count("Donor",Some(stage))})).collect();
    json!({"total":rows.len(),"recipients":count("Recipient",None),"donors":count("Donor",None),"forEthics":ethics_rows.len(),
        "ethicsRecipients":ethics_rows.iter().filter(|p| text(p,"patientType")=="Recipient").count(),"ethicsDonors":ethics_rows.iter().filter(|p| text(p,"patientType")=="Donor").count(),
        "forTransplant":count("Recipient",Some("Phase3")),"postTransplant":count("Recipient",Some("PostKT")),"postDonation":count("Donor",Some("PostDonation")),"stages":summary_stages,
        "analysis":{"ready":ready,"candidates":candidates.len(),"blocked":blocked.len(),"blockers":blockers.iter().map(|(reason,count)|json!({"reason":reason,"count":count})).collect::<Vec<_>>(),
            "matching":{"withoutDonor":without_donor,"underEvaluation":under_evaluation,"qualifiedDonor":qualified_donor},
            "ethics":{"awaiting":awaiting,"approved":approved_count,"notApplicable":not_applicable,"unknown":unknown},
            "waiting":{"enrollmentAverageDays":mean(&enrollment_wait),"enrollmentSamples":enrollment_wait.len(),"transplantAverageDays":mean(&completed_wait),"transplantSamples":completed_wait.len(),"stageUnknown":selected.len()-current_wait.len(),"stages":waiting_stages},
            "monthly":monthly,"followup":{"overdueLabs":overdue.len(),"patientsWithOverdueLabs":overdue_ids.len(),"pastFollowups":past_followups.len(),"pastPostTransplantFollowups":past_followups.iter().filter(|a|post_ids.contains(&id(a,"patientId"))).count(),"rescheduleRequests":appointments.iter().filter(|a|selected_ids.contains(&id(a,"patientId"))&&!truth(&a["cancelledAt"])&&text(a,"response")=="RescheduleRequested").count()},
            "claims":{"pending":claim_pending,"dueSoon":due_soon,"overdue":overdue_claims,"filed":filed,"missingDeadline":missing}}})
}

#[cfg(test)]
#[path = "metrics_tests.rs"]
mod tests;
