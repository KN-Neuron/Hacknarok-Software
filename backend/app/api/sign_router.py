"""Sign API — generuje podpisane manifesty dla tekstu i obrazów."""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, HTTPException

from ..core import crypto, store
from ..services import signer
from . import schemas

router = APIRouter(prefix="/api/sign", tags=["sign"])


def _load_keypair_for_credential(credential_id: str) -> crypto.KeyPair | None:
    """Demo-only: trzymamy mapę cred_id -> private key w pamięci procesu."""
    return _DEMO_KEYS.get(credential_id)


_DEMO_KEYS: dict[str, crypto.KeyPair] = {}


def register_demo_keypair(credential_id: str, kp: crypto.KeyPair) -> None:
    _DEMO_KEYS[credential_id] = kp


@router.post("/text", response_model=schemas.SignedTextOut)
def sign_text(req: schemas.SignTextReq):
    cred = store.get_credential(req.credential_id)
    if not cred:
        raise HTTPException(404, f"Credential {req.credential_id} not found")

    server_kp = _load_keypair_for_credential(req.credential_id) if req.use_server_key else None
    if req.use_server_key and not server_kp:
        raise HTTPException(400, "No demo keypair available for this credential")

    keystrokes = [k.model_dump() for k in req.keystrokes]
    out = signer.sign_text(
        text=req.text,
        user_id=req.user_id,
        credential_id=req.credential_id,
        public_key_b64=cred["public_key"],
        server_keypair=server_kp,
        keystroke_events=keystrokes,
        declared_ai=req.declared_ai,
        device_label=cred.get("device_label", ""),
    )

    return schemas.SignedTextOut(
        manifest_id=out.manifest.claim.instance_id,
        plain_text=out.plain_text,
        embedded_text=out.embedded_text,
        hard_hash=out.hard_hash,
        soft_hash=out.soft_hash,
        manifest=out.manifest.to_dict(),
    )


@router.post("/image", response_model=schemas.SignedImageOut)
def sign_image(req: schemas.SignImageReq):
    cred = store.get_credential(req.credential_id)
    if not cred:
        raise HTTPException(404, f"Credential {req.credential_id} not found")

    server_kp = _load_keypair_for_credential(req.credential_id) if req.use_server_key else None
    if req.use_server_key and not server_kp:
        raise HTTPException(400, "No demo keypair available for this credential")

    image_bytes = base64.b64decode(req.image_b64)
    out = signer.sign_image(
        image_bytes=image_bytes,
        mime=req.mime,
        user_id=req.user_id,
        credential_id=req.credential_id,
        public_key_b64=cred["public_key"],
        server_keypair=server_kp,
        declared_ai=req.declared_ai,
        device_label=cred.get("device_label", ""),
    )

    return schemas.SignedImageOut(
        manifest_id=out.manifest.claim.instance_id,
        hard_hash=out.hard_hash,
        soft_hash=out.soft_hash,
        mime=out.mime,
        image_b64=out.bytes_b64,
        manifest=out.manifest.to_dict(),
    )
