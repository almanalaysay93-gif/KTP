use crate::{
    clinical_core::{Write, lab_flag},
    error::ApiError,
    validation as v,
};
use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;

fn approval(approved: bool, nurse: Option<&str>) -> Option<String> {
    approved.then(|| match nurse.filter(|name| !name.is_empty()) {
        Some(name) => format!("[Approved by Nurse: {name}]"),
        None => "[Approved by Nurse]".to_owned(),
    })
}

pub(crate) async fn test(ctx: &mut Write, id: i32) -> Result<Value, ApiError> {
    let row: Option<(SqlJson<Value>,)> =
        sqlx::query_as("SELECT to_jsonb(t) FROM ktp.\"labTests\" t WHERE id=$1 AND active=true")
            .bind(id)
            .fetch_optional(&mut *ctx.tx)
            .await?;
    Ok(row
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Lab test not found"))?
        .0
        .0)
}

pub(crate) async fn insert(
    ctx: &mut Write,
    service: i32,
    id: i32,
    value: &str,
    test: &Value,
) -> Result<i32, ApiError> {
    let row: (i32,) = sqlx::query_as(
        r#"INSERT INTO ktp."labResults"
        ("serviceRecordId","labTestId",value,"lowSnapshot","highSnapshot",flag)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING id"#,
    )
    .bind(service)
    .bind(id)
    .bind(value)
    .bind(test["low"].as_str())
    .bind(test["high"].as_str())
    .bind(lab_flag(value, &test["low"], &test["high"]))
    .fetch_one(&mut *ctx.tx)
    .await?;
    Ok(row.0)
}

pub async fn record(ctx: &mut Write, input: &Value) -> Result<Value, ApiError> {
    v::allowed(
        input,
        &[
            "patientId",
            "serviceRecordId",
            "serviceDate",
            "claimDeadline",
            "note",
            "nurseApproved",
            "approvedByNurse",
            "results",
        ],
    )?;
    let id = v::id(input, "serviceRecordId")?;
    let date = v::date(input, "serviceDate", true)?;
    let deadline = v::opt_date(input, "claimDeadline", false)?;
    if deadline.as_deref().is_some_and(|d| d < date.as_str()) {
        return Err(v::bad("Claim deadline cannot precede service date"));
    }
    let note = v::opt_string(input, "note", 4000)?;
    let approved = v::opt_bool(input, "nurseApproved")?;
    let nurse = v::opt_string(input, "approvedByNurse", 200)?;
    let results = v::results(input, "results", false, false)?;
    let current: Option<(String,String)> = sqlx::query_as(
        r#"SELECT status,"serviceType" FROM ktp."serviceRecords" WHERE id=$1 AND "patientId"=$2 FOR UPDATE"#,
    ).bind(id).bind(ctx.patient_id).fetch_optional(&mut *ctx.tx).await?;
    let (status, kind) = current.ok_or(ApiError(StatusCode::NOT_FOUND, "Service not found"))?;
    if status != "Planned" {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Only planned services can receive results",
        ));
    }
    if !results.is_empty() && !["Laboratory", "Tacro"].contains(&kind.as_str()) {
        return Err(v::bad(
            "Lab values require a laboratory or tacrolimus service",
        ));
    }
    let tag = approval(approved, nurse.as_deref());
    let final_note = [note.as_deref(), tag.as_deref()]
        .into_iter()
        .flatten()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let changed = sqlx::query(
        r#"UPDATE ktp."serviceRecords" SET status='Done',"serviceDate"=$1::date,
        "claimDeadline"=$2::date,note=COALESCE($3,note),"updatedAt"=CURRENT_TIMESTAMP
        WHERE id=$4 AND "patientId"=$5 AND status='Planned'"#,
    )
    .bind(date)
    .bind(deadline)
    .bind((!final_note.is_empty()).then_some(final_note))
    .bind(id)
    .bind(ctx.patient_id)
    .execute(&mut *ctx.tx)
    .await?;
    if changed.rows_affected() != 1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Service already changed; refresh and retry",
        ));
    }
    for result in results {
        let catalog = test(ctx, result.lab_test_id).await?;
        insert(ctx, id, result.lab_test_id, &result.value, &catalog).await?;
    }
    ctx.audit(
        "clinical.result.record",
        id,
        json!({"nurseApproved":approved,"approvedByNurse":nurse}),
    )
    .await?;
    Ok(json!({"id":id}))
}

