"""
C2PA Section A.7 — Embedded Metadata in Plain Text.

Wykorzystujemy Unicode Variation Selectors:
  - VS1-VS16:    U+FE00..U+FE0F        (16 kodów = 4 bity)
  - VS17-VS256:  U+E0100..U+E01EF      (240 kodów; my używamy pierwszych 16 dla 4 bitów)

Każdy bajt manifestu = 2 niewidoczne znaki (high nibble + low nibble) doczepione
po pierwszym znaku tekstu. Renderery ignorują VS-y dla znaków bez wariantów,
więc tekst wygląda identycznie. Copy-paste przenosi manifest między platformami
(WhatsApp Web -> Telegram -> e-mail), o ile platforma nie sanitizuje znaków.

Wada: większość komunikatorów wycina te znaki (security). Dlatego mamy też
soft binding (SimHash) jako fallback.

Spec ref: https://www.unicode.org/L2/L2026/26042-embedded-metadata-in-plain-text.pdf
"""

from __future__ import annotations

import json
import zlib

# 16 wariantów -> 4 bity each
_VS_BLOCK_1 = [chr(0xFE00 + i) for i in range(16)]   # VS1-VS16
_VS_BLOCK_2 = [chr(0xE0100 + i) for i in range(16)]  # podzbiór VS17+

_NIBBLE_HIGH = _VS_BLOCK_2  # high nibble z drugiego bloku
_NIBBLE_LOW = _VS_BLOCK_1   # low nibble z pierwszego bloku

_ALL_VS = set(_VS_BLOCK_1 + _VS_BLOCK_2)


# Sygnatura startowa, żeby odróżnić nasze metadane od przypadkowych VS-ów
_MAGIC = b"TL\x01"  # TrustLayer v1


def embed(text: str, payload: dict) -> str:
    """Osadza payload (JSON) w tekście jako niewidoczne znaki Unicode VS."""
    if not text:
        raise ValueError("Tekst musi mieć co najmniej jeden znak")

    raw = _MAGIC + zlib.compress(json.dumps(payload, separators=(",", ":")).encode())
    encoded = "".join(_byte_to_vs(b) for b in raw)

    # Wstaw po pierwszym code pointcie (żeby przeżył trim/strip na początku)
    return text[0] + encoded + text[1:]


def extract(text: str) -> dict | None:
    """Wyciąga osadzony payload z tekstu. Zwraca None jeśli go nie ma."""
    vs_chars = [c for c in text if c in _ALL_VS]
    if len(vs_chars) < len(_MAGIC) * 2:
        return None

    # Każde 2 znaki VS = 1 bajt
    bytes_out = bytearray()
    for i in range(0, len(vs_chars) - 1, 2):
        try:
            high = _NIBBLE_HIGH.index(vs_chars[i])
            low = _NIBBLE_LOW.index(vs_chars[i + 1])
        except ValueError:
            continue
        bytes_out.append((high << 4) | low)

    # Sprawdź magic
    if not bytes_out.startswith(_MAGIC):
        return None

    try:
        decompressed = zlib.decompress(bytes(bytes_out[len(_MAGIC):]))
        return json.loads(decompressed.decode())
    except (zlib.error, json.JSONDecodeError, UnicodeDecodeError):
        return None


def strip(text: str) -> str:
    """Usuwa wszystkie VS-y z tekstu (symulacja sanitizera platformy)."""
    return "".join(c for c in text if c not in _ALL_VS)


def has_embedded_metadata(text: str) -> bool:
    return extract(text) is not None


def _byte_to_vs(b: int) -> str:
    high = (b >> 4) & 0xF
    low = b & 0xF
    return _NIBBLE_HIGH[high] + _NIBBLE_LOW[low]
