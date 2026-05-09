from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
import logging
import os
import socket
import tempfile
import time
import ssl
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, EmailStr, Field, HttpUrl
import requests
import numpy as np

from config import firebase_store, load_json_file, settings
from routes.deepfake_pipeline import DeepfakeDetector
from routes.utils import (
    domain_from_url,
    iso_now,
    now_ts,
    safe_request_json,
    sha_key,
    url_scam_signals,
)

router = APIRouter(tags=["detectors"])
logger = logging.getLogger("veyron-backend.detectors")

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
GOV_APPS_DB = load_json_file(DATA_DIR / "gov_apps.json")
CACHE_TTL_SECONDS = 24 * 60 * 60
BREACH_DIRECTORY_URL = "https://breachdirectory.org/api/v1/breach"
XPOSEDORNOT_ANALYTICS_URL = "https://api.xposedornot.com/v1/breach-analytics"
VIRUSTOTAL_URL_SCAN_URL = "https://www.virustotal.com/api/v3/urls"
VIRUSTOTAL_ANALYSIS_URL = "https://www.virustotal.com/api/v3/analyses/{analysis_id}"
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com",
    "temp-mail.org",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "sharklasers.com",
    "getnada.com",
}

LOCAL_CACHE: Dict[str, Dict[str, Any]] = {}
DEEPFAKE_ENGINE: Optional["DeepfakeDetector"] = None
IO_POOL = ThreadPoolExecutor(max_workers=6)


class EmailCheckRequest(BaseModel):
    email: EmailStr


class LinkScanRequest(BaseModel):
    url: HttpUrl


class AppCheckRequest(BaseModel):
    appName: str = Field(min_length=2, max_length=120)
    packageName: Optional[str] = None


class DeepfakeCheckRequest(BaseModel):
    mediaUrl: HttpUrl


def _normalize_deepfake_verdict_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw_verdict = str(payload.get("verdict", "")).strip().upper()
    legacy = str(payload.get("legacy_verdict", "")).strip().lower()
    fusion = payload.get("fusion_score")
    ai_model_score = float(payload.get("ai_model_score", 0.0) or 0.0)
    forensic_score = float(payload.get("forensic_score", 0.0) or 0.0)
    confidence_calibration = float(payload.get("confidence_calibration", 0.0) or 0.0)

    if raw_verdict not in {"REAL", "AI GENERATED", "UNCERTAIN"} and isinstance(fusion, (int, float)):
        f = float(fusion)
        if f <= 0.35:
            raw_verdict = "REAL"
        elif f >= 0.65:
            raw_verdict = "AI GENERATED"
        else:
            raw_verdict = "UNCERTAIN"

    if raw_verdict not in {"REAL", "AI GENERATED", "UNCERTAIN"}:
        if legacy == "real":
            raw_verdict = "REAL"
        elif legacy == "fake":
            raw_verdict = "AI GENERATED"
        else:
            raw_verdict = "UNCERTAIN"

    if (
        ai_model_score >= 0.80
        and confidence_calibration >= 0.55
        and forensic_score >= 0.15
    ):
        raw_verdict = "AI GENERATED"

    if raw_verdict == "REAL":
        color = "green"
        reason = "Signals mostly align with authentic image characteristics."
    elif raw_verdict == "AI GENERATED":
        color = "red"
        reason = "ML and forensic indicators align with synthetic image patterns."
    else:
        color = "yellow"
        reason = "Signals conflict or confidence is insufficient for a reliable determination."

    conf_raw = payload.get("confidence_percent", payload.get("confidencePercent", payload.get("confidence", 50)))
    conf_val = float(conf_raw) if isinstance(conf_raw, (int, float)) else 50.0
    if conf_val <= 1.0:
        conf_val *= 100.0
    conf_pct = int(max(0, min(100, round(conf_val))))

    payload["verdict"] = raw_verdict
    payload["verdict_color"] = color
    payload["confidence_percent"] = conf_pct
    payload["confidencePercent"] = conf_pct
    payload["confidence"] = round(conf_pct / 100.0, 4)
    payload["confidenceScore"] = round(conf_pct / 100.0, 4)
    payload["verdict_reason"] = str(payload.get("verdict_reason") or reason)
    return payload


def _deepfake_engine() -> DeepfakeDetector:
    global DEEPFAKE_ENGINE
    if DEEPFAKE_ENGINE is None:
        DEEPFAKE_ENGINE = DeepfakeDetector()
    return DEEPFAKE_ENGINE


