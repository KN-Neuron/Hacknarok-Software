"""
Integrity Clash Detection.

Sytuacja: plik ma ważny manifest C2PA twierdzący "stworzone przez człowieka X",
ale jednocześnie wykrywamy sygnały AI (watermark / artefakty / behawior).

Manifest może być technicznie poprawny — ktoś po prostu podpisał nieuczciwą
asercję. Albo użył legalnego narzędzia w nielegalny sposób (przefotografował
deepfake aparatem z C2PA -> "analog hole").

Tutaj: prosta implementacja — w prawdziwym systemie podpinamy SynthID/Hive/etc.
Dla demo: heurystyki + symulator (możemy oznaczyć obraz jako "AI" w demo data).

Zwraca verdict z poziomami: NONE / SUSPECTED / CONFIRMED.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .behavior import KeystrokeStats
from .manifest import Manifest


class ClashVerdict(str, Enum):
    NONE = "none"                 # manifest spójny z sygnałami
    SUSPECTED = "suspected"       # umiarkowany konflikt (np. behawior wygląda na pastę)
    CONFIRMED = "confirmed"       # silny konflikt (np. SynthID + manifest "human")


@dataclass
class ClashReport:
    verdict: ClashVerdict
    reasons: list[str]
    score: float  # 0..1, większe = bardziej clash

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict.value,
            "reasons": self.reasons,
            "score": round(self.score, 3),
        }


def detect_text_clash(
    manifest: Manifest | None,
    behavior: KeystrokeStats | None = None,
    ai_text_score: float | None = None,  # opcjonalnie: GPTZero-like score 0..1
) -> ClashReport:
    """Sprawdza czy manifest tekstu jest spójny z sygnałami behawioralnymi i AI."""
    reasons: list[str] = []
    score = 0.0

    claims_human = manifest is not None and not manifest.is_ai_generated()

    if manifest is None:
        return ClashReport(ClashVerdict.NONE, ["Brak manifestu — nie można ocenić"], 0.0)

    # 1. Manifest twierdzi "człowiek", ale brak rytmu pisania
    if claims_human and behavior is not None:
        if not behavior.looks_human and behavior.confidence > 0.7:
            reasons.append(
                f"Manifest twierdzi 'człowiek', ale rytm pisania to wskazuje "
                f"na wklejenie/automat (confidence {behavior.confidence:.0%})"
            )
            score += 0.5

        if behavior.keystroke_count == 0 and len(manifest.assertions) > 0:
            reasons.append("Brak zapisanych zdarzeń klawiatury dla treści 'pisanej przez człowieka'")
            score += 0.3

    # 2. Klasyfikator AI mówi "to LLM", ale manifest mówi "człowiek"
    if claims_human and ai_text_score is not None and ai_text_score > 0.7:
        reasons.append(
            f"Klasyfikator AI ocenia treść jako wygenerowaną "
            f"(prawdopodobieństwo {ai_text_score:.0%})"
        )
        score += 0.4

    return _verdict_from_score(score, reasons)


def detect_image_clash(
    manifest: Manifest | None,
    synthid_detected: bool = False,
    ai_artifact_score: float | None = None,
    declared_real_person_id: str | None = None,
    expected_signing_credential_id: str | None = None,
) -> ClashReport:
    """
    Dla obrazów: manifest "real photo by X" vs sygnał AI watermark / detektor.
    Plus negative provenance: deklarowana osoba ma certyfikat sprzętowy,
    ale ten plik go nie ma.
    """
    reasons: list[str] = []
    score = 0.0

    if manifest is None:
        # Brak manifestu + sygnały AI + deklarowana ofiara -> CONFIRMED (personal alibi)
        if declared_real_person_id and (synthid_detected or (ai_artifact_score and ai_artifact_score > 0.7)):
            reasons.append(
                f"Treść przedstawia osobę '{declared_real_person_id}', ale "
                f"NIE pochodzi z jej zarejestrowanego urządzenia — "
                f"to nie ona to nagrała/sfotografowała"
            )
            if synthid_detected:
                reasons.append("Wykryto watermark AI (SynthID) w pikselach obrazu")
            if ai_artifact_score and ai_artifact_score > 0.7:
                reasons.append(
                    f"Klasyfikator wykrywa artefakty generatywne ({ai_artifact_score:.0%})"
                )
            return ClashReport(ClashVerdict.CONFIRMED, reasons, 0.85)

        if synthid_detected or (ai_artifact_score and ai_artifact_score > 0.7):
            reasons.append("Brak manifestu, ale wykryto sygnały AI — treść niezweryfikowana")
            if synthid_detected:
                reasons.append("Watermark AI obecny")
            return ClashReport(ClashVerdict.SUSPECTED, reasons, 0.6)

    if manifest is None:
        return ClashReport(ClashVerdict.NONE, ["Brak manifestu"], 0.0)

    claims_human = not manifest.is_ai_generated()

    # 1. Manifest: real photo + SynthID present -> CONFIRMED clash
    if claims_human and synthid_detected:
        reasons.append("Manifest twierdzi 'autentyczne zdjęcie', ale wykryto watermark AI (SynthID)")
        score += 0.7

    # 2. Klasyfikator artefaktów AI
    if claims_human and ai_artifact_score is not None and ai_artifact_score > 0.7:
        reasons.append(
            f"Klasyfikator wykrywa artefakty generatywne "
            f"(score {ai_artifact_score:.0%})"
        )
        score += 0.4

    # 3. Negative provenance — ofiara ma certyfikat sprzętowy, ale tu go nie ma
    if (declared_real_person_id and expected_signing_credential_id
            and manifest.claim
            and manifest.claim.signing_credential_id != expected_signing_credential_id):
        reasons.append(
            f"Treść przedstawia osobę {declared_real_person_id}, ale podpis "
            f"NIE pochodzi z jej zarejestrowanego urządzenia "
            f"(personal alibi mismatch)"
        )
        score += 0.6

    return _verdict_from_score(score, reasons)


def _verdict_from_score(score: float, reasons: list[str]) -> ClashReport:
    if score >= 0.6:
        v = ClashVerdict.CONFIRMED
    elif score >= 0.3:
        v = ClashVerdict.SUSPECTED
    else:
        v = ClashVerdict.NONE
        if not reasons:
            reasons = ["Brak sprzeczności między manifestem a sygnałami"]
    return ClashReport(v, reasons, min(score, 1.0))
