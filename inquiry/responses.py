"""
Response formatting module for rule-based NurseTrack Assistant.
Returns operational summaries, staff lookups, license compliance, seminar schedules,
and export shortcuts for supervisors. Never invents answers.
"""
from typing import Dict, Any, List, Optional


def build_topic_pill(topic: Dict[str, Any]) -> Dict[str, str]:
    """Helper to return compact topic metadata for buttons/pills."""
    return {
        "id": topic["id"],
        "name": topic["name"],
        "short_desc": topic.get("short_desc", ""),
    }


def format_inquiry_response(
    match_result: Dict[str, Any],
    all_topics: List[Dict[str, Any]],
    faq_meta: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Format standard response payload:
    - answer (str)
    - topic_id (str | None)
    - title (str)
    - related_topics (list of pills)
    - candidate_topics (list of pills)
    - match_type (str)
    - live_synced (bool)
    - action_links (list of {"label": str, "url": str})
    """
    match_type = match_result.get("match_type")
    topics_by_id = {t["id"]: t for t in all_topics}
    ctx = context or {}
    is_authorized = bool(ctx.get("is_authorized", False))

    contact_snippet = (
        "SKTI Nursing Office: (082) 227-2731 local 4135 | Dialysis Unit: local 4128/4129"
    )

    # 1. Empty Query
    if match_type == "EMPTY_QUERY":
        default_msg = faq_meta.get(
            "default_message",
            "Welcome to NurseTrack Assistant. Please select an operational task below:",
        )
        return {
            "success": True,
            "answer": default_msg,
            "topic_id": None,
            "title": "NurseTrack Assistant",
            "match_type": match_type,
            "related_topics": [build_topic_pill(t) for t in all_topics],
            "candidate_topics": [build_topic_pill(t) for t in all_topics],
            "contact_snippet": contact_snippet,
            "live_synced": False,
            "action_links": [],
        }

    # 2. Greeting
    if match_type == "GREETING":
        greeting_text = (
            "Hello! Welcome to NurseTrack Assistant. "
            "Select a task button below or ask about dashboard alerts, staff profiles, "
            "PRC license status, training follow-up, upcoming seminars, clinical units, calendar events, or reports."
        )
        return {
            "success": True,
            "answer": greeting_text,
            "topic_id": None,
            "title": "NurseTrack Assistant",
            "match_type": match_type,
            "related_topics": [build_topic_pill(t) for t in all_topics],
            "candidate_topics": [build_topic_pill(t) for t in all_topics],
            "contact_snippet": contact_snippet,
            "live_synced": False,
            "action_links": [],
        }

    # 3. Exact or Single Match
    if match_type in ("EXACT_TOPIC", "EXACT_PHRASE", "SINGLE_MATCH"):
        topic = match_result["topic"]
        t_id = topic["id"]
        answer = topic["answer"]
        live_synced = False
        action_links = list(topic.get("action_links", []))

        # Check authorization requirement for internal staff & compliance topics
        # Public callers cannot read supervisor data
        if not is_authorized and t_id in ("needs_attention", "find_staff", "license_status", "training_followup"):
            return {
                "success": True,
                "answer": (
                    f"{topic['name']}: Supervisor authentication required to view internal staff and compliance records. "
                    "Please sign in with an authorized SPMC SKTI supervisor account."
                ),
                "topic_id": t_id,
                "title": topic["name"],
                "match_type": match_type,
                "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != t_id],
                "candidate_topics": [],
                "contact_snippet": contact_snippet,
                "live_synced": False,
                "action_links": [{"label": "Supervisor Sign In", "url": "/dashboard"}],
            }

        # Dynamic enrichment from database context
        if t_id == "needs_attention":
            alerts_data = ctx.get("alerts_summary")
            status = ctx.get("alerts_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Dashboard alert records are currently unavailable. Please open the Dashboard Action Center directly.",
                    "topic_id": "needs_attention",
                    "title": "Needs Attention",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "needs_attention"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Open Dashboard", "url": "/dashboard"}],
                }
            if status == "success" and alerts_data:
                live_synced = True
                total = alerts_data.get("total", 0)
                lic_urgent = alerts_data.get("licenseUrgent", 0)
                train_urgent = alerts_data.get("trainingUrgent", 0)
                items = alerts_data.get("topItems", [])

                lines = [
                    f"NurseTrack Action Center ({total} item{'s' if total != 1 else ''} need attention):",
                    f"• Licenses expired or expiring soon: {lic_urgent}",
                    f"• Overdue or expired trainings: {train_urgent}",
                ]
                if items:
                    lines.append("\nTop urgent alerts:")
                    for item in items[:5]:
                        lines.append(f"• {item.get('title', '')}")
                else:
                    lines.append("\nAll credentials and scheduled trainings are currently in good standing.")
                answer = "\n".join(lines)

        elif t_id == "find_staff":
            staff_data = ctx.get("staff_summary")
            matched_staff = ctx.get("matched_staff")
            status = ctx.get("staff_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Staff roster database is currently unavailable. Please view Staff Directory directly.",
                    "topic_id": "find_staff",
                    "title": "Find Staff",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "find_staff"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Open Staff Directory", "url": "/nurses"}],
                }
            if status == "success":
                live_synced = True
                if matched_staff is not None:
                    # User searched a specific name or query
                    if matched_staff:
                        lines = [f"Found {len(matched_staff)} matching staff member(s):", ""]
                        for s in matched_staff[:5]:
                            area_part = f" — {s.get('areaName')}" if s.get("areaName") else ""
                            prc_part = f" [PRC: {s.get('prcLicenseNumber')}]" if s.get("prcLicenseNumber") else ""
                            lines.append(f"• {s.get('name')} ({s.get('staffType', 'Staff')}){area_part}{prc_part}")
                        lines.append("\nClick below to open profile in Staff Directory.")
                        answer = "\n".join(lines)
                    else:
                        answer = (
                            "No active staff found matching your search. "
                            "Please check spelling or open the Staff Directory to view all profiles."
                        )
                elif staff_data:
                    total = staff_data.get("total", 0)
                    rn_count = staff_data.get("rnCount", 0)
                    na_count = staff_data.get("naCount", 0)
                    answer = (
                        f"Active Staff Roster Overview:\n"
                        f"• Total active staff: {total}\n"
                        f"• Registered Nurses (RN): {rn_count}\n"
                        f"• Nursing Attendants (NA): {na_count}\n\n"
                        f"Type a staff name (e.g., 'find nurse Maria' or 'search Dela Cruz') to inspect individual profiles."
                    )

        elif t_id == "license_status":
            lic_data = ctx.get("licenses_summary")
            status = ctx.get("licenses_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "License records are currently unavailable. Please open License Registry.",
                    "topic_id": "license_status",
                    "title": "License Status",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "license_status"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Open License Registry", "url": "/licenses"}],
                }
            if status == "success" and lic_data:
                live_synced = True
                expired = lic_data.get("expired", 0)
                within_6m = lic_data.get("within6Months", 0)
                within_1y = lic_data.get("within1Year", 0)
                valid = lic_data.get("valid", 0)
                total = lic_data.get("total", 0)
                urgent_items = lic_data.get("urgentItems", [])

                lines = [
                    f"PRC License Compliance Overview ({total} total active credentials):",
                    f"• Expired: {expired}",
                    f"• Within 6 Months: {within_6m}",
                    f"• Within 1 Year: {within_1y}",
                    f"• Valid: {valid}",
                ]
                if urgent_items:
                    lines.append("\nPriority Renewal Watch List:")
                    for it in urgent_items[:5]:
                        lines.append(f"• {it.get('nurseName')}: {it.get('status')} ({it.get('daysText')})")
                answer = "\n".join(lines)

        elif t_id == "training_followup":
            followup_data = ctx.get("followup_summary")
            status = ctx.get("followup_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Training follow-up database is currently unavailable. Please check the Trainings tab.",
                    "topic_id": "training_followup",
                    "title": "Training Follow-up",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "training_followup"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Open Training Follow-up", "url": "/trainings"}],
                }
            if status == "success" and followup_data:
                live_synced = True
                counts = followup_data.get("counts", {})
                pending_resp = counts.get("pendingResponse", 0)
                evidence_rev = counts.get("evidenceReview", 0)
                cannot_att = counts.get("cannotAttend", 0)
                missing_email = counts.get("missingEmail", 0)
                missed = counts.get("missed", 0)
                total = counts.get("total", 0)

                lines = [
                    f"Training Follow-up & Reminders ({total} total assigned):",
                    f"• Pending Staff Response: {pending_resp}",
                    f"• Evidence Review (Certificates Uploaded): {evidence_rev}",
                    f"• Cannot Attend Conflicts: {cannot_att}",
                    f"• Missing Email (Undeliverable): {missing_email}",
                    f"• Missed Attendance: {missed}",
                    "",
                    "Open Training Follow-up tab to record attendance or review submitted certificates."
                ]
                answer = "\n".join(lines)

        elif t_id == "upcoming_seminars":
            status = ctx.get("seminars_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Upcoming seminar schedule is currently unavailable. Please open Seminars page.",
                    "topic_id": "upcoming_seminars",
                    "title": "Upcoming Seminars",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "upcoming_seminars"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Open Seminars", "url": "/seminars"}],
                }
            seminars = ctx.get("seminar_events") or []
            if status == "success":
                live_synced = True
                if seminars:
                    lines = ["Upcoming Scheduled Seminars & LDI Events:", ""]
                    for ev in seminars[:5]:
                        venue_str = f" @ {ev.get('venue')}" if ev.get("venue") else ""
                        dates_str = ev.get("dateStr", "TBD")
                        enrolled = ev.get("enrolledCount", 0)
                        lines.append(f"• {ev.get('title')} — {dates_str}{venue_str} ({enrolled} enrolled)")
                    answer = "\n".join(lines)
                else:
                    answer = (
                        "Upcoming Seminars & LDI:\n\n"
                        "There are currently no upcoming hospital seminars or workshops scheduled in the database. "
                        "You can create new events in the Seminars module."
                    )

        elif t_id == "area_assignments":
            status = ctx.get("areas_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Clinical area database records are currently unavailable. Please open Areas page.",
                    "topic_id": "area_assignments",
                    "title": "Area Assignments",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "area_assignments"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Manage Clinical Units", "url": "/areas"}],
                }
            active_areas = ctx.get("active_areas") or []
            total_staff = ctx.get("total_active_staff") or 0
            if status == "success":
                live_synced = True
                if active_areas:
                    lines = ["SPMC SKTI Staff Allocation by Clinical Unit:", ""]
                    for a in active_areas:
                        staff_cnt = a.get("staffCount")
                        cnt_str = f" — {staff_cnt} active staff" if (is_authorized and staff_cnt is not None) else ""
                        lines.append(f"• {a['name']}{cnt_str}")
                    if is_authorized and total_staff:
                        lines.append(f"\nTotal Active Staff Tracked: {total_staff}")
                    answer = "\n".join(lines)

        elif t_id == "calendar":
            cal_data = ctx.get("calendar_summary")
            status = ctx.get("calendar_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Calendar records are currently unavailable. Please open Master Calendar.",
                    "topic_id": "calendar",
                    "title": "Calendar",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "calendar"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                    "action_links": [{"label": "Open Master Calendar", "url": "/calendar"}],
                }
            if status == "success" and cal_data:
                live_synced = True
                today_items = cal_data.get("todayEvents", [])
                week_items = cal_data.get("weekEvents", [])

                lines = [
                    "Master Calendar Schedule Summary:",
                    f"• Scheduled Today ({len(today_items)} event{'s' if len(today_items) != 1 else ''})",
                ]
                for it in today_items[:3]:
                    lines.append(f"  - {it.get('title')}")
                if not today_items:
                    lines.append("  - No events scheduled for today.")

                lines.append(f"• Scheduled This Week ({len(week_items)} event{'s' if len(week_items) != 1 else ''})")
                for it in week_items[:4]:
                    lines.append(f"  - {it.get('date')}: {it.get('title')}")
                if not week_items:
                    lines.append("  - No upcoming events this week.")

                lines.append("\nOpen Master Calendar to review full month view and add events.")
                answer = "\n".join(lines)

        related_ids = topic.get("related_topics", [])
        related_pills = [
            build_topic_pill(topics_by_id[rid])
            for rid in related_ids
            if rid in topics_by_id
        ]

        return {
            "success": True,
            "answer": answer,
            "topic_id": topic["id"],
            "title": topic["name"],
            "match_type": match_type,
            "related_topics": related_pills,
            "candidate_topics": [],
            "contact_snippet": contact_snippet,
            "live_synced": live_synced,
            "action_links": action_links,
        }

    # 4. Ambiguous / Multiple Matches
    if match_type == "MULTIPLE_MATCHES":
        candidates = match_result.get("candidate_topics", [])
        candidate_pills = [build_topic_pill(c) for c in candidates]
        ambig_text = faq_meta.get(
            "ambiguous_message",
            "Your question matches multiple NurseTrack tasks. Please select the specific area you would like to view:",
        )
        lines = [ambig_text, ""]
        for c in candidates:
            lines.append(f"• {c['name']}: {c.get('short_desc', '')}")

        return {
            "success": True,
            "answer": "\n".join(lines),
            "topic_id": None,
            "title": "Topic Selection",
            "match_type": match_type,
            "related_topics": candidate_pills,
            "candidate_topics": candidate_pills,
            "contact_snippet": contact_snippet,
            "live_synced": False,
            "action_links": [],
        }

    # 5. No Match / Unsupported Question
    fallback_text = faq_meta.get(
        "fallback_message",
        "I can only answer verified NurseTrack supervisor inquiries. Please select one of the task buttons below.",
    )
    all_pills = [build_topic_pill(t) for t in all_topics]
    full_answer = (
        f"{fallback_text}\n\n"
        f"Available NurseTrack Tasks:\n"
        + "\n".join(f"• {t['name']} ({t.get('short_desc', '')})" for t in all_topics)
        + f"\n\nDirect Nursing Office: {contact_snippet}"
    )

    return {
        "success": True,
        "answer": full_answer,
        "topic_id": None,
        "title": "NurseTrack Assistant",
        "match_type": "NO_MATCH",
        "related_topics": all_pills,
        "candidate_topics": all_pills,
        "contact_snippet": contact_snippet,
        "live_synced": False,
        "action_links": [],
    }
