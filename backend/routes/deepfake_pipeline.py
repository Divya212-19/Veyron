"""
Hybrid deepfake/AI-image pipeline:
- forensic CV signals (existing)
- pretrained CLIP classifier (new)
- calibrated fusion + disagreement handling
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger("veyron-backend.deepfake_pipeline")

# OpenCV 4.13+ AVX2 linear filters reject some CV_32F/CV_64F mixes — use CV_32F for derivatives on uint8.
_DDEPTH_DERIV = cv2.CV_32F

Assessment = Literal[
    "likely_real",
    "possibly_ai_generated",
    "ai_generated",
    "manipulated",
    "inconclusive",
]


@dataclass
class SignalResult:
    key: str
    score: float  # 0 = authentic-leaning, 1 = synthetic/manipulation-leaning, 0.5 = neutral
    detail: str
    category: Literal["ai", "integrity", "general"]


@dataclass
class ModelResult:
    available: bool
    model_name: str
    ai_probability: float
    confidence: float
    detail: str


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _load_image_bgr(path: str) -> Optional[np.ndarray]:
    """Decode image to contiguous 3-channel BGR uint8 (strip alpha, handle palette)."""
    try:
        data = Path(path).read_bytes()
        if not data:
            return None
        arr = np.frombuffer(data, dtype=np.uint8)
        # UNCHANGED preserves alpha; we normalize below
        img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
        if img is None:
            return None
        return _ensure_bgr_u8(img)
    except Exception as exc:
        logger.warning("Image decode failed: %s", exc)
        return None


def _ensure_bgr_u8(img: np.ndarray) -> Optional[np.ndarray]:
    """Convert any decoded array to contiguous BGR uint8."""
    if img is None or img.size == 0:
        return None
    if img.dtype == np.uint16:
        img = cv2.convertScaleAbs(img, alpha=1.0 / 257.0)
    elif np.issubdtype(img.dtype, np.floating):
        mx = float(np.max(img)) if img.size else 0.0
        if mx <= 1.0:
            img = np.clip(img * 255.0, 0.0, 255.0).astype(np.uint8)
        else:
            img = np.clip(img, 0.0, 255.0).astype(np.uint8)
    if img.ndim == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.ndim == 3 and img.shape[2] == 4:
        # BGRA / RGBA — drop alpha
        bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    elif img.ndim == 3 and img.shape[2] == 3:
        bgr = img
    elif img.ndim == 3 and img.shape[2] == 1:
        bgr = cv2.cvtColor(img[:, :, 0], cv2.COLOR_GRAY2BGR)
    else:
        logger.warning("Unsupported channel layout shape=%s", getattr(img, "shape", None))
        return None

    if bgr.dtype != np.uint8:
        if np.issubdtype(bgr.dtype, np.floating):
            bgr = np.clip(bgr, 0.0, 255.0).astype(np.uint8)
        else:
            bgr = np.clip(bgr, 0, 255).astype(np.uint8)

    if not bgr.flags["C_CONTIGUOUS"]:
        bgr = np.ascontiguousarray(bgr)
    return bgr


def _to_gray_u8(bgr: np.ndarray) -> np.ndarray:
    """Grayscale uint8 contiguous — safe for GaussianBlur / Laplacian."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    if gray.dtype != np.uint8:
        gray = np.clip(gray, 0, 255).astype(np.uint8)
    if not gray.flags["C_CONTIGUOUS"]:
        gray = np.ascontiguousarray(gray)
    return gray


def _laplacian_variance_u8(gray_u8: np.ndarray) -> float:
    """Laplacian on uint8 with float32 output — avoids CV_32F/CV_64F mix in optimized filters."""
    lap = cv2.Laplacian(gray_u8, _DDEPTH_DERIV, ksize=3)
    return float(np.var(lap.astype(np.float64)))


def _resize_long_edge(img: np.ndarray, max_side: int = 896) -> Tuple[np.ndarray, float]:
    h, w = img.shape[:2]
    long_side = max(h, w)
    if long_side <= max_side:
        return img, 1.0
    scale = max_side / float(long_side)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    out = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
    if not out.flags["C_CONTIGUOUS"]:
        out = np.ascontiguousarray(out)
    return out, scale


