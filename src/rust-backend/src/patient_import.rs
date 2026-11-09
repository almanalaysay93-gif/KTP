use crate::{AppState, admin_core, auth::Admin, error::ApiError, import_plan, validation as v};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;
use std::collections::HashMap;

const COLUMNS: &str = r#"hrn,"patientType","firstName","middleName","lastName",suffix,sex,"birthDate","contactNumber","accountEmail","nephrologistId","fellowId",stage,"riskCategory","surgeryDate","followupMonths",status,"linkedRecipientId""#;

pub async fn dispatch(
    State(state): State<AppState>,
    Extension(admin): Extension<Admin>,
    Path(operation): Path<String>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let commit = match operation.as_str() {
        "check" => false,
        "commit" => true,
        _ => return Err(ApiError(StatusCode::NOT_FOUND, "Unknown import operation")),
    };
    let rows = import_plan::validate(&input, commit)?;
    let file = if commit {
        v::opt_string(&input, "fileName", 255)?.unwrap_or_default()
    } else {
        String::new()
    };
    let mut tx = admin_core::begin(&state, &admin).await?;
    if commit {
        // Serialize imports before reading their validation snapshot. This lock
        // needs no schema objects and releases on either commit or rollback.
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(1_263_816_777_i64)
            .execute(&mut *tx)
            .await?;
    }
    // One statement gives registry rows and active doctors the same snapshot.
    let (SqlJson(registry),):(SqlJson<Value>,)=sqlx::query_as(r#"SELECT jsonb_build_object(
        'patients',COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM
            (SELECT id,hrn,lower("accountEmail") AS email,"patientType" FROM ktp.patients) p),'[]'::jsonb),
        'doctors',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM
            (SELECT id,name,role FROM ktp.doctors WHERE active=true) d),'[]'::jsonb))"#)
        .fetch_one(&mut *tx).await?;
    let saved = registry["patients"].as_array().ok_or(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "Invalid registry snapshot",
    ))?;
    let doctors = registry["doctors"].as_array().ok_or(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "Invalid doctor snapshot",
    ))?;
    let mut plans = import_plan::plan(rows, saved, doctors, &v::today());
    if !commit {
        let result = plans
            .iter()
            .map(|p| json!({"errors":p.errors,"warnings":p.warnings}))
            .collect::<Vec<_>>();
        tx.commit().await?;
        return Ok(Json(json!(result)));
    }
    if plans.iter().any(|p| !p.errors.is_empty()) {
        return Err(v::bad(
            "No patient was saved. Check the patient rows and correct the reported errors.",
        ));
    }
    let mut recipients: HashMap<String, i64> = saved
        .iter()
        .filter(|row| row["patientType"] == "Recipient")
        .filter_map(|row| {
            Some((
                row["hrn"].as_str().unwrap_or_default().to_lowercase(),
                row["id"].as_i64()?,
            ))
        })
        .collect();
    // Stable ordering preserves the file's order within each patient type.
    plans.sort_by_key(|p| p.data["patientType"] == "Donor");
    let mut ids = Vec::new();
    let sql = format!(
        "INSERT INTO ktp.patients ({COLUMNS}) SELECT {COLUMNS} FROM jsonb_populate_record(NULL::ktp.patients,$1) RETURNING id"
    );
    for mut plan in plans {
        let donor = plan.data["patientType"] == "Donor";
        plan.data["linkedRecipientId"] = if donor {
            json!(
                recipients
                    .get(&plan.linked_hrn.to_lowercase())
                    .ok_or(v::bad(
                        "No patient was saved. Linked recipient was not found."
                    ))?
            )
        } else {
            Value::Null
        };
        if donor {
            let recipient: Option<(i32,)> = sqlx::query_as(
                "SELECT id FROM ktp.patients WHERE id=$1 AND \"patientType\"='Recipient' FOR SHARE",
            )
            .bind(plan.data["linkedRecipientId"].as_i64().unwrap() as i32)
            .fetch_optional(&mut *tx)
            .await?;
            if recipient.is_none() {
                return Err(v::bad(
                    "No patient was saved. Linked recipient was not found.",
                ));
            }
        }
        let (id,): (i32,) = sqlx::query_as(&sql)
            .bind(SqlJson(&plan.data))
            .fetch_one(&mut *tx)
            .await?;
        if !donor {
            recipients.insert(
                import_plan::text(&plan.data, "hrn").to_lowercase(),
                i64::from(id),
            );
        }
        let details = json!({"hrn":plan.data["hrn"],"type":plan.data["patientType"],"file":file});
        sqlx::query(r#"INSERT INTO ktp."activityLog" ("actorUserId","patientId",action,details) VALUES ($1,$2,'IMPORT_PATIENT',$3)"#)
            .bind(admin.id).bind(id).bind(details.to_string()).execute(&mut *tx).await?;
        ids.push(id);
    }
    tx.commit().await?;
    Ok(Json(json!({"count":ids.len(),"ids":ids})))
}
