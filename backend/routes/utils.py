import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List
from urllib.parse import urlparse

import requests


PANIC_KEYWORDS = {
    "scared",
    "panic",
    "afraid",
    "help me",
    "lost money",
    "kya karu",
    "ghabra",
    "dar lag raha",
    "confused",
}

CRISIS_KEYWORDS = {
    "suicide",
    "kill myself",
    "die",
    "hopeless",
    "end my life",
    "marna hai",
    "jeena nahi",
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
    if re.search(r"\b(thank you|ok|fine|samajh gaya|samajh gayi)\b", lowered):
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
