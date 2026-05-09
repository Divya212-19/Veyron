import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    hibp_api_key: str = Field(default="", alias="HIBP_API_KEY")
    safe_browsing_api_key: str = Field(default="", alias="SAFE_BROWSING_API_KEY")
    virustotal_api_key: str = Field(default="", alias="VIRUSTOTAL_API_KEY")
    firebase_credentials_path: str = Field(default="", alias="FIREBASE_CREDENTIALS_PATH")
    firebase_project_id: str = Field(default="", alias="FIREBASE_PROJECT_ID")
    allowed_origins: str = Field(
        default="http://localhost,http://localhost:3000,http://localhost:5173",
        alias="ALLOWED_ORIGINS",
    )
    backend_api_key: str = Field(default="", alias="BACKEND_API_KEY")

    model_config = SettingsConfigDict(populate_by_name=True, extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


class FirebaseStore:
    def __init__(self, settings: Settings):
        self._enabled = False
        self._firestore = None
        self._settings = settings
        self._init_client()

    def _init_client(self) -> None:
        if not self._settings.firebase_credentials_path:
            return
        credentials_path = Path(self._settings.firebase_credentials_path)
        if not credentials_path.exists():
            logging.warning("Firebase credentials file not found, using in-memory store.")
            return
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            if not firebase_admin._apps:
                cred = credentials.Certificate(str(credentials_path))
                firebase_admin.initialize_app(
                    cred,
                    {"projectId": self._settings.firebase_project_id or None},
                )
            self._firestore = firestore.client()
            self._enabled = True
        except Exception as exc:
            logging.warning("Firebase init failed, using in-memory store: %s", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled

    def save_document(self, collection: str, doc_id: str, payload: Dict[str, Any]) -> None:
        if not self._enabled or self._firestore is None:
            return
        self._firestore.collection(collection).document(doc_id).set(payload)

    def get_document(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        if not self._enabled or self._firestore is None:
            return None
        snap = self._firestore.collection(collection).document(doc_id).get()
        if snap.exists:
            return snap.to_dict()
        return None


def load_json_file(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


settings = Settings()
firebase_store = FirebaseStore(settings)