def _face_roi_gray(bgr: np.ndarray, cascade: cv2.CascadeClassifier) -> Tuple[Optional[np.ndarray], bool, Tuple[int, int, int, int]]:
    gray = _to_gray_u8(bgr)
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(48, 48),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    if len(faces) == 0:
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=2,
            minSize=(32, 32),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )
    if len(faces) == 0:
        return None, False, (0, 0, gray.shape[1], gray.shape[0])
    x, y, w, h = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
    pad = int(0.12 * max(w, h))
    H, W = gray.shape
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(W, x + w + pad)
    y1 = min(H, y + h + pad)
    roi = gray[y0:y1, x0:x1]
    if not roi.flags["C_CONTIGUOUS"]:
        roi = np.ascontiguousarray(roi)
    return roi, True, (x0, y0, x1 - x0, y1 - y0)


def analyze_metadata(path: str) -> SignalResult:
    """EXIF / container hints — missing data alone is never proof."""
    software_hints = re.compile(
        r"microsoft designer|dall|midjourney|stable.?diffusion|sdxl|flux|openai|gpt|"
        r"imagen|firefly|recraft|leonardo|playground|nightcafe|bing.?image|"
        r"adobe.?firefly|generative.?fill|ai.?generated",
        re.I,
    )
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS

        with Image.open(path) as im:
            exif = im.getexif()
            tags: Dict[str, str] = {}
            if exif:
                for k, v in exif.items():
                    name = TAGS.get(k, str(k))
                    tags[name] = str(v)
            blob = " ".join(tags.values()).lower()
            if software_hints.search(blob):
                return SignalResult(
                    "metadata",
                    0.92,
                    "EXIF/software field mentions generative or AI tooling.",
                    "integrity",
                )
            make_model = (tags.get("Make", "") + " " + tags.get("Model", "")).strip()
            if len(tags) >= 6 and make_model:
                return SignalResult(
                    "metadata",
                    0.38,
                    "Typical camera metadata present — modest authenticity cue.",
                    "integrity",
                )
            if im.format == "JPEG" and len(tags) <= 1:
                return SignalResult(
                    "metadata",
                    0.62,
                    "JPEG with sparse or absent EXIF (common for exports / social reposts).",
                    "integrity",
                )
            return SignalResult(
                "metadata",
                0.52,
                "Limited EXIF; cannot corroborate capture device.",
                "integrity",
            )
    except Exception as exc:
        logger.debug("Metadata read skipped: %s", exc)
        return SignalResult("metadata", 0.55, "Metadata could not be parsed.", "integrity")


