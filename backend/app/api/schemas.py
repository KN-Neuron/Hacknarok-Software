"""Schematy żądań i odpowiedzi API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ---------- Users / Credentials ----------

class RegisterUserReq(BaseModel):
    user_id: str
    display_name: str
    avatar: str | None = None


class RegisterCredentialReq(BaseModel):
    user_id: str
    credential_id: str | None = None         # opcjonalne — generujemy jeśli brak
    public_key_b64: str | None = None        # gdy frontend WebAuthn
    device_label: str = ""
    is_hardware_backed: bool = False
    generate_keypair: bool = False           # demo mode: serwer generuje parę


class CredentialOut(BaseModel):
    credential_id: str
    user_id: str
    device_label: str
    is_hardware_backed: bool
    public_key: str
    private_key_pkcs8_b64: str | None = None  # tylko przy demo generate


# ---------- Sign Text ----------

class KeystrokeEvent(BaseModel):
    t: int                                     # ms timestamp
    type: str                                  # "down" | "up"


class SignTextReq(BaseModel):
    text: str
    user_id: str
    credential_id: str
    declared_ai: bool = False
    keystrokes: list[KeystrokeEvent] = Field(default_factory=list)
    use_server_key: bool = True                # demo: serwer ma demo keypair


class SignedTextOut(BaseModel):
    manifest_id: str
    plain_text: str
    embedded_text: str
    hard_hash: str
    soft_hash: str
    manifest: dict[str, Any]


# ---------- Sign Image ----------

class SignImageReq(BaseModel):
    image_b64: str
    mime: str = "image/jpeg"
    user_id: str
    credential_id: str
    declared_ai: bool = False
    use_server_key: bool = True


class SignedImageOut(BaseModel):
    manifest_id: str
    hard_hash: str
    soft_hash: str
    mime: str
    image_b64: str
    manifest: dict[str, Any]


# ---------- Verify Text ----------

class VerifyTextReq(BaseModel):
    text: str
    keystrokes: list[KeystrokeEvent] = Field(default_factory=list)
    ai_text_score: float | None = None         # opcjonalny: gdy frontend ma klasyfikator


class VerifyImageReq(BaseModel):
    image_b64: str
    declared_real_person_id: str | None = None
    synthid_detected: bool = False
    ai_artifact_score: float | None = None


class VerificationOut(BaseModel):
    status: str
    manifest: dict[str, Any] | None = None
    soft_match_distance: int | None = None
    signature_valid: bool | None = None
    hard_hash_match: bool | None = None
    clash: dict[str, Any] | None = None
    author: dict[str, Any] | None = None
    summary: str
    badges: list[str]
    details: dict[str, Any]


# ---------- Demo ----------

class DemoMessage(BaseModel):
    id: str
    chat_id: str
    sender: str
    text: str
    timestamp: int
    has_manifest: bool
    is_scam: bool = False
    scenario: str | None = None
    verification: VerificationOut | None = None


class DemoChat(BaseModel):
    id: str
    name: str
    avatar: str
    last_message: str
    last_timestamp: int
    unread: int = 0
    is_trusted_contact: bool = False
    trusted_credential_id: str | None = None


class DemoListing(BaseModel):
    id: str
    title: str
    price: str
    location: str
    description: str
    seller: str
    images_b64: list[str]
    has_manifest: bool
    scenario: str | None = None
    verification: VerificationOut | None = None


class DemoPhoto(BaseModel):
    id: str
    title: str
    image_b64: str
    has_manifest: bool
    is_deepfake: bool = False
    scenario: str | None = None
    verification: VerificationOut | None = None