def detect_deepfake_file(file_path: str) -> Dict[str, Any]:
    return _deepfake_engine().detect_deepfake(file_path)


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    value = LOCAL_CACHE.get(key)
    if value and (now_ts() - value["timestamp"] <= CACHE_TTL_SECONDS):
        return value["data"]
    if firebase_store.enabled:
        doc = firebase_store.get_document("scan_cache", key)
        if doc and now_ts() - int(doc.get("timestamp", 0)) <= CACHE_TTL_SECONDS:
            return doc.get("data")
    return None


def _cache_set(key: str, data: Dict[str, Any]) -> None:
    payload = {"timestamp": now_ts(), "data": data}
    LOCAL_CACHE[key] = payload
    if firebase_store.enabled:
        firebase_store.save_document("scan_cache", key, payload)


def _risk_score_from_breaches(count: int) -> int:
    return min(count * 25, 100)


def _breach_severity_weight(exposed_data: List[str]) -> int:
    lowered = {x.lower().strip() for x in exposed_data}
    high = {"password", "passwords", "security questions", "credit card", "aadhaar", "pan"}
    medium = {"phone numbers", "phone", "name", "address", "username"}
    if lowered & high:
        return 20
    if lowered & medium:
        return 10
    return 5


def _fetch_hibp(email: str) -> List[Dict[str, Any]]:
    if not settings.hibp_api_key:
        return []
    headers = {
        "hibp-api-key": settings.hibp_api_key,
        "user-agent": "veyron-backend",
    }
    url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}?truncateResponse=false"
    data = safe_request_json("GET", url, headers=headers, timeout=8)
    if not isinstance(data, list):
        return []
    hits: List[Dict[str, Any]] = []
    for item in data[:10]:
        hits.append(
            {
                "service": item.get("Name", "Unknown"),
                "date": item.get("BreachDate", "Unknown"),
                "exposed_data": item.get("DataClasses", ["email"]),
                "severity": min(100, 35 + _breach_severity_weight(item.get("DataClasses", ["email"]))),
                "actions": ["Change password", "Enable 2FA"],
            }
        )
    return hits


