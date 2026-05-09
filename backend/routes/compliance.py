from pathlib import Path
from typing import Any, Dict, List, Optional
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from config import load_json_file
from routes.utils import safe_request_json

router = APIRouter(tags=["compliance"])

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
HELPLINES_DB = load_json_file(DATA_DIR / "helplines.json")
CYBERCELL_DB = load_json_file(DATA_DIR / "cybercell.json")


class HelplineRequest(BaseModel):
    incidentType: str = Field(min_length=2, max_length=64)
    userState: Optional[str] = None


STATE_ALIASES = {
    "andaman": "Andaman and Nicobar Islands",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "andaman & nicobar": "Andaman and Nicobar Islands",
    "ap": "Andhra Pradesh",
    "arunachal": "Arunachal Pradesh",
    "cg": "Chhattisgarh",
    "chattisgarh": "Chhattisgarh",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "dnhdd": "Dadra and Nagar Haveli and Daman and Diu",
    "j&k": "Jammu and Kashmir",
    "jammu & kashmir": "Jammu and Kashmir",
    "mp": "Madhya Pradesh",
    "mh": "Maharashtra",
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "tn": "Tamil Nadu",
    "ts": "Telangana",
    "uk": "Uttarakhand",
    "uttrakhand": "Uttarakhand",
    "up": "Uttar Pradesh",
    "wb": "West Bengal",
}


def _state_from_ip(ip: str) -> str:
    if not ip or ip in {"127.0.0.1", "::1"}:
        return "Delhi"
    data = safe_request_json("GET", f"https://ipapi.co/{ip}/json/", timeout=4)
    region = (data or {}).get("region")
    return str(region) if region else "Delhi"


def _incident_actions(incident: str) -> Dict[str, Any]:
    mapping = {
        "upi_fraud": "Bank ko turant call karein, 1930 dial karein, transaction ID save karein.",
        "fake_app": "App uninstall karein, permissions revoke karein, cyber portal par complaint karein.",
        "deepfake": "Evidence save karein, platform report karein, FIR initiate karein.",
        "sextortion": "Payment na karein, chat/screenshots preserve karein, 1930 aur cybercrime.gov.in use karein.",
        "job_scam": "Advance payment stop karein, recruiter details report karein.",
        "loan_fraud": "Unauthorized app remove karein, contacts permissions revoke karein.",
    }
    return {
        "timeline": mapping.get(
            incident,
            "Immediate fraud containment karein, 1930 call karein, online complaint file karein.",
        ),
        "evidenceChecklist": [
            "Screenshots of chats/messages",
            "Transaction IDs, UTR numbers, bank statements",
            "Phone numbers, handles, URLs, email headers",
            "App package name, app link, and install source",
            "Timeline of events with exact timestamps",
        ],
        "urgencyScore": (
            95
            if incident in {"upi_fraud", "sextortion", "loan_fraud"}
            else 80 if incident in {"deepfake", "job_scam"} else 65
        ),
    }


def _all_cybercell_states() -> List[Dict[str, Any]]:
    return CYBERCELL_DB.get("states", [])


def _normalize_state_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    needle = value.strip().lower()
    if not needle:
        return None
    if needle in STATE_ALIASES:
        return STATE_ALIASES[needle]
    for item in _all_cybercell_states():
        name = item.get("name", "")
        if name.lower() == needle:
            return name
    for item in _all_cybercell_states():
        name = item.get("name", "")
        if needle in name.lower() or name.lower() in needle:
            return name
    return value


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * radius * asin(sqrt(a))


def _maps_link(lat: Optional[float], lng: Optional[float], address: str) -> str:
    if lat is not None and lng is not None:
        return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
    return f"https://www.google.com/maps/search/?api=1&query={address.replace(' ', '+')}"


def _office_payload(office: Dict[str, Any], user_lat: Optional[float], user_lng: Optional[float]) -> Dict[str, Any]:
    lat = office.get("lat")
    lng = office.get("lng")
    distance = None
    if user_lat is not None and user_lng is not None and lat is not None and lng is not None:
        distance = round(_distance_km(user_lat, user_lng, float(lat), float(lng)), 1)
    return {
        **office,
        "distanceKm": distance,
        "googleMapsLink": _maps_link(lat, lng, office.get("address", "")),
    }


