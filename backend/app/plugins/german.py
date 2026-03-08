from typing import Any


def generate_task(event: Any, additional_data: dict[str, Any]) -> dict[str, Any]:
    level = str(additional_data.get("level", "A1"))
    focus = str(additional_data.get("focus", "conversation"))

    return {
        "type": "language_practice",
        "summary": f"{event.name}: {focus} practice ({level})",
        "sentences": [
            "Ich lerne Deutsch.",
            "Wie war dein Tag?",
            "Kannst du das bitte wiederholen?",
        ],
        "session_plan": [
            "Warm-up with yesterday's 5 phrases",
            f"Focus on {focus} for 10 minutes",
            "Record a 60-second speaking note",
        ],
        "notes": [event.description],
    }