def _list_value(value: Any, default: Optional[List[str]] = None) -> List[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if isinstance(value, str) and value.strip():
        return [part.strip() for part in value.split(",") if part.strip()]
    return default or []


def _first_value(item: Dict[str, Any], keys: List[str], default: str) -> str:
    for key in keys:
        value = item.get(key)
        if value:
            return str(value)
    return default


def _normalize_breach_directory_item(item: Dict[str, Any]) -> Dict[str, Any]:
    exposed_data = (
        _list_value(item.get("fields"))
        or _list_value(item.get("exposed_data"))
        or _list_value(item.get("data_classes"))
        or _list_value(item.get("dataClasses"))
        or ["email"]
    )
    service = _first_value(
        item,
        ["name", "title", "source", "breach", "site", "domain"],
        "External breach source",
    )
    date = _first_value(
        item,
        ["date", "breach_date", "breachDate", "leak_date", "added"],
        "Unknown",
    )
    return {
        "service": service,
        "name": service,
        "date": date,
        "exposed_data": exposed_data,
        "exposedData": exposed_data,
        "severity": min(100, 30 + _breach_severity_weight(exposed_data)),
        "source": "Breach Directory",
        "actions": ["Change password immediately", "Enable 2FA"],
    }


def _normalize_xposedornot_item(item: Dict[str, Any]) -> Dict[str, Any]:
    exposed_data = (
        _list_value(item.get("xposed_data").replace(";", ",") if isinstance(item.get("xposed_data"), str) else None)
        or _list_value(item.get("exposedData"))
        or ["email"]
    )
    service = _first_value(item, ["breach", "name", "breachID"], "External breach source")
    date = _first_value(item, ["xposed_date", "breachedDate", "date"], "Unknown")
    return {
        "service": service,
        "name": service,
        "date": date,
        "domain": item.get("domain", ""),
        "exposed_data": exposed_data,
        "exposedData": exposed_data,
        "severity": min(100, 28 + _breach_severity_weight(exposed_data)),
        "source": "XposedOrNot",
        "actions": ["Change password immediately", "Enable 2FA"],
    }


def _extract_breach_directory_results(data: Any) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []
    for key in ("results", "result", "breaches", "data"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _fetch_breach_directory(email: str) -> tuple[List[Dict[str, Any]], Optional[str]]:
    try:
        response = requests.get(
            BREACH_DIRECTORY_URL,
            params={"term": email},
            headers={"user-agent": "veyron-backend"},
            timeout=8,
        )
        if response.status_code == 404:
            return [], None
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.warning("Breach Directory lookup failed for domain=%s: %s", email.split("@")[-1], exc)
        return [], "Could not check breach sources at this time."

    return [_normalize_breach_directory_item(item) for item in _extract_breach_directory_results(data)[:10]], None


def _fetch_xposedornot(email: str) -> tuple[List[Dict[str, Any]], Optional[str]]:
    try:
        response = requests.get(
            XPOSEDORNOT_ANALYTICS_URL,
            params={"email": email},
            headers={"accept": "application/json", "user-agent": "veyron-backend"},
            timeout=8,
        )
        if response.status_code == 404:
            return [], None
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.warning("XposedOrNot lookup failed for domain=%s: %s", email.split("@")[-1], exc)
        return [], "Could not check breach sources at this time."

    if isinstance(data, dict) and data.get("Error"):
        return [], None
    details: List[Dict[str, Any]] = []
    if isinstance(data, dict):
        exposed = data.get("ExposedBreaches")
        if isinstance(exposed, dict):
            raw_details = exposed.get("breaches_details", [])
            if isinstance(raw_details, list):
                details = [item for item in raw_details if isinstance(item, dict)]
        elif isinstance(exposed, list):
            details = [item for item in exposed if isinstance(item, dict)]
        elif isinstance(data.get("breaches_details"), list):
            details = [item for item in data.get("breaches_details", []) if isinstance(item, dict)]
    if not isinstance(details, list):
        return [], None
    email_domain = email.split("@")[-1].lower()
    email_brand = email_domain.split(".")[0]

    def relevance(item: Dict[str, Any]) -> tuple[int, str]:
        breach_name = str(item.get("breach", "")).lower()
        breach_domain = str(item.get("domain", "")).lower()
        if breach_domain.endswith(email_domain):
            return (0, breach_name)
        if email_brand and email_brand in breach_name:
            return (1, breach_name)
        return (2, breach_name)

    sorted_details = sorted(details, key=relevance)
    return [_normalize_xposedornot_item(item) for item in sorted_details[:10]], None


@router.post("/check-email")
def check_email(payload: EmailCheckRequest) -> Dict[str, Any]:
    logger.info("Email check requested for domain=%s", payload.email.split("@")[-1])
    key = f"email:{sha_key(payload.email.lower())}"
    cached = _cache_get(key)
    if cached:
        return cached

    try:
        hibp_f = IO_POOL.submit(_fetch_hibp, payload.email)
        ext_f = IO_POOL.submit(_fetch_breach_directory, payload.email)
        hibp_hits = hibp_f.result()
        external_hits, external_error = ext_f.result()
        if external_error or not external_hits:
            fallback_hits, fallback_error = IO_POOL.submit(_fetch_xposedornot, payload.email).result()
            if fallback_hits:
                external_hits = fallback_hits
                external_error = None
            elif external_error:
                external_error = fallback_error or external_error
    except Exception as exc:
        logger.exception("Email provider lookup failed for domain=%s: %s", payload.email.split("@")[-1], exc)
        hibp_hits = []
        external_hits = []
        external_error = "Some breach providers were temporarily unavailable. Results may be incomplete."
    breaches = (hibp_hits + external_hits)[:10]
    domain = payload.email.split("@")[-1].lower()
    disposable = domain in DISPOSABLE_EMAIL_DOMAINS
    severity_boost = min(35, sum(int(b.get("severity", 20)) for b in breaches) // 8)
    score = min(100, _risk_score_from_breaches(len(breaches)) + severity_boost + (15 if disposable else 0))
    is_safe = len(breaches) == 0
    recommendations = (
        [
            "Change password immediately",
            "Enable 2FA on all accounts",
            "Monitor credit reports and account activity",
            "Beware of targeted phishing emails and calls",
        ]
        if breaches
        else ["Keep monitoring your email and use unique passwords"]
    )
    legacy_breaches = [
        {
            "name": b["service"],
            "date": b["date"],
            "exposedData": b.get("exposed_data", []),
            "victims": 0,
            "whatToDo": ", ".join(b.get("actions", [])) or "Change password",
        }
        for b in breaches
    ]
    response = {
        "email": payload.email,
        "breaches_found": len(breaches) > 0,
        "breaches": breaches,
        "breach_count": len(breaches),
        "is_safe": is_safe,
        "risk_score": score,
        "disposable_domain": disposable,
        "email_domain": domain,
        # Backward compatibility for current frontend
        "breachesFoundRaw": breaches,
        "breachesFound": legacy_breaches,
        "isSafe": is_safe,
        "riskScore": score,
        "recommendations": recommendations,
        "englishSummary": (
            "This email appears in known breach sources. Change passwords immediately and enable 2FA."
            if breaches
            else "No matching records were found for this email in the configured breach sources."
        ),
        "hindiSummary": (
            "यह ईमेल ज्ञात डेटा ब्रीच स्रोतों में मिला है। तुरंत पासवर्ड बदलें और 2FA सक्षम करें।"
            if breaches
            else "कॉन्फ़िगर किए गए ब्रीच स्रोतों में इस ईमेल का कोई रिकॉर्ड नहीं मिला।"
        ),
    }
    if external_error and not hibp_hits:
        response["warning"] = "Some breach providers were temporarily unavailable. Results may be incomplete."
    if disposable:
        response.setdefault("recommendations", []).insert(0, "Disposable email detected: avoid using this email for sensitive accounts.")
    _cache_set(key, response)
    logger.info(
        "Email check complete for domain=%s isSafe=%s breaches=%s risk=%s",
        payload.email.split("@")[-1],
        response["is_safe"],
        response["breach_count"],
        response["risk_score"],
    )
    return response


def _domain_age_from_whois(domain: str) -> str:
    # Lightweight fallback heuristic without paid WHOIS dependency.
    if any(tld in domain for tld in [".xyz", ".top", ".click"]):
        return "Likely very new"
    return "Unknown"


def _check_domain_reachability(url: str) -> tuple[bool, Optional[str]]:
    try:
        parsed = requests.utils.urlparse(url)
        host = parsed.hostname
        if not host:
            return False, "URL hostname could not be parsed."
        try:
            socket.getaddrinfo(host, None)
        except OSError:
            return False, "Domain DNS lookup failed."

        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        try:
            with socket.create_connection((host, port), timeout=4):
                pass
        except OSError:
            return False, "Domain could not be reached."
    except Exception as exc:
        return False, f"Domain validation failed: {exc}"
    return True, None


def _redirect_profile(url: str) -> tuple[List[str], Optional[str]]:
    try:
        response = requests.get(url, allow_redirects=True, timeout=8, headers={"user-agent": "veyron-backend"})
        chain = [r.url for r in response.history] + [response.url]
        if len(chain) > 6:
            return chain, "Long redirect chain detected."
        return chain, None
    except Exception as exc:
        return [], f"Redirect analysis failed: {exc}"


def _domain_entropy(domain: str) -> float:
    if not domain:
        return 0.0
    counts: Dict[str, int] = {}
    for ch in domain:
        counts[ch] = counts.get(ch, 0) + 1
    n = float(len(domain))
    ent = 0.0
    for c in counts.values():
        p = c / n
        ent -= p * np.log2(p)
    return float(ent)


def _ssl_snapshot(url: str) -> tuple[Dict[str, Any], Optional[str]]:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return {"https": False, "cert_validity_days": None}, "URL is not HTTPS."
    host = parsed.hostname
    if not host:
        return {"https": True, "cert_validity_days": None}, "HTTPS hostname parse failed."
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
        not_after = cert.get("notAfter")
        days_left = None
        if not_after:
            exp_ts = time.mktime(time.strptime(not_after, "%b %d %H:%M:%S %Y %Z"))
            days_left = int((exp_ts - time.time()) // 86400)
        return {"https": True, "cert_validity_days": days_left}, None
    except Exception as exc:
        return {"https": True, "cert_validity_days": None}, f"SSL check failed: {exc}"


def _link_recommendations(verdict: str) -> List[str]:
    if verdict == "dangerous":
        return [
            "Do not open this link or enter any personal information.",
            "If you already interacted with it, change affected passwords immediately.",
            "Report the URL to your browser, email provider, or cybercrime.gov.in.",
        ]
    if verdict == "suspicious":
        return [
            "Do not enter passwords, OTPs, UPI PINs, or card details.",
            "Verify the link from the official website or app before proceeding.",
            "Open it only in an isolated browser profile if absolutely necessary.",
        ]
    if verdict == "unknown":
        return [
            "Scan could not be completed because the security API is not configured or failed.",
            "Do not rely on this result until VirusTotal or Safe Browsing is working.",
            "Manually verify the domain from an official source before clicking.",
        ]
    return [
        "No malicious engines flagged this URL in the configured checks.",
        "Still verify login and payment pages before entering sensitive information.",
        "Use unique passwords and two-factor authentication.",
    ]


def _google_safe_browsing(url: str) -> tuple[Dict[str, Any], Optional[str]]:
    if not settings.safe_browsing_api_key:
        return {"matches": []}, "Google Safe Browsing API key is not configured."
    endpoint = (
        "https://safebrowsing.googleapis.com/v4/threatMatches:find"
        f"?key={settings.safe_browsing_api_key}"
    )
    body = {
        "client": {"clientId": "veyron-backend", "clientVersion": "1.0.0"},
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    try:
        response = requests.post(endpoint, json=body, timeout=8)
        if response.status_code in {401, 403}:
            message = response.json().get("error", {}).get("message", "unauthorized")
            return {"matches": []}, f"Google Safe Browsing API error: {message}"
        response.raise_for_status()
        return response.json(), None
    except Exception as exc:
        logger.warning("Google Safe Browsing lookup failed for url=%s: %s", url, exc)
        return {"matches": []}, f"Google Safe Browsing request failed: {exc}"


def _empty_vt_stats() -> Dict[str, int]:
    return {
        "malicious": 0,
        "suspicious": 0,
        "harmless": 0,
        "undetected": 0,
        "timeout": 0,
    }


def _virustotal_url_check(url: str) -> tuple[Dict[str, Any], Optional[str]]:
    if not settings.virustotal_api_key:
        return {"stats": _empty_vt_stats(), "results": {}}, "VirusTotal API key is not configured."
    headers = {"x-apikey": settings.virustotal_api_key}
    try:
        submit_response = requests.post(
            VIRUSTOTAL_URL_SCAN_URL,
            headers=headers,
            data={"url": url},
            timeout=12,
        )
        if submit_response.status_code in {401, 403}:
            return {"stats": _empty_vt_stats(), "results": {}}, "VirusTotal API key is invalid or unauthorized."
        submit_response.raise_for_status()
        submit = submit_response.json()
    except Exception as exc:
        logger.warning("VirusTotal submit failed for url=%s: %s", url, exc)
        return {"stats": _empty_vt_stats(), "results": {}}, f"VirusTotal submit failed: {exc}"

    analysis_id = submit.get("data", {}).get("id")
    if not analysis_id:
        return {"stats": _empty_vt_stats(), "results": {}}, "VirusTotal did not return an analysis id."

    analysis: Dict[str, Any] = {}
    for attempt in range(3):
        try:
            analysis_response = requests.get(
                VIRUSTOTAL_ANALYSIS_URL.format(analysis_id=analysis_id),
                headers=headers,
                timeout=12,
            )
            if analysis_response.status_code in {401, 403}:
                return {"stats": _empty_vt_stats(), "results": {}}, "VirusTotal API key is invalid or unauthorized."
            analysis_response.raise_for_status()
            analysis = analysis_response.json()
        except Exception as exc:
            logger.warning("VirusTotal analysis failed for id=%s: %s", analysis_id, exc)
            return {"stats": _empty_vt_stats(), "results": {}}, f"VirusTotal analysis failed: {exc}"

        status = analysis.get("data", {}).get("attributes", {}).get("status")
        if status != "queued" or attempt == 2:
            break
        time.sleep(1)

    attributes = analysis.get("data", {}).get("attributes", {})
    stats = attributes.get("stats") or attributes.get("last_analysis_stats") or {}
    if not stats:
        return {"stats": _empty_vt_stats(), "results": {}}, "VirusTotal analysis did not include detection stats yet."
    normalized_stats = _empty_vt_stats()
    for key in normalized_stats:
        normalized_stats[key] = int(stats.get(key, 0) or 0)

    return {
        "analysis_id": analysis_id,
        "stats": normalized_stats,
        "results": attributes.get("results", {}),
        "status": attributes.get("status", "completed"),
    }, None


@router.post("/scan-link")
def scan_link(payload: LinkScanRequest) -> Dict[str, Any]:
    url = str(payload.url)
    logger.info("Link scan requested url=%s", url)
    key = f"url:v2:{sha_key(url)}"
    cached = _cache_get(key)
    if cached:
        return cached

    domain_reachable, domain_error = _check_domain_reachability(url)

    vt_future = IO_POOL.submit(_virustotal_url_check, url)
    sb_future = IO_POOL.submit(_google_safe_browsing, url)
    redirect_future = IO_POOL.submit(_redirect_profile, url)
    ssl_future = IO_POOL.submit(_ssl_snapshot, url)

    vt, vt_error = vt_future.result()
    vt_stats = vt.get("stats", _empty_vt_stats())
    malicious_count = int(vt_stats.get("malicious", 0))
    suspicious_count = int(vt_stats.get("suspicious", 0))
    harmless_count = int(vt_stats.get("harmless", 0))
    undetected_count = int(vt_stats.get("undetected", 0))
    timeout_count = int(vt_stats.get("timeout", 0))
    total_engines = sum(vt_stats.values())

    sb, sb_error = sb_future.result()
    matches = sb.get("matches", [])
    scam_signals = url_scam_signals(url)
    redirect_chain, redirect_err = redirect_future.result()
    ssl_info, ssl_err = ssl_future.result()
    entropy = _domain_entropy(domain_from_url(url))
    findings: List[str] = []
    threats: List[str] = []

    if vt_error:
        findings.append(vt_error)
    elif total_engines == 0:
        findings.append("VirusTotal analysis returned no engine stats yet.")
    else:
        findings.append(
            "VirusTotal detections: "
            f"{malicious_count} malicious, {suspicious_count} suspicious, "
            f"{harmless_count} harmless, {undetected_count} undetected."
        )
    if sb_error:
        findings.append(sb_error)
    if domain_error:
        findings.append(domain_error)
    if redirect_err:
        findings.append(redirect_err)
    if ssl_err:
        findings.append(ssl_err)
    findings.append(f"Domain entropy score: {entropy:.2f}")
    if entropy >= 3.8:
        findings.append("High domain entropy suggests algorithmic or obfuscated hostname.")
        threats.append("phishing")

    for match in matches:
        t = match.get("threatType", "").lower()
        if "social" in t:
            threats.append("phishing")
        elif "malware" in t:
            threats.append("malware")
        else:
            threats.append("scam")
        findings.append(
            f"Google Safe Browsing match: {match.get('threatType', 'UNKNOWN')} "
            f"on {match.get('platformType', 'UNKNOWN')}"
        )

    findings.extend(scam_signals)
    if malicious_count > 0:
        threats.append("malware")
    if suspicious_count > 0:
        threats.append("phishing")
    if scam_signals:
        threats.append("scam")
    if len(redirect_chain) >= 4:
        threats.append("phishing")
    threats = sorted(set(threats))

    vt_has_stats = total_engines > 0
    security_api_available = (not vt_error and vt_has_stats) or (not sb_error)
    verdict = "unknown"
    if malicious_count > 0 or matches:
        verdict = "dangerous"
    elif suspicious_count > 0 or scam_signals:
        verdict = "suspicious"
    elif len(redirect_chain) >= 4 or entropy >= 3.8:
        verdict = "suspicious"
    elif security_api_available:
        verdict = "safe"
    if not domain_reachable and verdict == "safe":
        verdict = "unknown"

    domain = domain_from_url(url)
    domain_age = _domain_age_from_whois(domain)
    if verdict == "safe" and domain_age.startswith("Likely"):
        verdict = "suspicious"

    confidence = 0.0
    if verdict == "dangerous":
        confidence = min(0.99, 0.85 + (malicious_count * 0.02))
    elif verdict == "suspicious":
        confidence = 0.7 if suspicious_count or scam_signals else 0.55
    elif verdict == "safe":
        confidence = 0.75 if harmless_count > 0 else 0.45

    response = {
        "url": url,
        "verdict": verdict,
        "threats": threats,
        "confidence": round(confidence, 4),
        "malicious_count": malicious_count,
        "suspicious_count": suspicious_count,
        "safe_count": harmless_count,
        "harmless_count": harmless_count,
        "undetected_count": undetected_count,
        "timeout_count": timeout_count,
        "total_engines": total_engines,
        "invalid_domain": not domain_reachable,
        "connection_status": domain_error or "Domain is reachable.",
        "virusTotal": {
            "configured": bool(settings.virustotal_api_key),
            "analysis_id": vt.get("analysis_id"),
            "status": vt.get("status"),
            "stats": vt_stats,
            "error": vt_error,
        },
        "googleSafeBrowsing": {
            "configured": bool(settings.safe_browsing_api_key),
            "matches": matches,
            "error": sb_error,
        },
        "redirectChain": redirect_chain[:8],
        "sslInfo": ssl_info,
        "domainEntropy": round(entropy, 3),
        "findings": findings or ["No specific threat indicators found in configured checks."],
        "details": (
            "VirusTotal + Safe Browsing scan complete. "
            f"Found {malicious_count} malicious, {suspicious_count} suspicious, "
            f"{len(matches)} Safe Browsing matches, and {len(scam_signals)} URL red flags."
        ),
        "domainInfo": {
            "registeredDate": "Unknown",
            "age": domain_age,
            "reputation": "dangerous" if verdict == "dangerous" else verdict,
        },
        "recommendations": _link_recommendations(verdict),
        "englishSummary": "If the link looks suspicious, close it immediately and do not share any personal details.",
        "hindiSummary": "यदि लिंक संदिग्ध लगे, तो तुरंत बंद करें और कोई भी व्यक्तिगत जानकारी साझा न करें।",
    }
    if verdict != "unknown":
        _cache_set(key, response)
    logger.info("Link scan complete url=%s verdict=%s threats=%s", url, verdict, threats)
    return response


def _find_app_record(app_name: str) -> Optional[Dict[str, Any]]:
    needle = app_name.strip().lower()
    for app in GOV_APPS_DB.get("apps", []):
        if needle in app["name"].lower() or app["name"].lower() in needle:
            return app
    return None


def _dangerous_combo(perms: List[str]) -> bool:
    current = {p.upper() for p in perms}
    needed = {"CAMERA", "RECORD_AUDIO", "READ_CONTACTS"}
    return needed.issubset(current)


@router.post("/check-app")
def check_app(payload: AppCheckRequest) -> Dict[str, Any]:
    app = _find_app_record(payload.appName)
    if not app:
        return {
            "verdict": "suspicious",
            "appName": payload.appName,
            "officialPackage": "Unknown",
            "permissions": [],
            "risks": ["No official match found in trusted government app database."],
            "officialAlternatives": GOV_APPS_DB.get("apps", [])[:3],
            "recommendation": "Install only from official publisher and verify package name.",
            "englishSummary": "No official match was found. Verify carefully before installing.",
            "hindiSummary": "कोई आधिकारिक मिलान नहीं मिला। इंस्टॉल करने से पहले सावधानी से सत्यापित करें।",
        }

    input_package = (payload.packageName or "").strip()
    official_package = app["officialPackage"]
    mismatch = bool(input_package and input_package != official_package)
    permissions = []
    for perm in app.get("permissions", []):
        risk = "low"
        if perm in {"READ_SMS", "RECORD_AUDIO", "READ_CONTACTS"}:
            risk = "medium"
        permissions.append(
            {
                "permission": perm,
                "isRequired": perm in app.get("requiredPermissions", app.get("permissions", [])),
                "riskLevel": risk,
                "explanation": "Review whether this permission is necessary for app function.",
            }
        )

    all_perm_names = [p["permission"] for p in permissions]
    risks = []
    verdict: Literal["official", "fake", "suspicious"] = "official"
    if mismatch:
        verdict = "fake"
        risks.append("App name matches official app but package name is different.")
    if _dangerous_combo(all_perm_names):
        verdict = "suspicious" if verdict == "official" else verdict
        risks.append("Dangerous permission combo detected: Camera + Microphone + Contacts.")

    response = {
        "verdict": verdict,
        "appName": app["name"],
        "officialPackage": official_package,
        "permissions": permissions,
        "risks": risks or ["No major red flags detected."],
        "officialAlternatives": [
            {
                "name": app["name"],
                "packageName": app["officialPackage"],
                "playStoreLink": app["playStoreLink"],
            }
        ],
        "recommendation": (
            "Mismatch means high fraud risk. Uninstall and use official app only."
            if mismatch
            else "Looks official. Keep Play Protect on and avoid side-loading APKs."
        ),
        "englishSummary": "If the package name mismatches, the app may be fake. Uninstall immediately.",
        "hindiSummary": "यदि पैकेज नाम मेल नहीं खाता, तो ऐप नकली हो सकता है। तुरंत अनइंस्टॉल करें।",
    }
    return response


@router.post("/detect-deepfake")
async def detect_deepfake(
    mediaUrl: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
) -> Dict[str, Any]:
    if not mediaUrl and not file:
        return _normalize_deepfake_verdict_payload({
            "verdict": "unverified",
            "legacy_verdict": "unverified",
            "verdict_color": "yellow",
            "confidence_percent": 20,
            "verdict_reason": "Signals conflict or confidence is insufficient for a reliable determination.",
            "confidence": 20,
            "details": "Provide either mediaUrl or a media file.",
            "recommendations": ["Upload a media file or provide a direct URL."],
            "englishSummary": "You must provide either a media URL or a media file.",
            "hindiSummary": "आपको मीडिया URL या मीडिया फ़ाइल में से कोई एक देना आवश्यक है।",
        })
    source_name = str(mediaUrl or (file.filename if file else "unknown"))
    if file is None:
        link = str(mediaUrl).lower()
        findings = []
        verdict: Literal["fake", "suspicious", "real", "unverified"] = "unverified"
        confidence = 40
        if any(x in link for x in ["reupload", "forwarded", "unknown-source", "edited"]):
            verdict = "suspicious"
            confidence = 58
            findings.append("URL metadata suggests reposted or edited origin.")
        else:
            findings.append("URL-only scan cannot verify media authenticity.")
        return _normalize_deepfake_verdict_payload({
            "mediaUrl": source_name,
            "mediaType": "url",
            "analysisMode": "url-heuristic-only",
            "verdict": verdict,
            "legacy_verdict": verdict,
            "verdict_color": "yellow",
            "confidence_percent": confidence,
            "verdict_reason": "Signals conflict or confidence is insufficient for a reliable determination.",
            "confidence": confidence,
            "details": "Upload image for model-based analysis.",
            "findings": findings,
            "recommendations": [
                "Upload the original image file for better results.",
                "Avoid forwarding unverified media.",
            ],
            "englishSummary": "For best results, upload the original image file.",
            "hindiSummary": "सर्वोत्तम परिणाम के लिए मूल छवि फ़ाइल अपलोड करें।",
        })

    blob = await file.read()
    source_name = file.filename or "uploaded-file"
    suffix = Path(source_name).suffix or ".jpg"
    mime = (file.content_type or "").lower()
    if mime.startswith("video/") or suffix.lower() in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
        return _normalize_deepfake_verdict_payload({
            "mediaUrl": source_name,
            "mediaType": "video",
            "analysisMode": "unsupported-video",
            "verdict": "unverified",
            "legacy_verdict": "unverified",
            "verdict_color": "yellow",
            "confidence_percent": 30,
            "verdict_reason": "Signals conflict or confidence is insufficient for a reliable determination.",
            "confidence": 30,
            "confidenceScore": 0.3,
            "details": "Video deepfake analysis is not yet enabled in this endpoint. Upload a representative frame image.",
            "findings": ["Video input detected; this route currently performs still-image forensic analysis only."],
            "recommendations": [
                "Extract 1-3 clear keyframes from the video and upload as images.",
                "Use reverse search and source verification before sharing video content.",
            ],
            "englishSummary": "Upload a still frame image for reliable analysis.",
            "hindiSummary": "विश्वसनीय विश्लेषण के लिए वीडियो का स्पष्ट फ़्रेम छवि के रूप में अपलोड करें।",
        })
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(blob)
            temp_path = temp_file.name
        model_result = detect_deepfake_file(temp_path)
        verdict = str(model_result.get("verdict", "unverified"))
        confidence = int(model_result.get("confidencePercent", 50))
        logger.info(
            "Deepfake detection complete source=%s verdict=%s calibration_confidence=%s assessment=%s",
            source_name,
            verdict,
            confidence,
            model_result.get("assessment"),
        )
        return _normalize_deepfake_verdict_payload({
            **model_result,
            "mediaUrl": source_name,
            "mediaType": "image",
            "analysisMode": "hybrid-forensic-ml",
            "recommendations": [
                "Reverse-search keyframes before sharing.",
                "Verify using an official source before believing or forwarding.",
                "Report harmful content to the platform and to cyber authorities.",
            ],
            "englishSummary": (
                "Multi-signal forensic screen completed. "
                "This is an advisory signal—not court-grade proof; corroborate with independent checks."
            ),
            "hindiSummary": (
                "बहु-संकेत फॉरेंसिक स्क्रीन पूर्ण। यह सलाहकार परिणाम है—न्यायिक प्रमाण नहीं; स्वतंत्र जाँच से पुष्टि करें।"
            ),
        })
    except Exception as exc:
        logger.exception("Deepfake model failed for source=%s: %s", source_name, exc)
        verdict = "unverified"
        confidence = 40
        confidence_score = 0.4
        details = f"Deepfake analysis failed: {exc}"
        findings = ["Could not complete local analysis for this file."]
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    logger.info(
        "Deepfake detection complete source=%s verdict=%s confidence=%s",
        source_name,
        verdict,
        confidence,
    )
    return _normalize_deepfake_verdict_payload({
        "mediaUrl": source_name,
        "verdict": verdict,
        "legacy_verdict": verdict,
        "verdict_color": "yellow",
        "confidence_percent": confidence,
        "verdict_reason": "Signals conflict or confidence is insufficient for a reliable determination.",
        "confidence": confidence,
        "confidenceScore": round(confidence_score, 4),
        "details": details,
        "findings": findings,
        "recommendations": [
            "Reverse-search keyframes before sharing.",
            "Verify using an official source before believing or forwarding.",
            "Report harmful content to the platform and to cyber authorities.",
        ],
        "englishSummary": "Analysis could not be completed for this file. Try another image or format.",
        "hindiSummary": "इस फ़ाइल के लिए विश्लेषण पूरा नहीं हो सका। दूसरी छवि या प्रारूप आज़माएँ।",
    })


@router.post("/extension/check-site")
def extension_check_site(payload: LinkScanRequest) -> Dict[str, Any]:
    scanned = scan_link(payload)
    verdict_map = {"safe": "safe", "suspicious": "warning", "dangerous": "danger"}
    v = verdict_map[scanned["verdict"]]
    threat_level = 10
    if v == "warning":
        threat_level = 65
    elif v == "danger":
        threat_level = 95
    return {
        "verdict": v,
        "threatLevel": threat_level,
        "shouldBlock": v == "danger",
        "warningMessage": (
            "High risk site detected. Leave immediately."
            if v == "danger"
            else "Proceed with caution, verify domain."
        ),
        "actionButtons": ["Continue", "Leave Site"],
        "englishSummary": "If the verdict is dangerous, leave the site immediately.",
        "hindiSummary": "यदि निर्णय 'खतरनाक' हो, तो साइट तुरंत बंद करें।",
    }
