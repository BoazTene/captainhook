from __future__ import annotations

import random
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen
from xml.etree import ElementTree

EASY_GERMAN_CHANNEL_URL = "https://www.youtube.com/@EasyGerman"
EASY_GERMAN_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCbxb2fqe9oNgglAoYqsYOtQ"
ATOM_NAMESPACE = {"atom": "http://www.w3.org/2005/Atom"}


def _get_random_easy_german_video_url() -> str:
    try:
        with urlopen(EASY_GERMAN_FEED_URL, timeout=5) as response:
            feed_xml = response.read()
    except (TimeoutError, URLError, ValueError):
        return EASY_GERMAN_CHANNEL_URL

    try:
        root = ElementTree.fromstring(feed_xml)
    except ElementTree.ParseError:
        return EASY_GERMAN_CHANNEL_URL

    links = []
    for entry in root.findall("atom:entry", ATOM_NAMESPACE):
        link = entry.find("atom:link", ATOM_NAMESPACE)
        href = (link.get("href", "") if link is not None else "").strip()
        if href:
            links.append(href)

    video_links = [link for link in links if link.startswith("https://www.youtube.com/watch")]
    if not video_links:
        return EASY_GERMAN_CHANNEL_URL

    return random.choice(video_links)

def generate_task(event: Any, additional_data: dict[str, Any]) -> dict[str, Any]:
    video_url = _get_random_easy_german_video_url()
    description = getattr(event, "description", "") or "Do one short German session."

    return {
        "type": "language_practice",
        "summary": "Do Duolingo",
        "sentences": ["Do Duolingo"],
        "session_plan": [
            "Do one Duolingo lesson",
            "Watch one random Easy German video",
            f"Open video: {video_url}",
        ],
        "notes": [
            description,
            f"Easy German video: {video_url}",
        ],
    }
