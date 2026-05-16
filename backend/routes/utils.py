import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List
from urllib.parse import urlparse

import requests


PANIC_KEYWORDS = {
    "scared", "panic", "afraid", "help me", "lost money", "kya karu",
    "ghabra", "dar lag raha", "confused", "please help", "urgent",
    "paise gaye", "hack ho gaya", "account hack", "what to do",
    "emergency", "bahut dar", "kuch samajh nahi", "trapped",
    "fraud ho gaya", "dhoka", "loot liya", "cheat hua",
}

CRISIS_KEYWORDS = {
    "suicide", "kill myself", "die", "hopeless", "end my life",
    "marna hai", "jeena nahi", "self harm", "no point living",
    "zindagi se", "khatam karna", "can't take it anymore",
}

# Time-sensitive urgency triggers (used for UPI/payment fraud triage)
URGENCY_KEYWORDS = {
    "just now", "abhi abhi", "right now", "few minutes ago",
    "1 hour", "2 hours", "just happened", "abhi hua",
    "paise abhi gaye", "just sent money", "now only",
}

CRISIS_RESPONSE_EN = (
    "You are not alone. Please get immediate support: "
    "iCall: 9152987821 | Vandrevala Foundation: 1860-2662-345. "
    "If you are in immediate danger, call your local emergency services now."
)

CRISIS_RESPONSE_HI = (
    "आप अकेले/अकेली नहीं हैं। तुरंत सहायता लें: "
    "iCall: 9152987821 | वंद्रेवाला फाउंडेशन: 1860-2662-345। "
    "यदि तुरंत खतरा है, तो स्थानीय आपातकालीन सेवाओं पर अभी कॉल करें।"
)

# Backward compatibility (older callers may import CRISIS_RESPONSE)
CRISIS_RESPONSE = CRISIS_RESPONSE_EN


def detect_emotion(text: str) -> str:
    lowered = text.lower()
    if any(k in lowered for k in CRISIS_KEYWORDS):
        return "crisis"
    if any(k in lowered for k in PANIC_KEYWORDS):
        return "panic"
    if any(k in lowered for k in URGENCY_KEYWORDS):
        return "panic"  # urgency escalates to panic for faster triage
    if re.search(r"\b(thank you|ok|fine|samajh gaya|samajh gayi|theek hai|dhanyavad)\b", lowered):
        return "calm"
    return "normal"


def sha_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def now_ts() -> int:
    return int(time.time())


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def domain_from_url(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def url_scam_signals(url: str) -> List[str]:
    signals: List[str] = []
    lowered = url.lower()
    host = domain_from_url(lowered)
    if "@" in lowered:
        signals.append("URL contains '@' redirection pattern")
    if re.search(r"(paytm|sbi|hdfc|icici|axis)[-_.]?(secure|verify|update)", lowered):
        signals.append("Possible fake banking verification pattern")
    if re.search(r"(bit\.ly|tinyurl\.com|rb\.gy|cutt\.ly)", lowered):
        signals.append("Shortened URL used to hide destination")
    if re.search(r"https?:\/\/[^\/]*\d{2,}", lowered):
        signals.append("Suspicious numeric-heavy domain")
    if host.startswith("xn--"):
        signals.append("Punycode domain detected (possible homograph attack)")
    if any(host.endswith(tld) for tld in [".zip", ".mov", ".top", ".click", ".xyz"]):
        signals.append("High-risk top-level domain often seen in scams")
    if re.search(r"(login|verify|urgent|update|reward|wallet|kyc|gift|refund)", lowered):
        signals.append("Urgency/social-engineering keywords present in URL")
    return signals


def safe_request_json(
    method: str,
    url: str,
    *,
    timeout: int = 10,
    headers: Dict[str, str] | None = None,
    json_body: Dict[str, Any] | None = None,
) -> Dict[str, Any] | None:
    try:
        resp = requests.request(
            method=method,
            url=url,
            timeout=timeout,
            headers=headers,
            json=json_body,
        )
        if resp.ok:
            return resp.json()
    except Exception as exc:
        logging.debug("Request failed for %s: %s", url, exc)
    return None

import tempfile
import os

def download_media_from_url(url: str, max_size_mb: int = 55, timeout: int = 15) -> tuple[str | None, str | None]:
    """
    Safely downloads media from a URL to a temporary file.
    Returns (temp_file_path, error_message).
    Enforces size limits and validates mime types basically.
    """
    try:
        resp = requests.get(url, stream=True, timeout=timeout, headers={"User-Agent": "veyron-backend"})
        resp.raise_for_status()
        
        content_type = resp.headers.get("Content-Type", "").lower()
        if not content_type.startswith(("image/", "video/")):
            return None, f"Unsupported media type from URL: {content_type}"
            
        content_length = resp.headers.get("Content-Length")
        if content_length and int(content_length) > max_size_mb * 1024 * 1024:
            return None, f"File exceeds maximum allowed size ({max_size_mb}MB)"
            
        ext = ".tmp"
        if "image/jpeg" in content_type: ext = ".jpg"
        elif "image/png" in content_type: ext = ".png"
        elif "image/webp" in content_type: ext = ".webp"
        elif "video/mp4" in content_type: ext = ".mp4"
        elif "video/quicktime" in content_type: ext = ".mov"
        elif "video/x-msvideo" in content_type: ext = ".avi"
        elif "video/webm" in content_type: ext = ".webm"
        
        temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
        downloaded_size = 0
        
        with os.fdopen(temp_fd, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    downloaded_size += len(chunk)
                    if downloaded_size > max_size_mb * 1024 * 1024:
                        os.remove(temp_path)
                        return None, f"File exceeds maximum allowed size ({max_size_mb}MB)"
                    f.write(chunk)
                    
        return temp_path, None
    except requests.exceptions.Timeout:
        return None, "Download timed out."
    except Exception as exc:
        logging.error(f"Failed to download media from URL {url}: {exc}")
        return None, "Failed to download media from the provided URL."
