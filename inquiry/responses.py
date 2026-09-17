"""
Response formatting module for rule-based inquiry chatbot.
Returns approved answers, navigation buttons, and uncertainty fallbacks. Never invents answers.
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
) -> Dict[str, Any]:
    """
    Format standard response payload:
    - answer (str)
    - topic_id (str | None)
    - title (str)
    - related_topics (list of pills)
    - candidate_topics (list of pills)
    - match_type (str)
    """
    match_type = match_result.get("match_type")
    topics_by_id = {t["id"]: t for t in all_topics}

    # Common contact card
    contact_topic = topics_by_id.get("contact")
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
        }

    # 2. Exact or Single Match
    if match_type in ("EXACT_TOPIC", "EXACT_PHRASE", "SINGLE_MATCH"):
        topic = match_result["topic"]
        related_ids = topic.get("related_topics", [])
        related_pills = [
            build_topic_pill(topics_by_id[rid])
            for rid in related_ids
            if rid in topics_by_id
        ]

        return {
            "success": True,
            "answer": topic["answer"],
            "topic_id": topic["id"],
            "title": topic["name"],
            "match_type": match_type,
            "related_topics": related_pills,
            "candidate_topics": [],
            "contact_snippet": contact_snippet,
        }

    # 3. Ambiguous / Multiple Matches
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
        }

    # 4. No Match / Unsupported Question
    fallback_text = faq_meta.get(
        "fallback_message",
        "I can only answer verified general inquiries about SPMC SKTI services, hours, location, requirements, fees, and contact details. Please select one of the topics below or reach out to our staff directly.",
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
    }
