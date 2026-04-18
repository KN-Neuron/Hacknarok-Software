"""
Verifier service — weryfikuje treść po stronie odbiorcy.

Trzy ścieżki:
  1. Hard binding match — manifest jest wbudowany lub przekazany, hash zgodny
  2. Soft binding recovery — manifestu nie ma, ale SimHash/pHash znajduje
     bliski w naszym Manifest Store -> "treść powiązana z X"
  3. Brak — niewerywikowane (szara ikona, NIE czerwona)

Plus na końcu: Integrity Clash check.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from ..core import crypto, section_a7, soft_binding, store
from ..core.behavior import KeystrokeStats, analyze_keystrokes
from ..core.integrity_clash import (
    ClashReport,
    ClashVerdict,
    detect_image_clash,
    detect_text_clash,
)
from ..core.manifest import Manifest


class VerificationStatus(str, Enum):
    VERIFIED = "verified"           # signed + hash match + sig OK
    RECOVERED = "recovered"         # soft binding match
    INTEGRITY_CLASH = "integrity_clash"  # signed but inconsistent
    TAMPERED = "tampered"           # manifest jest, ale hash/sig nie pasuje
    UNVERIFIED = "unverified"       # brak manifestu, brak match


@dataclass
class VerificationResult:
    status: VerificationStatus
    manifest: Manifest | None = None
    soft_match_distance: int | None = None     # ile bitów różnicy w soft hash
    signature_valid: bool | None = None
    hard_hash_match: bool | None = None
    clash: ClashReport | None = None
    author: dict | None = None
    summary: str = ""
    badges: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "manifest": self.manifest.to_dict() if self.manifest else None,
            "soft_match_distance": self.soft_match_distance,
            "signature_valid": self.signature_valid,
            "hard_hash_match": self.hard_hash_match,
            "clash": self.clash.to_dict() if self.clash else None,
            "author": self.author,
            "summary": self.summary,
            "badges": self.badges,
            "details": self.details,
        }


# ---------- Tekst ----------

def verify_text(
    text: str,
    keystroke_events: list[dict] | None = None,
    ai_text_score: float | None = None,
) -> VerificationResult:
    """Weryfikuje wiadomość tekstową."""
    # 1. Próba: czy w tekście są osadzone metadane (Section A.7)?
    embedded = section_a7.extract(text)
    plain = section_a7.strip(text)

    # 2. Hard binding lookup po hash gołego tekstu
    hard_hash = crypto.sha256_hex(plain)
    manifest = store.get_manifest_by_hard_hash(hard_hash)

    # 3. Jeśli embedded ma manifest_id, weź go zamiast lookupu po hash
    if embedded and "mid" in embedded:
        m = store.get_manifest_by_id(embedded["mid"])
        if m:
            manifest = m

    if manifest:
        return _build_verified_text(plain, manifest, keystroke_events, ai_text_score, hard_hash)

    # 4. Soft binding fallback
    sh = soft_binding.simhash_hex(plain)
    soft_hits = store.search_by_soft_hash(sh, "simhash64", max_hamming=8)

    if soft_hits:
        m, distance = soft_hits[0]
        author = _author_info(m)
        return VerificationResult(
            status=VerificationStatus.RECOVERED,
            manifest=m,
            soft_match_distance=distance,
            hard_hash_match=False,
            signature_valid=_check_sig(m),
            author=author,
            summary=(
                f"Treść wygląda na podobną do podpisanej wcześniej przez "
                f"{author.get('display_name', 'nieznanego autora')} "
                f"(podobieństwo {(1 - distance / 64) * 100:.0f}%). "
                f"Mogła zostać przepisana lub lekko zmieniona po podpisaniu."
            ),
            badges=["RECOVERED", "SOFT_BINDING"],
            details={
                "soft_hash": sh,
                "matched_soft_hash": m.soft_hash(),
                "embedded_metadata_present": embedded is not None,
            },
        )

    return VerificationResult(
        status=VerificationStatus.UNVERIFIED,
        summary="Brak proweniencji. Treść nie jest niczym podpisana — nie znaczy to, że jest fałszywa, ale nie da się jej zweryfikować.",
        badges=["UNVERIFIED"],
        details={"hard_hash": hard_hash, "soft_hash": sh},
    )


def _build_verified_text(
    plain: str,
    manifest: Manifest,
    keystroke_events: list[dict] | None,
    ai_text_score: float | None,
    hard_hash: str,
) -> VerificationResult:
    sig_valid = _check_sig(manifest)
    hard_match = manifest.hard_hash() == hard_hash

    if not hard_match:
        return VerificationResult(
            status=VerificationStatus.TAMPERED,
            manifest=manifest,
            hard_hash_match=False,
            signature_valid=sig_valid,
            author=_author_info(manifest),
            summary="Manifest jest, ale treść została zmodyfikowana po podpisaniu. Nie ufaj.",
            badges=["TAMPERED"],
        )

    if not sig_valid:
        return VerificationResult(
            status=VerificationStatus.TAMPERED,
            manifest=manifest,
            hard_hash_match=True,
            signature_valid=False,
            author=_author_info(manifest),
            summary="Podpis kryptograficzny nie weryfikuje się. Manifest mógł być sfałszowany.",
            badges=["INVALID_SIGNATURE"],
        )

    # Wszystko OK. Sprawdź Integrity Clash.
    behavior = analyze_keystrokes(keystroke_events) if keystroke_events else None
    clash = detect_text_clash(manifest, behavior=behavior, ai_text_score=ai_text_score)

    if clash.verdict in (ClashVerdict.SUSPECTED, ClashVerdict.CONFIRMED):
        return VerificationResult(
            status=VerificationStatus.INTEGRITY_CLASH,
            manifest=manifest,
            hard_hash_match=True,
            signature_valid=True,
            clash=clash,
            author=_author_info(manifest),
            summary=(
                f"Manifest jest poprawny, ale wykryto sprzeczność: {clash.reasons[0]}. "
                f"Treść może być oznaczona nieuczciwie."
            ),
            badges=["INTEGRITY_CLASH", clash.verdict.value.upper()],
        )

    author = _author_info(manifest)
    badges = ["VERIFIED"]
    if manifest.is_ai_generated():
        badges.append("AI_DECLARED")

    return VerificationResult(
        status=VerificationStatus.VERIFIED,
        manifest=manifest,
        hard_hash_match=True,
        signature_valid=True,
        clash=clash,
        author=author,
        summary=(
            f"Podpisane przez {author.get('display_name', '?')} "
            f"({author.get('device_label') or 'urządzenie'}). "
            f"Treść niezmieniona od podpisania."
        ),
        badges=badges,
    )


# ---------- Obraz ----------

def verify_image(
    image_bytes: bytes,
    declared_real_person_id: str | None = None,
    synthid_detected: bool = False,
    ai_artifact_score: float | None = None,
) -> VerificationResult:
    """Weryfikuje zdjęcie. Plus opcjonalnie: 'to zdjęcie ma być [osoba X]?'"""
    hard_hash = crypto.sha256_hex(image_bytes)
    manifest = store.get_manifest_by_hard_hash(hard_hash)

    if manifest:
        return _build_verified_image(
            manifest, hard_hash, declared_real_person_id,
            synthid_detected, ai_artifact_score,
        )

    # Soft binding
    ph = soft_binding.phash(image_bytes)
    soft_hits = store.search_by_soft_hash(ph, "phash64", max_hamming=8)

    if soft_hits:
        m, distance = soft_hits[0]
        author = _author_info(m)
        return VerificationResult(
            status=VerificationStatus.RECOVERED,
            manifest=m,
            soft_match_distance=distance,
            hard_hash_match=False,
            signature_valid=_check_sig(m),
            author=author,
            summary=(
                f"Obraz wygląda jak podpisane wcześniej zdjęcie "
                f"{author.get('display_name', 'nieznanego autora')} "
                f"(podobieństwo {(1 - distance / 64) * 100:.0f}%). "
                f"Mógł być skompresowany lub przeskalowany."
            ),
            badges=["RECOVERED", "SOFT_BINDING"],
            details={"soft_hash": ph, "matched_soft_hash": m.soft_hash()},
        )

    # Brak match. Ale może i tak jest clash (np. widać AI artifacts).
    clash = detect_image_clash(
        manifest=None,
        synthid_detected=synthid_detected,
        ai_artifact_score=ai_artifact_score,
        declared_real_person_id=declared_real_person_id,
    )

    if clash.verdict != ClashVerdict.NONE:
        return VerificationResult(
            status=VerificationStatus.INTEGRITY_CLASH,
            clash=clash,
            summary=(
                f"Brak proweniencji + wykryto sygnały AI: {clash.reasons[0]}"
                if clash.reasons else "Brak proweniencji + sygnały AI"
            ),
            badges=["UNVERIFIED", "AI_SIGNALS"],
        )

    return VerificationResult(
        status=VerificationStatus.UNVERIFIED,
        summary="Brak proweniencji. Nie da się ustalić źródła.",
        badges=["UNVERIFIED"],
        details={"hard_hash": hard_hash, "soft_hash": ph},
    )


def _build_verified_image(
    manifest: Manifest,
    hard_hash: str,
    declared_real_person_id: str | None,
    synthid_detected: bool,
    ai_artifact_score: float | None,
) -> VerificationResult:
    sig_valid = _check_sig(manifest)
    if not sig_valid:
        return VerificationResult(
            status=VerificationStatus.TAMPERED,
            manifest=manifest,
            hard_hash_match=True,
            signature_valid=False,
            author=_author_info(manifest),
            summary="Podpis nie weryfikuje się.",
            badges=["INVALID_SIGNATURE"],
        )

    expected_cred = None
    if declared_real_person_id:
        creds = store.list_credentials_for_user(declared_real_person_id)
        if creds:
            expected_cred = creds[0]["credential_id"]

    clash = detect_image_clash(
        manifest=manifest,
        synthid_detected=synthid_detected,
        ai_artifact_score=ai_artifact_score,
        declared_real_person_id=declared_real_person_id,
        expected_signing_credential_id=expected_cred,
    )

    author = _author_info(manifest)
    if clash.verdict in (ClashVerdict.SUSPECTED, ClashVerdict.CONFIRMED):
        return VerificationResult(
            status=VerificationStatus.INTEGRITY_CLASH,
            manifest=manifest,
            hard_hash_match=True,
            signature_valid=True,
            clash=clash,
            author=author,
            summary=clash.reasons[0] if clash.reasons else "Wykryto niespójność",
            badges=["INTEGRITY_CLASH", clash.verdict.value.upper()],
        )

    badges = ["VERIFIED"]
    if manifest.is_ai_generated():
        badges.append("AI_DECLARED")

    return VerificationResult(
        status=VerificationStatus.VERIFIED,
        manifest=manifest,
        hard_hash_match=True,
        signature_valid=True,
        clash=clash,
        author=author,
        summary=(
            f"Zdjęcie podpisane przez {author.get('display_name', '?')} "
            f"({author.get('device_label') or 'urządzenie'})."
        ),
        badges=badges,
    )


# ---------- Helpers ----------

def _check_sig(manifest: Manifest) -> bool:
    if not manifest.signature or not manifest.claim:
        return False
    return crypto.verify_signature(
        manifest.signature.public_key,
        manifest.signature.value,
        manifest.claim.to_canonical_bytes(),
    )


def _author_info(manifest: Manifest) -> dict:
    a = manifest.get_assertion("c2pa.author")
    cred_id = manifest.claim.signing_credential_id if manifest.claim else None

    info: dict[str, Any] = {}
    if a:
        info["identifier"] = a.data.get("identifier")
    if cred_id:
        info["credential_id"] = cred_id
        cred = store.get_credential(cred_id)
        if cred:
            info["device_label"] = cred["device_label"]
            info["hardware_backed"] = bool(cred["is_hardware_backed"])
            user = store.get_user(cred["user_id"])
            if user:
                info["display_name"] = user["display_name"]
                info["avatar"] = user.get("avatar")

    dev = manifest.get_assertion("trustlayer.device")
    if dev and not info.get("device_label"):
        info["device_label"] = dev.data.get("label")

    return info