def analyze_compression_el_signal(bgr: np.ndarray) -> SignalResult:
    """JPEG re-save residual — highlights pasted/compressed regions (weak but cheap)."""
    try:
        if bgr.dtype != np.uint8:
            bgr = _ensure_bgr_u8(bgr)
            if bgr is None:
                return SignalResult("compression_ela", 0.5, "ELA skipped (invalid image).", "integrity")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        if not rgb.flags["C_CONTIGUOUS"]:
            rgb = np.ascontiguousarray(rgb)
        ok, buf = cv2.imencode(".jpg", rgb, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        if not ok:
            return SignalResult("compression_ela", 0.5, "ELA skipped (encode failed).", "integrity")
        dec = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if dec is None:
            return SignalResult("compression_ela", 0.5, "ELA skipped (decode failed).", "integrity")
        dec = cv2.resize(dec, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_AREA)
        if dec.dtype != np.uint8:
            dec = np.clip(dec, 0, 255).astype(np.uint8)
        ela = cv2.absdiff(rgb, dec)
        mean_e = float(np.mean(ela))
        score = _clamp((mean_e - 4.0) / 14.0)
        detail = f"Compression residual mean={mean_e:.2f} (relative texture inconsistency)."
        return SignalResult("compression_ela", score, detail, "integrity")
    except Exception as exc:
        logger.warning("ELA failed: %s", exc)
        return SignalResult("compression_ela", 0.5, "Unavailable: compression analysis error.", "integrity")


def analyze_smoothness(bgr: np.ndarray, face_gray: Optional[np.ndarray], has_face: bool) -> SignalResult:
    """Synthetic portraits often show ultra-low micro-contrast in skin regions."""
    try:
        gray_u8 = _to_gray_u8(bgr)
        lv_global = _laplacian_variance_u8(gray_u8)

        if has_face and face_gray is not None and face_gray.size > 400:
            fg = face_gray
            if fg.dtype != np.uint8:
                fg = np.clip(fg, 0, 255).astype(np.uint8)
            if not fg.flags["C_CONTIGUOUS"]:
                fg = np.ascontiguousarray(fg)
            lv_face = _laplacian_variance_u8(fg)
            ratio = lv_face / (lv_global + 1e-6)
            score = _clamp(0.55 + (0.42 - min(ratio, 1.2)) * 0.55)
            detail = f"Face Laplacian variance ratio vs global={ratio:.3f} (lower → smoother skin)."
            return SignalResult("smoothness", score, detail, "ai")
        score = _clamp(1.0 - min(lv_global / 520.0, 1.0))
        detail = f"Global sharpness variance={lv_global:.1f}."
        return SignalResult("smoothness", score, detail, "ai")
    except Exception as exc:
        logger.warning("smoothness signal failed: %s", exc)
        return SignalResult("smoothness", 0.5, "Unavailable: smoothness analysis error.", "ai")


def analyze_frequency_rings(gray_u8: np.ndarray) -> SignalResult:
    """Radial FFT energy irregularities — weak cue for upsampling / some generators."""
    try:
        g = gray_u8.astype(np.float32)
        g -= float(np.mean(g))
        f = np.fft.fftshift(np.fft.fft2(g))
        mag = np.log(np.abs(f) + 1e-6)
        h, w = mag.shape
        cy, cx = h // 2, w // 2
        yy, xx = np.ogrid[:h, :w]
        rr = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2).astype(np.float32)
        max_r = min(cy, cx) - 2
        if max_r < 8:
            return SignalResult("frequency", 0.5, "Image too small for spectral bins.", "ai")
        bins = 16
        edges = np.linspace(8, max_r, bins + 1)
        vals = []
        for i in range(bins):
            mask = (rr >= edges[i]) & (rr < edges[i + 1])
            if np.any(mask):
                vals.append(float(np.mean(mag[mask])))
        if len(vals) < 4:
            return SignalResult("frequency", 0.5, "Insufficient spectral data.", "ai")
        v = np.array(vals, dtype=np.float64)
        v /= np.mean(v) + 1e-9
        irregularity = float(np.std(v))
        score = _clamp((irregularity - 0.06) / 0.18)
        detail = f"Radial spectrum variability σ={irregularity:.3f}."
        return SignalResult("frequency", score, detail, "ai")
    except Exception as exc:
        logger.warning("frequency signal failed: %s", exc)
        return SignalResult("frequency", 0.5, "Unavailable: frequency analysis error.", "ai")


def analyze_texture_gradient(bgr: np.ndarray, face_box: Tuple[int, int, int, int]) -> SignalResult:
    try:
        if bgr.dtype != np.uint8:
            bgr = _ensure_bgr_u8(bgr)
            if bgr is None:
                return SignalResult("texture_gradient", 0.5, "Unavailable: invalid BGR.", "general")
        if not bgr.flags["C_CONTIGUOUS"]:
            bgr = np.ascontiguousarray(bgr)
        gx = cv2.Sobel(bgr, _DDEPTH_DERIV, 1, 0, ksize=3)
        gy = cv2.Sobel(bgr, _DDEPTH_DERIV, 0, 1, ksize=3)
        gx_f = gx.astype(np.float32)
        gy_f = gy.astype(np.float32)
        mag = np.sqrt(gx_f * gx_f + gy_f * gy_f)
        mag_mean = float(np.mean(mag))
        x, y, bw, bh = face_box
        H, W = mag.shape[:2]
        x0 = max(0, min(W - 1, x))
        y0 = max(0, min(H - 1, y))
        x1 = max(x0 + 1, min(W, x + bw))
        y1 = max(y0 + 1, min(H, y + bh))
        face_mag = mag[y0:y1, x0:x1]
        if face_mag.size < 50:
            return SignalResult("texture_gradient", 0.5, "No usable region for texture contrast.", "general")
        fm = float(np.mean(face_mag))
        ratio = fm / (mag_mean + 1e-9)
        score = _clamp(0.45 + (0.85 - min(ratio, 1.4)) * 0.6)
        detail = f"Mean gradient magnitude ratio face/global={ratio:.3f}."
        return SignalResult("texture_gradient", score, detail, "ai")
    except Exception as exc:
        logger.warning("texture_gradient signal failed: %s", exc)
        return SignalResult("texture_gradient", 0.5, "Unavailable: gradient analysis error.", "ai")


