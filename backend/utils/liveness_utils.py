import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path
import logging

LOGGER = logging.getLogger(__name__)

def check_liveness(image_path: Path | str | None) -> tuple[float, str]:
    """
    Rasm haqiqiyligini tekshiradi (Anti-spoofing).
    Qaytaradi: (liveness_score: float, liveness_status: str)
    liveness_score: 0.0 - 1.0 (1.0 - haqiqiy yuz, 0.0 - spoof/soxta)
    liveness_status: 'real' yoki 'spoof'
    """
    try:
        if not image_path:
            return 1.0, "real"
            
        path = Path(image_path)
        if not path.exists() or not path.is_file():
            return 1.0, "real"

        with Image.open(path) as img:
            # Grayscale ko'rinishga o'tkazamiz
            gray = img.convert("L")
            width, height = gray.size
            
            if width < 40 or height < 40:
                return 1.0, "real"  # juda kichik rasm bo'lsa tekshirmaymiz

            arr = np.array(gray, dtype=np.float32)

            # 1. Laplacian blur check (Sharpness evaluation)
            # Pillow-ning Kernel filtri orqali Laplacian rasmini olamiz
            laplacian_filter = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1, offset=0)
            laplacian_img = gray.filter(laplacian_filter)
            lap_arr = np.array(laplacian_img, dtype=np.float32)
            
            variance = float(np.var(lap_arr))

            # 2. FFT Moire Pattern Check (Screen capture detection)
            # Ekranlardan rasm ko'rsatilganda yuqori chastotali moire to'lqinlari yuzaga keladi.
            f_transform = np.fft.fft2(arr)
            f_shift = np.fft.fftshift(f_transform)
            magnitude_spectrum = 20 * np.log(np.abs(f_shift) + 1e-9)

            cy, cx = height // 2, width // 2
            r = min(height, width) // 10  # past chastotali markaz radiusi
            
            # Past chastotalarni (markazni) filtrlash
            magnitude_spectrum[max(0, cy-r):min(height, cy+r), max(0, cx-r):min(width, cx+r)] = 0
            
            high_freq_mean = float(np.mean(magnitude_spectrum))

            # 3. Specular Glare check (Reflection ratio)
            # Ekran yoki qog'oz silliqligi tufayli oq porlash nuqtalari tekshiriladi
            white_pixels = np.sum(arr >= 252)
            glare_ratio = float(white_pixels / (width * height))

            # 4. Ballar hisoblash logikasi (Heuristics)
            # Haqiqiy kameradan tushgan tasvirlar yuqori darajada aniq va moire chiziqlarisiz bo'ladi.
            score = 1.0
            reasons = []

            # Loyqalik (o'ta blur - qog'oz yoki ekrandan noto'g'ri fokuslangan suratlar)
            if variance < 28.0:
                diff = (28.0 - variance) / 28.0
                score -= min(0.4, diff * 0.4)
                reasons.append(f"blur({variance:.1f})")

            # Ekran moire shovqini
            if high_freq_mean > 92.0:
                diff = (high_freq_mean - 92.0) / 40.0
                score -= min(0.5, diff * 0.5)
                reasons.append(f"moire({high_freq_mean:.1f})")
            elif high_freq_mean < 18.0:
                # Juda tekis yuzlar (flat smooth digital spoofing)
                score -= 0.25
                reasons.append(f"flat_texture({high_freq_mean:.1f})")

            # Yoritishning aks etishi (glare)
            if glare_ratio > 0.08:
                score -= 0.35
                reasons.append(f"glare({glare_ratio * 100:.1f}%)")

            # Yakuniy natija
            score = max(0.0, min(1.0, float(score)))
            status = "real" if score >= 0.60 else "spoof"

            LOGGER.debug(
                "[Liveness] Path=%s, Status=%s, Score=%.2f, Var=%.1f, HighFreq=%.1f, Glare=%.1f%%, Reasons=%s",
                path.name, status, score, variance, high_freq_mean, glare_ratio * 100, reasons
            )
            return score, status

    except Exception as exc:
        LOGGER.error("[Liveness] Xatolik yuz berdi: %s", exc)
        return 1.0, "real"  # Har qanday kutilmagan xatoda jarayon to'xtab qolmasligi uchun fallback
