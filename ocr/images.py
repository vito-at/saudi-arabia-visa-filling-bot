"""Работа с изображениями: загрузка, обрезка страницы паспорта, вырезание лица, сжатие."""

from __future__ import annotations

import io
import logging

import cv2
import numpy as np
from PIL import Image, ImageOps

log = logging.getLogger(__name__)


def load_image(data: bytes) -> np.ndarray:
    """bytes (JPG/PNG/HEIC-конвертированный) → BGR numpy, с учётом поворота из EXIF."""
    pil = Image.open(io.BytesIO(data))
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def encode_jpeg(image: np.ndarray, max_kb: int | None = None, max_side: int | None = None) -> bytes:
    """Кодирует в JPEG, при необходимости уменьшая качество/размер, чтобы влезть в max_kb."""
    img = image
    if max_side and max(img.shape[:2]) > max_side:
        scale = max_side / max(img.shape[:2])
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    quality = 92
    while True:
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise ValueError("Не удалось закодировать JPEG")
        data = buf.tobytes()
        if max_kb is None or len(data) <= max_kb * 1024:
            return data
        if quality > 60:
            quality -= 8
        else:
            img = cv2.resize(img, None, fx=0.85, fy=0.85, interpolation=cv2.INTER_AREA)
            if min(img.shape[:2]) < 200:
                return data


def _order_corners(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def crop_document(image: np.ndarray) -> np.ndarray:
    """Ищет страницу паспорта (самый большой четырёхугольник) и выравнивает её.

    Если уверенно найти не удалось — возвращает исходное фото без изменений.
    """
    h, w = image.shape[:2]
    scale = 1000 / max(h, w)
    small = cv2.resize(image, None, fx=scale, fy=scale) if scale < 1 else image.copy()
    scale = min(scale, 1.0)

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    area_total = small.shape[0] * small.shape[1]
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(cnt) < area_total * 0.25:
            break
        approx = cv2.approxPolyDP(cnt, 0.02 * cv2.arcLength(cnt, True), True)
        if len(approx) != 4:
            continue
        rect = _order_corners(approx.reshape(4, 2).astype("float32") / scale)
        tl, tr, br, bl = rect
        width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
        height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
        ratio = width / max(height, 1)
        # Страница паспорта с данными ~ 125x88 мм (≈1.42). Даём запас на перспективу.
        if not 1.1 <= ratio <= 1.9:
            continue
        dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
                       dtype="float32")
        matrix = cv2.getPerspectiveTransform(rect, dst)
        return cv2.warpPerspective(image, matrix, (width, height))

    log.info("Контур паспорта не найден, используется исходное фото")
    return image


def crop_face(image: np.ndarray) -> np.ndarray | None:
    """Вырезает лицо с фото в паспорте в пропорции 3:4 (как фото на документы)."""
    if not hasattr(cv2, "CascadeClassifier"):
        log.warning("В установленной версии OpenCV нет детектора лиц (нужна 4.x)")
        return None
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    min_side = max(40, min(image.shape[:2]) // 12)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6,
                                     minSize=(min_side, min_side))
    if len(faces) == 0:
        return None

    # Основное фото — самое крупное лицо (мелкое «призрачное» фото тоже бывает в паспорте)
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    cx, cy = x + fw / 2, y + fh / 2
    crop_w = fw * 1.9
    crop_h = crop_w * 4 / 3
    top = int(max(0, cy - crop_h * 0.45))
    bottom = int(min(image.shape[0], cy + crop_h * 0.55))
    left = int(max(0, cx - crop_w / 2))
    right = int(min(image.shape[1], cx + crop_w / 2))
    return image[top:bottom, left:right].copy()


def blur_score(image: np.ndarray) -> float:
    """Чем больше, тем резче. Меньше ~60 — фото, скорее всего, размыто."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())
