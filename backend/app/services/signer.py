"""
Signer service — wysoki poziom: tworzy manifest, dodaje wszystkie asercje,
podpisuje ECDSA (lub czeka na WebAuthn assertion) i zapisuje do store.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from ..core import crypto, soft_binding, section_a7, store
from ..core.behavior import KeystrokeStats, analyze_keystrokes
from ..core.manifest import Manifest, Signature


@dataclass
class SignedText:
    manifest: Manifest
    plain_text: str
    embedded_text: str          # tekst z osadzonymi VS-ami (Section A.7)
    hard_hash: str
    soft_hash: str


@dataclass
class SignedImage:
    manifest: Manifest
    hard_hash: str
    soft_hash: str
    mime: str
    bytes_b64: str              # oryginał, base64


# ---------- Tekst ----------

def sign_text(
    text: str,
    user_id: str,
    credential_id: str,
    public_key_b64: str,
    server_keypair: crypto.KeyPair | None = None,
    keystroke_events: list[dict] | None = None,
    declared_ai: bool = False,
    device_label: str = "",
) -> SignedText:
    """
    Tworzy podpisany manifest dla tekstu.

    Tryb 1: server_keypair=podany -> serwer podpisuje (demo bez WebAuthn).
    Tryb 2: server_keypair=None -> manifest wraca niepodpisany; frontend dosypie
            podpis WebAuthn i wyśle z powrotem do /api/sign/finalize.
    """
    m = Manifest.new()

    # 1. Hard binding — SHA-256 nad surowym tekstem
    hard_hash = crypto.sha256_hex(text)
    m.add_assertion("c2pa.hash.data", {
        "alg": "sha256",
        "hash": hard_hash,
        "exclusions": [],  # nie wykluczamy nic — pełny tekst
    })

    # 2. Soft binding — SimHash, żeby przeżył parafrazę
    sh = soft_binding.simhash_hex(text)
    m.add_assertion("c2pa.hash.soft", {
        "alg": "simhash64",
        "hash": sh,
        "tokenizer": "ngram3-words",
    })

    # 3. Author + device
    m.add_assertion("c2pa.author", {
        "identifier": user_id,
        "credential_id": credential_id,
        "public_key": public_key_b64,
        "claim_type": "self_attested",
    })

    if device_label:
        m.add_assertion("trustlayer.device", {
            "label": device_label,
            "hardware_backed": True,  # WebAuthn lub demo
        })

    # 4. Behawior — jeśli mamy keystrokes
    if keystroke_events:
        stats = analyze_keystrokes(keystroke_events)
        m.add_assertion("trustlayer.behavior", stats.to_assertion_data())

    # 5. AI flag (deklarowane)
    if declared_ai:
        m.add_assertion("c2pa.training_mining", {
            "digital_source_type": "trainedAlgorithmicMedia",
            "declared_by": "user",
        })

    # 6. Build claim + sign
    claim = m.build_claim(signing_credential_id=credential_id)
    if server_keypair:
        sig_value = server_keypair.sign(claim.to_canonical_bytes())
        m.signature = Signature(
            algorithm="ES256",
            value=sig_value,
            public_key=server_keypair.public_key_b64(),
            credential_id=credential_id,
        )

    # 7. Embed metadata in text via Section A.7 (jeśli sig już jest)
    embedded = text
    if m.signature:
        # Osadzamy tylko id + sig (bez full payload — żeby tekst nie spuchł)
        embedded = section_a7.embed(text, {
            "v": "tl/0.1",
            "mid": claim.instance_id,
            "sig": m.signature.value[:64],  # truncated dla rozmiaru
            "ph": sh,
        })

    # 8. Store
    if m.signature:
        store.store_manifest(
            m, user_id=user_id, content_kind="text",
            hard_hash=hard_hash, soft_hash=sh, soft_hash_kind="simhash64",
        )

    return SignedText(
        manifest=m, plain_text=text, embedded_text=embedded,
        hard_hash=hard_hash, soft_hash=sh,
    )


# ---------- Obraz ----------

def sign_image(
    image_bytes: bytes,
    mime: str,
    user_id: str,
    credential_id: str,
    public_key_b64: str,
    server_keypair: crypto.KeyPair | None = None,
    declared_ai: bool = False,
    device_label: str = "",
    capture_time_ms: int | None = None,
    location: dict | None = None,
) -> SignedImage:
    """Tworzy podpisany manifest dla obrazu. Hard-binds na SHA-256 całego pliku."""
    import base64

    m = Manifest.new()

    hard_hash = crypto.sha256_hex(image_bytes)
    m.add_assertion("c2pa.hash.data", {
        "alg": "sha256",
        "hash": hard_hash,
        "format": mime,
    })

    ph = soft_binding.phash(image_bytes)
    m.add_assertion("c2pa.hash.soft", {
        "alg": "phash64",
        "hash": ph,
    })

    m.add_assertion("c2pa.author", {
        "identifier": user_id,
        "credential_id": credential_id,
        "public_key": public_key_b64,
        "claim_type": "self_attested",
    })

    actions = [{"action": "c2pa.created", "when": capture_time_ms or int(time.time() * 1000)}]
    m.add_assertion("c2pa.actions", {"actions": actions})

    if device_label:
        m.add_assertion("trustlayer.device", {
            "label": device_label,
            "hardware_backed": True,
        })

    if location:
        m.add_assertion("c2pa.location", location)

    if declared_ai:
        m.add_assertion("c2pa.training_mining", {
            "digital_source_type": "trainedAlgorithmicMedia",
            "declared_by": "user",
        })

    claim = m.build_claim(signing_credential_id=credential_id)
    if server_keypair:
        sig_value = server_keypair.sign(claim.to_canonical_bytes())
        m.signature = Signature(
            algorithm="ES256",
            value=sig_value,
            public_key=server_keypair.public_key_b64(),
            credential_id=credential_id,
        )

    if m.signature:
        store.store_manifest(
            m, user_id=user_id, content_kind="image",
            hard_hash=hard_hash, soft_hash=ph, soft_hash_kind="phash64",
        )

    return SignedImage(
        manifest=m, hard_hash=hard_hash, soft_hash=ph,
        mime=mime, bytes_b64=base64.b64encode(image_bytes).decode(),
    )
