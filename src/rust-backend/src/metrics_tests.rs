use super::*;
fn patient(id: i64, kind: &str) -> Value {
    json!({"id":id,"patientType":kind,"stage":"Phase3","status":"Active","createdAt":"2026-09-01","linkedRecipientId":1})
}
fn checklist(id: i64) -> Vec<Value> {
    ["Ethics committee","HTEC evaluation and approval","CBC"].iter().map(|name|json!({"patientId":id,"name":name,"category":"Lab","status":"Done","asIndicated":false,"recorded":true})).collect()
}
#[test]
fn empty_metrics_have_null_averages_and_twelve_months() {
    let m = metrics(&[], &[], &[], &[], &[], &[], "2026-10-03", None);
    assert_eq!(
        m["analysis"]["waiting"]["enrollmentAverageDays"],
        Value::Null
    );
    assert_eq!(m["analysis"]["monthly"].as_array().unwrap().len(), 12);
    assert_eq!(m["analysis"]["monthly"][0]["month"], "2025-11");
}
#[test]
fn readiness_requires_both_ethics_and_recorded_optional_items() {
    let patients = vec![patient(1, "Recipient"), patient(2, "Donor")];
    let mut cs = checklist(1);
    cs.extend(checklist(2));
    cs.push(json!({"patientId":1,"name":"Optional","category":"Lab","status":"Pending","asIndicated":true,"recorded":false}));
    let run = |cs: &[Value]| metrics(&patients, &patients, cs, &[], &[], &[], "2026-10-03", None);
    assert_eq!(run(&cs)["analysis"]["ready"], 1);
    cs.last_mut().unwrap()["recorded"] = json!(true);
    assert_eq!(run(&cs)["analysis"]["ready"], 0);
    assert_eq!(
        run(&cs)["analysis"]["blockers"][0],
        json!({"reason":"Laboratory requirements","count":1})
    );
}
#[test]
fn stage_history_keeps_same_stage_saves_and_ignores_future_entries() {
    let patients = vec![patient(1, "Recipient")];
    let events = vec![
        json!({"patientId":1,"createdAt":"2026-09-20 12:30:00","details":"```json\n{\"fromStage\":\"Clearances\",\"toStage\":\"Phase3\"}\n```"}),
        json!({"patientId":1,"createdAt":"2026-10-01","details":{"fromStage":"Phase3","toStage":"Phase3"}}),
        json!({"patientId":1,"createdAt":"2026-11-01","details":{"toStage":"PostKT"}}),
    ];
    let m = metrics(
        &patients,
        &patients,
        &[],
        &[],
        &[],
        &events,
        "2026-10-03",
        None,
    );
    assert_eq!(m["analysis"]["waiting"]["stages"][0]["averageDays"], 13);
    assert_eq!(m["analysis"]["waiting"]["stageUnknown"], 0);
    let mut events = events;
    events.push(json!({"patientId":1,"createdAt":"2026-10-02","details":{"changes":["stage"]}}));
    assert_eq!(
        metrics(
            &patients,
            &patients,
            &[],
            &[],
            &[],
            &events,
            "2026-10-03",
            None
        )["analysis"]["waiting"]["stageUnknown"],
        1
    );
}
#[test]
fn claims_include_today_and_seven_days_and_filter_status() {
    let mut inactive = patient(2, "Recipient");
    inactive["status"] = json!("Inactive");
    let patients = vec![patient(1, "Recipient"), inactive];
    let services:Vec<_>=[Some("2026-10-02"),Some("2026-10-03"),Some("2026-10-10"),Some("2026-10-11"),None].iter().map(|d|json!({"patientId":1,"status":"Done","claimDeadline":d})).chain([json!({"patientId":2,"status":"Done","claimDeadline":"2026-10-01"}),json!({"patientId":1,"status":"Superseded","claimDeadline":"2026-10-01","claimFiledDate":"2026-09-30"})]).collect();
    let m = metrics(
        &[],
        &patients,
        &[],
        &services,
        &[],
        &[],
        "2026-10-03",
        Some("Active"),
    );
    assert_eq!(
        m["analysis"]["claims"],
        json!({"pending":5,"dueSoon":2,"overdue":1,"filed":1,"missingDeadline":1})
    );
}