def analyze_face_symmetry(face_gray: Optional[np.ndarray], has_face: bool) -> SignalResult:
    try:
        if not has_face or face_gray is None or face_gray.shape[0] < 20 or face_gray.shape[1] < 20:
            return SignalResult("symmetry_face", 0.5, "No frontal face region — symmetry check skipped.", "general")
        fg = face_gray
        if fg.dtype != np.uint8:
            fg = np.clip(fg, 0, 255).astype(np.uint8)
        if not fg.flags["C_CONTIGUOUS"]:
            fg = np.ascontiguousarray(fg)
        h, w = fg.shape
        mid = w // 2
        left = fg[:, :mid]
        right = cv2.flip(fg[:, mid:], 1)
        mw = min(left.shape[1], right.shape[1])
        left = cv2.resize(left[:, :mw], (mw, h), interpolation=cv2.INTER_AREA)
        right = cv2.resize(right[:, :mw], (mw, h), interpolation=cv2.INTER_AREA)
        left_f = left.astype(np.float32)
        right_f = right.astype(np.float32)
        diff = float(np.mean(np.abs(left_f - right_f)) / 255.0)
        sim = 1.0 - diff
        score = _clamp((sim - 0.78) / 0.18)
        detail = f"Facial mirror similarity≈{sim:.2f}."
        return SignalResult("symmetry_face", score, detail, "ai")
    except Exception as exc:
        logger.warning("symmetry_face signal failed: %s", exc)
        return SignalResult("symmetry_face", 0.5, "Unavailable: symmetry analysis error.", "ai")


def analyze_noise_residual(gray_u8: np.ndarray) -> SignalResult:
    """High-frequency residual heterogeneity — some generators leave overly uniform noise."""
    try:
        g = gray_u8
        if g.dtype != np.uint8:
            g = np.clip(g, 0, 255).astype(np.uint8)
        if not g.flags["C_CONTIGUOUS"]:
            g = np.ascontiguousarray(g)
        blur = cv2.GaussianBlur(g, (0, 0), sigmaX=1.2)
        residual = g.astype(np.float32) - blur.astype(np.float32)
        grid = 6
        h, w = residual.shape
        cy = h // grid
        cx = w // grid
        if cx < 8 or cy < 8:
            return SignalResult("noise_residual", 0.5, "Image too small for noise tiling.", "general")
        vars_ = []
        for iy in range(grid):
            for ix in range(grid):
                patch = residual[iy * cy : (iy + 1) * cy, ix * cx : (ix + 1) * cx]
                vars_.append(float(np.var(patch)))
        cv_noise = float(np.std(vars_) / (np.mean(vars_) + 1e-6))
        score = _clamp(0.55 - min(cv_noise / 1.8, 0.35))
        detail = f"Noise patch coefficient of variation={cv_noise:.3f}."
        return SignalResult("noise_residual", score, detail, "integrity")
    except Exception as exc:
        logger.warning("noise_residual signal failed: %s", exc)
        return SignalResult("noise_residual", 0.5, "Unavailable: noise residual analysis error.", "integrity")


def analyze_color_saturation(
    bgr: np.ndarray, face_box: Tuple[int, int, int, int], has_face: bool
) -> SignalResult:
    try:
        if bgr.dtype != np.uint8:
            bgr = _ensure_bgr_u8(bgr)
            if bgr is None:
                return SignalResult("color_saturation", 0.5, "Unavailable: invalid BGR.", "ai")
        if not bgr.flags["C_CONTIGUOUS"]:
            bgr = np.ascontiguousarray(bgr)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1].astype(np.float32) / 255.0
        H, W = sat.shape
        if has_face:
            x, y, bw, bh = face_box
            x0 = max(0, min(W - 1, x))
            y0 = max(0, min(H - 1, y))
            x1 = max(x0 + 1, min(W, x + bw))
            y1 = max(y0 + 1, min(H, y + bh))
            fs = sat[y0:y1, x0:x1]
            if fs.size > 120:
                peak = float(np.percentile(fs, 92))
                score = _clamp((peak - 0.55) / 0.35)
                detail = f"Saturation tail inside face bbox (p92)={peak:.2f}."
                return SignalResult("color_saturation", score, detail, "ai")
        peak = float(np.percentile(sat, 95))
        score = _clamp((peak - 0.62) / 0.28)
        detail = f"Global saturation p95={peak:.2f}."
        return SignalResult("color_saturation", score, detail, "ai")
    except Exception as exc:
        logger.warning("color_saturation signal failed: %s", exc)
        return SignalResult("color_saturation", 0.5, "Unavailable: color analysis error.", "ai")


def _spread_penalty(scores: List[float]) -> float:
    if len(scores) < 2:
        return 0.0
    return float(max(scores) - min(scores))


