"""
Operacje kryptograficzne dla TrustLayer.

Dwa tryby:
  1. WebAuthn (production-style) — klucz w secure enclave urządzenia, podpis lokalny
     w przeglądarce, tutaj tylko weryfikacja
  2. Server-side ECDSA P-256 (demo fallback) — gdy WebAuthn nie jest dostępny
     (np. na desktopie bez Touch ID)

Algorytm: ES256 (ECDSA P-256 + SHA-256), ten sam co WebAuthn i C2PA.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
    encode_dss_signature,
)
from cryptography.exceptions import InvalidSignature


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


@dataclass
class KeyPair:
    """Para kluczy ECDSA P-256 do lokalnego podpisywania (demo bez WebAuthn)."""
    private_key: ec.EllipticCurvePrivateKey
    public_key_spki: bytes  # SubjectPublicKeyInfo (DER)
    credential_id: str      # nasz syntetyczny ID

    @classmethod
    def generate(cls, credential_id: str | None = None) -> "KeyPair":
        sk = ec.generate_private_key(ec.SECP256R1())
        pk = sk.public_key()
        spki = pk.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        cred_id = credential_id or b64url_encode(spki[-16:])
        return cls(private_key=sk, public_key_spki=spki, credential_id=cred_id)

    def public_key_b64(self) -> str:
        return b64url_encode(self.public_key_spki)

    def sign(self, data: bytes) -> str:
        """Zwraca podpis w formacie raw r||s (jak WebAuthn), base64url."""
        der_sig = self.private_key.sign(data, ec.ECDSA(hashes.SHA256()))
        r, s = decode_dss_signature(der_sig)
        raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")
        return b64url_encode(raw)


def verify_signature(public_key_b64: str, signature_b64: str, data: bytes) -> bool:
    """Weryfikuje podpis ECDSA P-256 (raw r||s lub DER)."""
    try:
        spki = b64url_decode(public_key_b64)
        pk = serialization.load_der_public_key(spki)
        if not isinstance(pk, ec.EllipticCurvePublicKey):
            return False

        sig = b64url_decode(signature_b64)
        if len(sig) == 64:
            # raw r||s (WebAuthn / nasz format) -> konwersja do DER
            r = int.from_bytes(sig[:32], "big")
            s = int.from_bytes(sig[32:], "big")
            der_sig = encode_dss_signature(r, s)
        else:
            der_sig = sig

        pk.verify(der_sig, data, ec.ECDSA(hashes.SHA256()))
        return True
    except (InvalidSignature, ValueError, Exception):
        return False


def sha256_hex(data: bytes | str) -> str:
    """Hard-binding hash."""
    import hashlib
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()
