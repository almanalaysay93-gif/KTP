"""
Response formatting module for rule-based inquiry chatbot.
Returns approved answers, dynamic web app database records, and uncertainty fallbacks.
Never invents answers.
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
    """
    match_type = match_result.get("match_type")
    topics_by_id = {t["id"]: t for t in all_topics}
    ctx = context or {}
    is_authorized = bool(ctx.get("is_authorized", False))

    contact_snippet = (
        "SPMC Trunkline: (082) 227-2731 | Dialysis Local: 4128/4129 | Clinic Local: 4135"
    )

    # 1. Empty Query
    if match_type == "EMPTY_QUERY":
        default_msg = faq_meta.get(
            "default_message",
            "Welcome to SPMC Kidney Transplant Institute (SKTI) General Inquiries. Please select a topic below:",
        )
        return {
            "success": True,
            "answer": default_msg,
            "topic_id": None,
            "title": "General Inquiries",
            "match_type": match_type,
            "related_topics": [build_topic_pill(t) for t in all_topics],
            "candidate_topics": [build_topic_pill(t) for t in all_topics],
            "contact_snippet": contact_snippet,
            "live_synced": False,
        }

    # 2. Greeting
    if match_type == "GREETING":
        greeting_text = (
            "Hello! Welcome to SPMC SKTI General Inquiries. "
            "Please select a topic below or type your question regarding our services, operating hours, "
            "facility location, admission requirements, PhilHealth coverage, contact details, clinical units, or seminars."
        )
        return {
            "success": True,
            "answer": greeting_text,
            "topic_id": None,
            "title": "General Inquiries",
            "match_type": match_type,
            "related_topics": [build_topic_pill(t) for t in all_topics],
            "candidate_topics": [build_topic_pill(t) for t in all_topics],
            "contact_snippet": contact_snippet,
            "live_synced": False,
        }

    # 3. Exact or Single Match
    if match_type in ("EXACT_TOPIC", "EXACT_PHRASE", "SINGLE_MATCH"):
        topic = match_result["topic"]
        t_id = topic["id"]
        answer = topic["answer"]
        live_synced = False

        # Dynamic enrichment from live database context (Option D1)
        if t_id == "trainings":
            status = ctx.get("trainings_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Live training database records are currently unavailable. Please check the Training Calendar in the portal or contact the SKTI Training Coordinator.",
                    "topic_id": "trainings",
                    "title": "Seminars & Trainings",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "trainings"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                }

            upcoming = ctx.get("upcoming_trainings") or ctx.get("upcomingTrainings") or []
            if status == "success":
                live_synced = True
                if upcoming:
                    lines = [
                        "SPMC SKTI Seminars & Staff Trainings (Live Database):",
                        "",
                    ]
                    for item in upcoming:
                        t_name = item.get("trainingName") or item.get("name") or "Training"
                        t_date = item.get("scheduledDate") or item.get("date") or "TBD"
                        lines.append(f"• {t_name} — Scheduled: {t_date}")
                    lines.append("")
                    lines.append("Source: NurseTrack live seminar and training catalog.")
                    answer = "\n".join(lines)
                else:
                    answer = (
                        "SPMC SKTI Seminars & Staff Trainings:\n\n"
                        "There are currently no upcoming seminars or group training events scheduled in the database. "
                        "Please check the Training Calendar in the supervisor portal or inquire with the training coordinator."
                    )

        elif t_id == "areas":
            status = ctx.get("areas_status")
            if status == "failed":
                return {
                    "success": False,
                    "answer": "Clinical area database records are currently unavailable. Please contact the SKTI Nursing Office at local 4135.",
                    "topic_id": "areas",
                    "title": "Clinical Units & Areas",
                    "match_type": "DB_UNAVAILABLE",
                    "related_topics": [build_topic_pill(t) for t in all_topics if t["id"] != "areas"],
                    "candidate_topics": [],
                    "contact_snippet": contact_snippet,
                    "live_synced": False,
                }

            active_areas = ctx.get("active_areas") or ctx.get("activeAreas") or []
            total_staff = ctx.get("total_active_staff") or ctx.get("totalActiveStaff") or 0
            if status == "success":
                live_synced = True
                if active_areas:
                    lines = [
                        "SPMC SKTI Clinical Units & Areas (Live Database):",
                        "",
                    ]
                    for a in active_areas:
                        # Internal staff counts restricted to authorized sessions only
                        staff_cnt = a.get("staffCount")
                        count_suffix = f" ({staff_cnt} active staff assigned)" if (is_authorized and staff_cnt is not None) else ""
                        lines.append(f"• {a['name']}{count_suffix}")

                    if is_authorized and total_staff:
                        lines.append(f"\nTotal Active Staff Tracked: {total_staff}")
                    lines.append("\nSource: NurseTrack active area assignments.")
                    answer = "\n".join(lines)

        elif t_id == "services":
            active_areas = ctx.get("active_areas") or ctx.get("activeAreas") or []
            if active_areas:
                area_names = [a["name"] for a in active_areas[:6]]
                answer += "\n\nClinical Units currently active in hospital:\n" + "\n".join(f"• {name}" for name in area_names)
                live_synced = True

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
        }

    # 4. Ambiguous / Multiple Matches
    if match_type == "MULTIPLE_MATCHES":
        candidates = match_result.get("candidate_topics", [])
        candidate_pills = [build_topic_pill(c) for c in candidates]
        ambig_text = faq_meta.get(
            "ambiguous_message",
            "Your question matches multiple topics. Please select the specific topic you would like to know about:",
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
        }

    # 5. No Match / Unsupported Question
    fallback_text = faq_meta.get(
        "fallback_message",
        "I can only answer verified general inquiries about SPMC SKTI services, hours, location, requirements, fees, contact details, areas, and scheduled trainings. Please select one of the topics below or reach out to our staff directly.",
    )
    all_pills = [build_topic_pill(t) for t in all_topics]
    full_answer = (
        f"{fallback_text}\n\n"
        f"Available topics:\n"
        + "\n".join(f"• {t['name']}" for t in all_topics)
        + f"\n\nDirect Assistance:\n• {contact_snippet}\n• Location: SPMC Dialysis Complex, J.P. Laurel Ave, Bajada, Davao City"
    )

    return {
        "success": True,
        "answer": full_answer,
        "topic_id": None,
        "title": "General Inquiries",
        "match_type": "NO_MATCH",
        "related_topics": all_pills,
        "candidate_topics": all_pills,
        "contact_snippet": contact_snippet,
        "live_synced": False,
    }