def _signal_unavailable(s: SignalResult) -> bool:
    d = (s.detail or "").lower()
    return d.startswith("unavailable:") or "unavailable" in d


def _forensic_core(signals: List[SignalResult]) -> Dict[str, Any]:
    ai_scores = [s.score for s in signals if s.category == "ai"]
    int_scores = [s.score for s in signals if s.category == "integrity"]
    gen_scores = [s.score for s in signals if s.category == "general"]

    def wavg(vals: List[float]) -> float:
        return float(sum(vals) / len(vals)) if vals else 0.5

    ai_prob = wavg(ai_scores) if ai_scores else 0.5
    manip_prob = wavg(int_scores) if int_scores else 0.5
    gen_mid = wavg(gen_scores) if gen_scores else 0.5

    combined = _clamp(
        0.58 * ai_prob + 0.30 * manip_prob + 0.12 * gen_mid,
    )

    all_s = [s.score for s in signals]
    spread = _spread_penalty(all_s)

    failed_ct = sum(1 for s in signals if _signal_unavailable(s))
    uncertainty = _clamp(0.22 + spread * 0.55 + 0.05 * float(failed_ct))

    manipulation_risk = _clamp(0.45 * manip_prob + 0.25 * gen_mid + 0.15 * ai_prob)

    assessment: Assessment = "inconclusive"
    legacy_verdict: Literal["fake", "real", "suspicious", "unverified"] = "unverified"

    strong_ai = combined >= 0.68 and uncertainty <= 0.62
    moderate_ai = combined >= 0.56
    likely_real = combined <= 0.38 and manipulation_risk <= 0.52 and uncertainty <= 0.58
    manip_only = manipulation_risk >= 0.68 and combined < 0.58

    if manip_only:
        assessment = "manipulated"
        legacy_verdict = "suspicious"
    elif strong_ai:
        assessment = "ai_generated"
        legacy_verdict = "fake"
    elif moderate_ai:
        if uncertainty >= 0.62:
            assessment = "inconclusive"
            legacy_verdict = "suspicious"
        else:
            assessment = "possibly_ai_generated"
            legacy_verdict = "suspicious"
    elif likely_real:
        assessment = "likely_real"
        legacy_verdict = "real"
    else:
        assessment = "inconclusive"
        legacy_verdict = "suspicious"

    if spread >= 0.42:
        confidence_level = "low"
    elif spread >= 0.26:
        confidence_level = "medium"
    else:
        confidence_level = "high"

    if failed_ct >= 3:
        confidence_level = "low"

    ai_pct = int(round(combined * 100))
    manip_pct = int(round(manipulation_risk * 100))
    calib_conf = int(round((1.0 - min(uncertainty, 0.95)) * 100))

    indicators_sorted = sorted(
        [{"signal": s.key, "score": round(s.score, 3), "detail": s.detail} for s in signals],
        key=lambda x: x["score"],
        reverse=True,
    )
    suspicious_indicators = [
        f"{s.key}: {s.detail}"
        for s in sorted(signals, key=lambda z: z.score, reverse=True)[:5]
        if s.score >= 0.58 and not _signal_unavailable(s)
    ]
    if not suspicious_indicators:
        suspicious_indicators = ["No single cue exceeded medium suspicion — rely on aggregate scores."]

    meta_sig = next((s for s in signals if s.key == "metadata"), None)
    metadata_status = "unknown"
    if meta_sig:
        if meta_sig.score >= 0.75:
            metadata_status = "suspicious_or_ai_hint"
        elif meta_sig.score <= 0.42:
            metadata_status = "consistent_typical_camera"
        else:
            metadata_status = "incomplete_or_neutral"

    return {
        "assessment_forensic": assessment,
        "legacy_verdict_forensic": legacy_verdict,
        "confidence_percent_forensic": calib_conf,
        "ai_probability_forensic_pct": ai_pct,
        "manipulation_risk_pct": manip_pct,
        "confidence_level_forensic": confidence_level,
        "forensic_synthetic_index": combined,
        "forensic_uncertainty": uncertainty,
        "signal_spread": spread,
        "failed_signal_count": failed_ct,
        "detectionSignals": indicators_sorted,
        "metadataStatus": metadata_status,
        "suspiciousIndicators": suspicious_indicators,
        "analysis": {
            "combined_synthetic_index": round(combined, 4),
            "uncertainty": round(uncertainty, 4),
            "signal_spread": round(spread, 4),
            "signals_count": len(signals),
        },
    }