pub async fn add(ctx: &mut Write, input: &Value, single: bool) -> Result<Value, ApiError> {
    let mut fields = vec![
        "patientId",
        "phase",
        "serviceDate",
        "nurseApproved",
        "approvedByNurse",
    ];
    if single {
        fields.extend(["labTestId", "value"]);
    } else {
        fields.push("results");
    }
    v::allowed(input, &fields)?;
    let phase = v::choice(input, "phase", v::LAB_PHASES)?;
    let date = v::date(input, "serviceDate", true)?;
    let approved = v::opt_bool(input, "nurseApproved")?;
    let nurse = v::opt_string(input, "approvedByNurse", 200)?;
    let results = if single {
        vec![v::LabValue {
            lab_test_id: v::id(input, "labTestId")?,
            value: v::string(input, "value", 1, 100)?,
        }]
    } else {
        v::results(input, "results", true, false)?
    };
    let patient_type = ctx.patient["patientType"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    if !v::valid_phase(&phase, &patient_type) {
        return Err(v::bad("Phase does not apply to this patient type"));
    }
    let saved: Option<(i32, Option<String>)> = sqlx::query_as(
        r#"SELECT id,note FROM ktp."serviceRecords"
        WHERE "patientId"=$1 AND phase=$2 AND "serviceDate"=$3::date
        AND "serviceType"='Laboratory' AND status='Done' ORDER BY id LIMIT 1 FOR UPDATE"#,
    )
    .bind(ctx.patient_id)
    .bind(&phase)
    .bind(&date)
    .fetch_optional(&mut *ctx.tx)
    .await?;
    let (service, note) = if let Some(saved) = saved {
        saved
    } else {
        let label = match phase.as_str() {
            "Phase1" => "Phase 1 labs",
            "Phase2" => "Phase 2 labs",
            "Phase3" => "Phase 3 labs",
            "PostKT" => "Post-KT labs",
            _ => "Post-donation labs",
        };
        sqlx::query_as(
            r#"INSERT INTO ktp."serviceRecords"
            ("patientId","serviceType",label,status,"dueDate","serviceDate",phase)
            VALUES ($1,'Laboratory',$2,'Done',$3::date,$3::date,$4) RETURNING id,note"#,
        )
        .bind(ctx.patient_id)
        .bind(label)
        .bind(&date)
        .bind(&phase)
        .fetch_one(&mut *ctx.tx)
        .await?
    };
    if let Some(tag) = approval(approved, nurse.as_deref()) {
        let note = note.as_deref().unwrap_or_default();
        if !note.contains(&tag) {
            let joined = if note.is_empty() {
                tag
            } else {
                format!("{note} {tag}")
            };
            sqlx::query(r#"UPDATE ktp."serviceRecords" SET note=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$2"#)
                .bind(joined).bind(service).execute(&mut *ctx.tx).await?;
        }
    }
    let phase_number = match phase.as_str() {
        "Phase1" => Some(1_i32),
        "Phase2" => Some(2),
        "Phase3" => Some(3),
        _ => None,
    };
    let mut ids = Vec::new();
    for result in results {
        let catalog = test(ctx, result.lab_test_id).await?;
        let exists:(bool,)=sqlx::query_as(r#"SELECT EXISTS(SELECT 1 FROM ktp."labResults" WHERE "serviceRecordId"=$1 AND "labTestId"=$2)"#)
            .bind(service).bind(result.lab_test_id).fetch_one(&mut *ctx.tx).await?;
        if exists.0 {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "Lab test already has a result for that phase and date. Remove it first, or correct it in Edit patient.",
            ));
        }
        let id = insert(ctx, service, result.lab_test_id, &result.value, &catalog).await?;
        if let Some(number) = phase_number {
            let item:Option<(i32,)>=sqlx::query_as(r#"SELECT id FROM ktp."checklistCatalog"
                WHERE name=$1 AND phase=$2 AND active=true AND ("appliesTo"='Both' OR "appliesTo"=$3) LIMIT 1"#)
                .bind(catalog["name"].as_str()).bind(number).bind(&patient_type).fetch_optional(&mut *ctx.tx).await?;
            if let Some((catalog_id,)) = item {
                sqlx::query(r#"INSERT INTO ktp."patientChecklist" ("patientId","catalogId",status,"doneDate")
                    VALUES ($1,$2,'Done',$3::date) ON CONFLICT ("patientId","catalogId") DO UPDATE
                    SET status='Done',"doneDate"=excluded."doneDate","updatedAt"=CURRENT_TIMESTAMP
                    WHERE "patientChecklist".status<>'Done'"#)
                    .bind(ctx.patient_id).bind(catalog_id).bind(&date).execute(&mut *ctx.tx).await?;
            }
        }
        ctx.audit("clinical.lab.add",id,json!({"serviceRecordId":service,"phase":phase,"nurseApproved":approved,"approvedByNurse":nurse})).await?;
        ids.push(id);
    }
    Ok(if single {
        json!({"id":ids[0],"serviceRecordId":service})
    } else {
        json!({"ids":ids,"serviceRecordId":service})
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn approval_matches_named_unnamed_and_unapproved_inputs() {
        assert_eq!(approval(false, Some("RN")), None);
        assert_eq!(approval(true, None).as_deref(), Some("[Approved by Nurse]"));
        assert_eq!(
            approval(true, Some("")).as_deref(),
            Some("[Approved by Nurse]")
        );
        assert_eq!(
            approval(true, Some("RN")).as_deref(),
            Some("[Approved by Nurse: RN]")
        );
    }
}
