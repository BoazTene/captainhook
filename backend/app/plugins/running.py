from typing import Any


def generate_task(event: Any, additional_data: dict[str, Any]) -> dict[str, Any]:
    duration = int(additional_data.get("duration_minutes", 30))
    intensity = str(additional_data.get("intensity", "easy"))

    return {
        "type": "running",
        "summary": f"{intensity.title()} run for {duration} minutes",
        "workout": f"{duration} min {intensity} run",
        "session_plan": [
            "Warmup jog 5 minutes",
            f"Main set: {duration - 10 if duration > 10 else duration} minutes",
            "Cooldown jog 5 minutes",
        ],
        "notes": [event.description],
    }