def _nearest_office(state_record: Dict[str, Any], lat: Optional[float], lng: Optional[float]) -> Dict[str, Any]:
    offices = [state_record.get("hq", {})] + state_record.get("offices", [])
    if lat is None or lng is None:
        return _office_payload(offices[0], lat, lng)
    return min(
        (_office_payload(office, lat, lng) for office in offices if office),
        key=lambda item: item["distanceKm"] if item["distanceKm"] is not None else float("inf"),
    )


@router.post("/get-cybercell")
def get_cybercell(
    state: Optional[str] = Query(default=None),
    lat: Optional[float] = Query(default=None),
    lng: Optional[float] = Query(default=None),
) -> Dict[str, Any]:
    states = _all_cybercell_states()
    state_name = _normalize_state_name(state)
    selected = None
    if state_name:
        selected = next((item for item in states if item.get("name", "").lower() == state_name.lower()), None)

    if selected is None and lat is not None and lng is not None:
        selected = min(
            states,
            key=lambda item: _distance_km(
                lat,
                lng,
                float(item.get("hq", {}).get("lat", 0)),
                float(item.get("hq", {}).get("lng", 0)),
            ),
        )
    if selected is None:
        selected = next((item for item in states if item.get("name") == "Delhi"), states[0] if states else {})

    nearest = _nearest_office(selected, lat, lng) if selected else {}
    offices = [_office_payload(office, lat, lng) for office in selected.get("offices", [])]
    return {
        "state": selected.get("name"),
        "type": selected.get("type"),
        "region": selected.get("region"),
        "hq": _office_payload(selected.get("hq", {}), lat, lng),
        "nearestOffice": nearest,
        "offices": offices,
        "states": [item.get("name") for item in states],
        "metadata": CYBERCELL_DB.get("metadata", {}),
    }


@router.post("/get-helplines")
def get_helplines(payload: HelplineRequest, request: Request) -> Dict[str, Any]:
    client_ip = request.client.host if request.client else ""
    detected_state = payload.userState or _state_from_ip(client_ip)

    primary = {
        "number": "1930",
        "name": "National Cyber Helpline",
        "description": "Call immediately for financial fraud / Financial fraud mein turant call karein.",
        "timeLimit": "60 minutes",
        "callDirectLink": "tel:1930",
    }
    portals = [
        {
            "name": "cybercrime.gov.in",
            "url": "https://cybercrime.gov.in",
            "purpose": "File FIR and online complaints",
            "stepByStep": [
                "Go to site / Website kholein",
                "Click 'File Complaint'",
                "Choose incident type",
                "Upload evidence and submit",
            ],
        },
        {
            "name": "RBI Complaint Portal",
            "url": "https://cms.rbi.org.in",
            "purpose": "UPI and banking fraud",
            "stepByStep": ["Open portal", "Register complaint", "Add bank transaction details", "Submit"],
        },
        {
            "name": "CERT-In",
            "url": "https://www.cert-in.org.in",
            "purpose": "Technical cyber incidents",
            "stepByStep": ["Visit CERT-In", "Navigate incident reporting", "Provide technical details", "Submit"],
        },
        {
            "name": "TRAI",
            "url": "https://www.trai.gov.in",
            "purpose": "SIM swap, spam calls",
            "stepByStep": ["Visit TRAI", "Open consumer complaint", "Submit spam/SIM issue", "Track complaint"],
        },
    ]

    cells = HELPLINES_DB.get("cyberCells", [])
    nearest = next((c for c in cells if c["state"].lower() == detected_state.lower()), None)
    if not nearest:
        nearest = cells[0] if cells else {}
    incident_plan = _incident_actions(payload.incidentType)
    return {
        "primaryAction": primary,
        "portals": portals,
        "nearestCyberCell": nearest,
        "timelineAdvice": incident_plan["timeline"],
        "evidenceChecklist": incident_plan["evidenceChecklist"],
        "urgencyScore": incident_plan["urgencyScore"],
        "priorityBand": (
            "critical"
            if incident_plan["urgencyScore"] >= 90
            else "high" if incident_plan["urgencyScore"] >= 75 else "moderate"
        ),
        "hindiSummary": "Sabse pehle 1930 call karein, phir cybercrime portal par complaint file karein.",
    }
