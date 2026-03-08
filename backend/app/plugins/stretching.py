from typing import Any


def generate_task(event: Any, additional_data: dict[str, Any]) -> dict[str, Any]:
    focus = str(additional_data.get("focus", "full body"))

    return {
        "type": "mobility",
        "summary": f"{event.name}: {focus} stretching",
        "session_plan": [
            "Breathing and neck release 2 minutes",
            "Dynamic mobility flow 6 minutes",
            "Static stretches 6 minutes",
        ],
        "notes": [event.description],
    }
