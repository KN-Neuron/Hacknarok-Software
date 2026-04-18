"""
Soft binding — fingerprinty odporne na transformacje.

Tekst: SimHash (Charikar 2002) na 3-gramach słów. Dwa teksty są "podobne"
jeśli ich SimHashe różnią się o <= próg bitów (Hamming distance).
Działa dla copy-paste z drobnymi modyfikacjami / parafraz.

Obrazy: pHash (Zauner 2010) — DCT na 32x32 grayscale, bierzemy 8x8 niskich
częstotliwości, porównujemy z medianą. Przeżywa kompresję, resize, drobne
edycje. Dla AI-generated detection inny temat.
"""

from __future__ import annotations

import hashlib
import re
from io import BytesIO
from typing import Iterable

import numpy as np
from PIL import Image


# ---------- Tekst: SimHash ----------

def _tokenize(text: str, ngram: int = 3) -> Iterable[str]:
    """Słowa -> n-gramy. Małe litery, polskie znaki ok, interpunkcja out."""
    words = re.findall(r"\w+", text.lower(), flags=re.UNICODE)
    if len(words) < ngram:
        # dla bardzo krótkich tekstów (np. "Wyślij BLIK 500zł") — n-gramy znakowe
        s = "".join(words)
        return [s[i:i + ngram] for i in range(len(s) - ngram + 1)] or [s]
    return [" ".join(words[i:i + ngram]) for i in range(len(words) - ngram + 1)]


def simhash(text: str, bits: int = 64, ngram: int = 3) -> int:
    """SimHash 64-bit, klasyczny Charikar."""
    v = [0] * bits
    for token in _tokenize(text, ngram=ngram):
        h = int.from_bytes(hashlib.blake2b(token.encode(), digest_size=8).digest(), "big")
        for i in range(bits):
            v[i] += 1 if (h >> i) & 1 else -1
    out = 0
    for i in range(bits):
        if v[i] > 0:
            out |= 1 << i
    return out


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def simhash_hex(text: str) -> str:
    return f"{simhash(text):016x}"


def text_similarity(a: str, b: str) -> tuple[int, float]:
    """Zwraca (Hamming distance, similarity 0..1) dla dwóch tekstów."""
    ha = simhash(a)
    hb = simhash(b)
    d = hamming(ha, hb)
    return d, 1.0 - d / 64.0


# ---------- Obraz: pHash ----------

def phash(image_bytes: bytes, hash_size: int = 8, dct_size: int = 32) -> str:
    """Perceptual hash — pierwsze hash_size x hash_size niskich częstotliwości DCT."""
    img = Image.open(BytesIO(image_bytes)).convert("L").resize(
        (dct_size, dct_size), Image.LANCZOS
    )
    arr = np.asarray(img, dtype=np.float32)

    # 2D DCT-II wzdłuż obu osi
    dct = _dct2(arr)
    low = dct[:hash_size, :hash_size]

    # Pomijamy DC (low[0,0])
    flat = low.flatten()[1:]
    median = np.median(flat)
    bits = (low.flatten() > median).astype(np.uint8)
    bits[0] = 0  # DC zerowane dla stabilności

    # Pakujemy na hex
    out = 0
    for i, bit in enumerate(bits):
        if bit:
            out |= 1 << i
    return f"{out:0{hash_size * hash_size // 4}x}"


def _dct2(a: np.ndarray) -> np.ndarray:
    """2D DCT-II przez scipy, jak dostępne; inaczej fallback przez FFT."""
    try:
        from scipy.fftpack import dct
        return dct(dct(a, axis=0, norm="ortho"), axis=1, norm="ortho")
    except ImportError:
        # Fallback — wolniejszy, ale działa
        N = a.shape[0]
        n = np.arange(N)
        k = n.reshape((N, 1))
        cos_mat = np.cos(np.pi * (2 * n + 1) * k / (2 * N))
        norm = np.sqrt(2.0 / N) * np.ones(N)
        norm[0] = np.sqrt(1.0 / N)
        D = norm.reshape(-1, 1) * cos_mat
        return D @ a @ D.T


def image_similarity(hash_a: str, hash_b: str) -> tuple[int, float]:
    """Hamming dla pHash (hex). Zwraca (distance, similarity)."""
    if len(hash_a) != len(hash_b):
        return 9999, 0.0
    a = int(hash_a, 16)
    b = int(hash_b, 16)
    bits = len(hash_a) * 4
    d = bin(a ^ b).count("1")
    return d, 1.0 - d / bits