class ClipAIImageClassifier:
    """
    Lightweight local CLIP-based AI-image scorer.
    Returns probability-like score for "AI/synthetic image".
    """

    _REAL_PROMPTS = [
        "a natural camera photograph",
        "a real candid photo taken with a camera",
        "an authentic smartphone photograph of a person",
        "a documentary style real-world photo",
    ]
    _AI_PROMPTS = [
        "an ai generated image",
        "a synthetic deepfake portrait",
        "a digitally generated diffusion model image",
        "a midjourney or stable diffusion style render",
    ]

    def __init__(self) -> None:
        self._model_name = "openai/clip-vit-base-patch32"
        self._ready = False
        self._load_error: Optional[str] = None
        self._processor = None
        self._model = None
        self._torch = None
        self._lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._model_name

    def ensure_loaded(self) -> None:
        if self._ready or self._load_error:
            return
        with self._lock:
            if self._ready or self._load_error:
                return
            try:
                import torch
                from transformers import CLIPModel, CLIPProcessor
            except Exception as exc:
                self._load_error = f"CLIP dependencies unavailable: {exc}"
                logger.warning(self._load_error)
                return

            try:
                self._torch = torch
                self._processor = CLIPProcessor.from_pretrained(self._model_name)
                self._model = CLIPModel.from_pretrained(self._model_name)
                self._model.eval()
                self._ready = True
                logger.info("Loaded CLIP model for deepfake analysis: %s", self._model_name)
            except Exception as exc:
                self._load_error = f"CLIP model load failed: {exc}"
                logger.warning(self._load_error)

    def score_image(self, bgr_u8: np.ndarray) -> ModelResult:
        self.ensure_loaded()
        if not self._ready or self._model is None or self._processor is None or self._torch is None:
            return ModelResult(
                available=False,
                model_name=self._model_name,
                ai_probability=0.5,
                confidence=0.0,
                detail=self._load_error or "CLIP model unavailable.",
            )

        try:
            from PIL import Image

            rgb = cv2.cvtColor(bgr_u8, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            prompts = self._REAL_PROMPTS + self._AI_PROMPTS
            inputs = self._processor(text=prompts, images=pil_img, return_tensors="pt", padding=True)

            with self._torch.no_grad():
                out = self._model(**inputs)
                logits = out.logits_per_image[0]
                probs = self._torch.softmax(logits, dim=0).cpu().numpy().astype(np.float64)

            real_mean = float(np.mean(probs[: len(self._REAL_PROMPTS)]))
            ai_mean = float(np.mean(probs[len(self._REAL_PROMPTS) :]))
            denom = real_mean + ai_mean + 1e-9
            ai_prob = _clamp(ai_mean / denom)
            conf = _clamp(abs(ai_prob - 0.5) * 2.0)

            return ModelResult(
                available=True,
                model_name=self._model_name,
                ai_probability=ai_prob,
                confidence=conf,
                detail=f"CLIP synthetic probability={ai_prob:.3f}, confidence={conf:.3f}",
            )
        except Exception as exc:
            logger.warning("CLIP inference failed: %s", exc)
            return ModelResult(
                available=False,
                model_name=self._model_name,
                ai_probability=0.5,
                confidence=0.0,
                detail=f"CLIP inference failed: {exc}",
            )


_CLASSIFIER: Optional[ClipAIImageClassifier] = None
_CLASSIFIER_LOCK = threading.Lock()


def _get_classifier() -> ClipAIImageClassifier:
    global _CLASSIFIER
    if _CLASSIFIER is None:
        with _CLASSIFIER_LOCK:
            if _CLASSIFIER is None:
                _CLASSIFIER = ClipAIImageClassifier()
    return _CLASSIFIER


def _prime_classifier_background() -> None:
    def _load() -> None:
        try:
            _get_classifier().ensure_loaded()
        except Exception as exc:
            logger.warning("Background classifier preload failed: %s", exc)

    t = threading.Thread(target=_load, daemon=True)
    t.start()


def fuse_signals(signals: List[SignalResult], model_result: ModelResult) -> Dict[str, Any]:
    forensic = _forensic_core(signals)

    forensic_score = float(forensic["forensic_synthetic_index"])
    forensic_unc = float(forensic["forensic_uncertainty"])
    failed_ct = int(forensic["failed_signal_count"])

    ml_available = bool(model_result.available)
    ml_score = float(model_result.ai_probability if ml_available else 0.5)
    ml_conf = float(model_result.confidence if ml_available else 0.0)
    disagreement = abs(ml_score - forensic_score)

    # Dynamic weighting: ML dominates when confident/available, otherwise forensic dominates.
    if ml_available:
        ml_weight = _clamp(0.35 + 0.45 * ml_conf, 0.35, 0.80)
    else:
        ml_weight = 0.0
    forensic_weight = 1.0 - ml_weight

    fusion_score = _clamp((forensic_weight * forensic_score) + (ml_weight * ml_score))

    uncertainty = _clamp(
        0.18
        + 0.45 * forensic_unc
        + 0.32 * disagreement
        + (0.12 if not ml_available else 0.0)
        + 0.04 * float(failed_ct),
    )
    confidence_calibration = _clamp(1.0 - uncertainty)
    confidence_percent = int(round(confidence_calibration * 100))

    manipulation_risk_pct = int(forensic["manipulation_risk_pct"])

    # Decision policy: never force REAL under uncertainty/disagreement.
    review_required = disagreement >= 0.30 and ml_available
    if review_required and confidence_calibration < 0.55:
        assessment: Assessment = "inconclusive"
        legacy_verdict: Literal["fake", "real", "suspicious", "unverified"] = "suspicious"
    elif fusion_score >= 0.72 and confidence_calibration >= 0.45:
        assessment = "ai_generated"
        legacy_verdict = "fake"
    elif manipulation_risk_pct >= 68 and fusion_score < 0.62:
        assessment = "manipulated"
        legacy_verdict = "suspicious"
    elif fusion_score >= 0.56:
        assessment = "possibly_ai_generated"
        legacy_verdict = "suspicious"
    elif fusion_score <= 0.38 and confidence_calibration >= 0.55:
        assessment = "likely_real"
        legacy_verdict = "real"
    else:
        assessment = "inconclusive"
        legacy_verdict = "suspicious"

    if confidence_calibration < 0.35:
        confidence_level = "low"
    elif confidence_calibration < 0.65:
        confidence_level = "medium"
    else:
        confidence_level = "high"

    ai_prob_pct = int(round(fusion_score * 100))
    confidence_percent = int(round(confidence_calibration * 100))

    # Decisive UX verdict layer (threshold-driven + override), without removing legacy outputs.
    if fusion_score <= 0.35:
        final_verdict = "REAL"
        verdict_color = "green"
        verdict_reason = "Signals mostly align with authentic image characteristics."
    elif fusion_score >= 0.65:
        final_verdict = "AI GENERATED"
        verdict_color = "red"
        verdict_reason = "ML and forensic indicators align with synthetic image patterns."
    else:
        final_verdict = "UNCERTAIN"
        verdict_color = "yellow"
        verdict_reason = "Signals conflict or confidence is insufficient for a reliable determination."

    if (
        ml_score >= 0.80
        and confidence_calibration >= 0.55
        and forensic_score >= 0.15
    ):
        final_verdict = "AI GENERATED"
        verdict_color = "red"
        verdict_reason = "Strong ML synthetic confidence is supported by forensic evidence."

    low_conf_warning = ""
    if confidence_calibration < 0.35:
        low_conf_warning = "Low confidence analysis due to weak or conflicting signals."
    details_txt = (
        f"Hybrid fusion | forensic={int(round(forensic_score*100))}% | "
        f"ml={int(round(ml_score*100))}% | fusion={ai_prob_pct}% | "
        f"assessment={assessment} | disagreement={disagreement:.2f}"
    )
    if failed_ct:
        details_txt += f" | partial forensic signals unavailable={failed_ct}"
    if not ml_available:
        details_txt += " | ML classifier unavailable (forensic-only fallback)"
    elif review_required:
        details_txt += " | forensic/ML disagreement detected (review required)"

    findings = [
        f"Assessment: {assessment.replace('_', ' ')}",
        f"Fusion synthetic probability: {ai_prob_pct}%",
        f"Forensic score: {int(round(forensic_score*100))}%",
        f"AI model score: {int(round(ml_score*100))}% ({model_result.model_name})",
        f"Confidence calibration: {confidence_level.upper()} ({confidence_percent}%)",
        f"Model detail: {model_result.detail}",
        *[
            s["detail"]
            for s in sorted(forensic["detectionSignals"], key=lambda z: z["score"], reverse=True)[:5]
        ],
    ]

    if not ml_available:
        findings.append("ML classifier unavailable; result based on forensic signals only.")
    if review_required:
        findings.append("Forensic and ML signals disagree materially; manual review recommended.")
    if low_conf_warning:
        findings.append(low_conf_warning)

    if final_verdict == "AI GENERATED":
        assessment = "ai_generated" if assessment in {"likely_real", "inconclusive"} else assessment
        legacy_verdict = "fake" if legacy_verdict in {"real", "unverified"} else legacy_verdict
    elif final_verdict == "REAL":
        assessment = "likely_real" if assessment not in {"manipulated"} else assessment
        legacy_verdict = "real" if legacy_verdict in {"suspicious", "unverified"} else legacy_verdict
    else:
        legacy_verdict = "suspicious" if legacy_verdict == "real" and review_required else legacy_verdict

    return {
        "assessment": assessment,
        "legacy_verdict": legacy_verdict,
        "verdict": final_verdict,
        "verdict_color": verdict_color,
        "confidence_percent": confidence_percent,
        "verdict_reason": verdict_reason,
        "confidencePercent": confidence_percent,
        "confidence": round(confidence_calibration, 4),
        "confidenceScore": round(confidence_calibration, 4),
        "aiProbability": ai_prob_pct,
        "manipulationRisk": manipulation_risk_pct,
        "confidenceLevel": confidence_level,
        "detectionSignals": forensic["detectionSignals"],
        "metadataStatus": forensic["metadataStatus"],
        "suspiciousIndicators": forensic["suspiciousIndicators"],
        "details": details_txt,
        "findings": findings,
        "analysis": {
            "combined_synthetic_index": round(fusion_score, 4),
            "uncertainty": round(1.0 - confidence_calibration, 4),
            "signal_spread": round(float(forensic["signal_spread"]), 4),
            "signals_count": len(signals),
        },
        "is_deepfake": final_verdict == "AI GENERATED",
        "ai_model_score": round(ml_score, 4),
        "forensic_score": round(forensic_score, 4),
        "fusion_score": round(fusion_score, 4),
        "confidence_calibration": round(confidence_calibration, 4),
        "model_name": model_result.model_name,
    }


def _run_signal(key: str, category: Literal["ai", "integrity", "general"], fn: Callable[[], SignalResult]) -> SignalResult:
    try:
        return fn()
    except cv2.error as exc:
        logger.warning("OpenCV error in signal %s: %s", key, exc)
        return SignalResult(key, 0.5, f"Unavailable: OpenCV error ({key}).", category)
    except Exception as exc:
        logger.warning("Signal %s failed: %s", key, exc)
        return SignalResult(key, 0.5, f"Unavailable: {type(exc).__name__}.", category)


def run_forensic_pipeline(file_path: str, cascade: Optional[cv2.CascadeClassifier] = None) -> Dict[str, Any]:
    img = _load_image_bgr(file_path)
    if img is None:
        raise ValueError("Could not load uploaded file as image.")

    img, _scale = _resize_long_edge(img, 896)
    if cascade is None:
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

    try:
        face_roi, has_face, box = _face_roi_gray(img, cascade)
    except Exception as exc:
        logger.warning("Face detection failed, continuing without face ROI: %s", exc)
        gray_full = _to_gray_u8(img)
        face_roi, has_face, box = None, False, (0, 0, gray_full.shape[1], gray_full.shape[0])

    gray_full = _to_gray_u8(img)

    signals: List[SignalResult] = []
    signals.append(_run_signal("metadata", "integrity", lambda: analyze_metadata(file_path)))
    signals.append(_run_signal("compression_ela", "integrity", lambda: analyze_compression_el_signal(img)))
    signals.append(
        _run_signal("smoothness", "ai", lambda: analyze_smoothness(img, face_roi, has_face))
    )
    signals.append(_run_signal("frequency", "ai", lambda: analyze_frequency_rings(gray_full)))
    signals.append(_run_signal("texture_gradient", "ai", lambda: analyze_texture_gradient(img, box)))
    signals.append(_run_signal("symmetry_face", "ai", lambda: analyze_face_symmetry(face_roi, has_face)))
    signals.append(_run_signal("noise_residual", "integrity", lambda: analyze_noise_residual(gray_full)))
    signals.append(
        _run_signal("color_saturation", "ai", lambda: analyze_color_saturation(img, box, has_face))
    )

    model_result = _get_classifier().score_image(img)
    return fuse_signals(signals, model_result)


class DeepfakeDetector:
    """Backward-compatible entrypoint wrapping the forensic pipeline."""

    def __init__(self) -> None:
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        _prime_classifier_background()

    def detect_deepfake(self, file_path: str) -> Dict[str, Any]:
        return run_forensic_pipeline(file_path, self.face_cascade)
