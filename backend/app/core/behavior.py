"""
Behavioral Attestation (ZK-PoP lite).

Pełen ZK-PoP (Zero-Knowledge Process Attestation, arxiv 2603.00179) wymaga
Groth16 + Pedersen commitments + Bulletproofs. W 24h tego nie zrobimy.

Zamiast tego liczymy digest behawioralny, który:
  1. Nie ujawnia surowych keystroke timings (prywatność)
  2. Pozwala odróżnić "człowiek pisał" od "wkleiłem z LLM" / "wpisał skrypt"
  3. Daje się zweryfikować statystycznie — pasta ma idealny rytm, człowiek ma jitter

Wejście od frontendu: lista (key, dwell_ms, gap_ms_to_next) — bez treści klawisza,
tylko czas. Liczymy: średnia, stddev, max gap, count, czy są pauzy >500ms (myślenie),
czy rozkład gapów wygląda na ludzki.
"""

from __future__ import annotations

import hashlib
import statistics
from dataclasses import dataclass


@dataclass
class KeystrokeStats:
    """Statystyki rytmu pisania — anonimowe, nieodwracalne."""
    keystroke_count: int
    duration_ms: int                    # od pierwszego do ostatniego klawisza
    mean_gap_ms: float                  # średnia przerwa między klawiszami
    stddev_gap_ms: float                # rozrzut (człowiek -> wyższy)
    max_gap_ms: int                     # najdłuższa pauza (>500ms = "myślenie")
    pause_count: int                    # liczba pauz >500ms
    burst_count: int                    # liczba "burstów" (sekwencji <50ms gap)
    digest: str                         # SHA-256 nad surowymi danymi (tamper-evident)
    looks_human: bool                   # heurystyka
    confidence: float                   # 0..1

    def to_assertion_data(self) -> dict:
        """Format do wstawienia jako trustlayer.behavior assertion."""
        return {
            "keystroke_count": self.keystroke_count,
            "duration_ms": self.duration_ms,
            "stats": {
                "mean_gap_ms": round(self.mean_gap_ms, 2),
                "stddev_gap_ms": round(self.stddev_gap_ms, 2),
                "max_gap_ms": self.max_gap_ms,
                "pause_count": self.pause_count,
                "burst_count": self.burst_count,
            },
            "digest": self.digest,
            "looks_human": self.looks_human,
            "confidence": round(self.confidence, 3),
            "method": "trustlayer.zkpop_lite/v1",
        }


def analyze_keystrokes(events: list[dict]) -> KeystrokeStats:
    """
    Wejście: lista eventów {"t": timestamp_ms, "type": "down"|"up"} po kolei.
    Frontend wysyła tylko czasy, bez kodów klawiszy (prywatność).
    """
    if len(events) < 2:
        return _empty_stats()

    downs = [e["t"] for e in events if e.get("type") == "down"]
    if len(downs) < 2:
        return _empty_stats()

    gaps = [downs[i + 1] - downs[i] for i in range(len(downs) - 1)]
    duration = downs[-1] - downs[0]

    mean_gap = statistics.fmean(gaps)
    stddev_gap = statistics.stdev(gaps) if len(gaps) > 1 else 0.0
    max_gap = max(gaps)
    pause_count = sum(1 for g in gaps if g > 500)
    burst_count = sum(1 for g in gaps if g < 50)

    # Digest dla tamper-evidence (nie ujawniamy gapów, tylko ich hash)
    digest = hashlib.sha256(
        ",".join(str(g) for g in gaps).encode()
    ).hexdigest()

    looks_human, confidence = _is_human(
        gap_count=len(gaps),
        mean_gap=mean_gap,
        stddev_gap=stddev_gap,
        max_gap=max_gap,
        pause_count=pause_count,
        burst_count=burst_count,
    )

    return KeystrokeStats(
        keystroke_count=len(downs),
        duration_ms=duration,
        mean_gap_ms=mean_gap,
        stddev_gap_ms=stddev_gap,
        max_gap_ms=max_gap,
        pause_count=pause_count,
        burst_count=burst_count,
        digest=digest,
        looks_human=looks_human,
        confidence=confidence,
    )


def _is_human(gap_count: int, mean_gap: float, stddev_gap: float,
              max_gap: int, pause_count: int, burst_count: int) -> tuple[bool, float]:
    """
    Heurystyka: typowe rozróżnienia człowiek vs paste vs bot:
      - Paste: gap_count=0 lub bardzo małe (1-2 eventy "down"), brak rytmu
      - Bot równomierny: stddev/mean < 0.05, brak pauz
      - Człowiek: stddev/mean > 0.4, są pauzy >500ms, mix bursts + pauz
    """
    if gap_count < 3:
        return False, 0.95  # zbyt mało żeby ocenić — prawdopodobnie paste

    cv = stddev_gap / mean_gap if mean_gap > 0 else 0  # coefficient of variation

    score = 0.0
    # Człowiek ma dużą zmienność
    if cv > 0.5:
        score += 0.4
    elif cv > 0.3:
        score += 0.25
    elif cv < 0.1:
        score -= 0.3  # bot równomierny

    # Człowiek robi przerwy
    if pause_count >= 1:
        score += 0.25
    if pause_count >= 3:
        score += 0.15

    # Człowiek robi też bursty (znane słowa)
    if burst_count >= 2 and pause_count >= 1:
        score += 0.2  # mix = bardzo ludzki

    # Średnia ludzka: 80-300ms
    if 60 <= mean_gap <= 400:
        score += 0.1

    confidence = max(0.0, min(1.0, 0.5 + score))
    return confidence >= 0.55, confidence


def _empty_stats() -> KeystrokeStats:
    return KeystrokeStats(
        keystroke_count=0, duration_ms=0,
        mean_gap_ms=0.0, stddev_gap_ms=0.0, max_gap_ms=0,
        pause_count=0, burst_count=0,
        digest=hashlib.sha256(b"").hexdigest(),
        looks_human=False, confidence=0.95,
    )
