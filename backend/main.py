import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Deque, Dict

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routes.chatbot import router as chatbot_router
from routes.compliance import router as compliance_router
from routes.detectors import router as detectors_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("veyron-backend")

@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting Veyron backend...")
    logger.info("Configured CORS origins: %s", settings.origins)
    logger.info("Registering API routers")
    yield


app = FastAPI(title="Veyron Cyber Safety Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RATE_LIMIT = 100
WINDOW_SECONDS = 60
EXPENSIVE_ENDPOINT_LIMITS = {
    "/api/detect-deepfake": 20,
    "/api/scan-link": 40,
    "/api/chat": 60,
}
ip_hits: Dict[str, Deque[float]] = defaultdict(deque)


@app.middleware("http")
async def log_and_rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    path = request.url.path
    if settings.backend_api_key and path in EXPENSIVE_ENDPOINT_LIMITS:
        supplied = request.headers.get("x-api-key", "").strip()
        if supplied != settings.backend_api_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid API key for this endpoint."},
            )

    now = time.time()
    bucket = f"{ip}:{path if path in EXPENSIVE_ENDPOINT_LIMITS else '*'}"
    dq = ip_hits[bucket]
    while dq and (now - dq[0]) > WINDOW_SECONDS:
        dq.popleft()
    limit = EXPENSIVE_ENDPOINT_LIMITS.get(path, RATE_LIMIT)
    if len(dq) >= limit:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please retry shortly.", "path": path},
        )
    dq.append(now)

    started = time.time()
    response = await call_next(request)
    elapsed = (time.time() - started) * 1000
    logger.info("%s %s %s %.2fms", request.method, request.url.path, response.status_code, elapsed)
    return response


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def generic_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health():
    return {"status": "ok", "service": "veyron-backend"}


try:
    app.include_router(chatbot_router, prefix="/api")
    app.include_router(detectors_router, prefix="/api")
    app.include_router(compliance_router, prefix="/api")
except Exception:
    logger.exception("Route registration failed")
    raise


if __name__ == "__main__":
    logger.info("Launching Uvicorn server from main.py")
    try:
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
    except Exception:
        logger.exception("Server failed to start")
        raise
