"""
TrustLayer Manifest — C2PA-inspired struktura proweniencji.

Manifest składa się z:
  1. Asercji (assertions) — fakty o treści (autor, narzędzia, timestamp, AI flag, soft binding hashes)
  2. Roszczenia (claim) — agregacja asercji + ich hashy
  3. Podpisu (signature) — ECDSA P-256 nad roszczeniem (klucz z WebAuthn)

Spec referencyjny: C2PA 2.3 (https://spec.c2pa.org). Tutaj uproszczone do JSON
zamiast JUMBF/CBOR — w 24h nie ma czasu na binarne formaty kontenerów.
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Literal


# ---------- Asercje ----------

AssertionLabel = Literal[
    "c2pa.actions",            # historia operacji (created, edited, ai_generated)
    "c2pa.hash.data",          # hard binding — hash treści
    "c2pa.hash.soft",          # soft binding — SimHash / pHash
    "c2pa.author",             # tożsamość autora (pseudo lub WebAuthn credential)
    "c2pa.training_mining",    # czy treść powstała z udziałem AI
    "trustlayer.behavior",     # behavioral attestation (keystroke dynamics digest)
    "trustlayer.device",       # informacje o urządzeniu (model, OS — opcjonalnie)
]


@dataclass
class Assertion:
    """Pojedyncze twierdzenie o treści. Każde ma label + dane + własny hash."""
    label: str
    data: dict[str, Any]

    def hash(self) -> str:
        """SHA-256 nad kanonizowaną reprezentacją."""
        canonical = json.dumps(self.data, sort_keys=True, separators=(",", ":"))
        payload = f"{self.label}|{canonical}".encode()
        return hashlib.sha256(payload).hexdigest()

    def to_dict(self) -> dict[str, Any]:
        return {"label": self.label, "data": self.data, "hash": self.hash()}


# ---------- Roszczenie + podpis ----------

@dataclass
class Claim:
    """Roszczenie wiąże wszystkie asercje w jedną strukturę do podpisania."""
    claim_generator: str           # np. "TrustLayer/0.1 (Hackathon Demo)"
    instance_id: str               # unikalny ID tej instancji manifestu
    timestamp: int                 # unix epoch ms
    assertion_hashes: list[dict[str, str]]  # [{"label": ..., "hash": ...}]
    signing_credential_id: str     # ID klucza publicznego (WebAuthn credentialId)

    def to_canonical_bytes(self) -> bytes:
        """Stabilna reprezentacja do podpisu."""
        payload = {
            "claim_generator": self.claim_generator,
            "instance_id": self.instance_id,
            "timestamp": self.timestamp,
            "assertion_hashes": sorted(
                self.assertion_hashes, key=lambda x: x["label"]
            ),
            "signing_credential_id": self.signing_credential_id,
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


@dataclass
class Signature:
    """Podpis ECDSA P-256 (lub WebAuthn assertion) nad claim."""
    algorithm: str                 # np. "ES256" (ECDSA P-256 + SHA-256)
    value: str                     # base64url
    public_key: str                # base64url SPKI lub COSE key z WebAuthn
    credential_id: str             # WebAuthn credentialId


@dataclass
class Manifest:
    """Pełny manifest — to co podróżuje z treścią (lub leży w Manifest Store)."""
    version: str = "trustlayer/0.1"
    assertions: list[Assertion] = field(default_factory=list)
    claim: Claim | None = None
    signature: Signature | None = None
    parent_manifest_id: str | None = None  # chain of custody (edycje)

    @classmethod
    def new(cls, claim_generator: str = "TrustLayer/0.1") -> "Manifest":
        return cls()

    def add_assertion(self, label: str, data: dict[str, Any]) -> Assertion:
        a = Assertion(label=label, data=data)
        self.assertions.append(a)
        return a

    def build_claim(self, signing_credential_id: str,
                    claim_generator: str = "TrustLayer/0.1 (Hackathon Demo)") -> Claim:
        self.claim = Claim(
            claim_generator=claim_generator,
            instance_id=f"urn:uuid:{uuid.uuid4()}",
            timestamp=int(time.time() * 1000),
            assertion_hashes=[
                {"label": a.label, "hash": a.hash()} for a in self.assertions
            ],
            signing_credential_id=signing_credential_id,
        )
        return self.claim

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "assertions": [a.to_dict() for a in self.assertions],
            "claim": asdict(self.claim) if self.claim else None,
            "signature": asdict(self.signature) if self.signature else None,
            "parent_manifest_id": self.parent_manifest_id,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Manifest":
        m = cls(version=d.get("version", "trustlayer/0.1"))
        m.assertions = [Assertion(label=a["label"], data=a["data"])
                        for a in d.get("assertions", [])]
        if d.get("claim"):
            m.claim = Claim(**d["claim"])
        if d.get("signature"):
            m.signature = Signature(**d["signature"])
        m.parent_manifest_id = d.get("parent_manifest_id")
        return m

    # --- pomocnicze gettery dla weryfikacji ---

    def get_assertion(self, label: str) -> Assertion | None:
        for a in self.assertions:
            if a.label == label:
                return a
        return None

    def hard_hash(self) -> str | None:
        a = self.get_assertion("c2pa.hash.data")
        return a.data.get("hash") if a else None

    def soft_hash(self) -> dict[str, Any] | None:
        a = self.get_assertion("c2pa.hash.soft")
        return a.data if a else None

    def is_ai_generated(self) -> bool:
        a = self.get_assertion("c2pa.training_mining")
        return bool(a and a.data.get("digital_source_type") in {
            "trainedAlgorithmicMedia",
            "compositeWithTrainedAlgorithmicMedia",
        })
