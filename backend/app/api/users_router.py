"""Users + Credentials API."""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from fastapi import APIRouter, HTTPException

from ..core import crypto, store
from . import schemas

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/register", response_model=dict)
def register_user(req: schemas.RegisterUserReq):
    store.upsert_user(req.user_id, req.display_name, req.avatar)
    return {"ok": True, "user_id": req.user_id}


@router.get("", response_model=list[dict])
def list_users():
    return store.list_users()


@router.get("/{user_id}", response_model=dict)
def get_user(user_id: str):
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    creds = store.list_credentials_for_user(user_id)
    return {**user, "credentials": creds}


@router.post("/credentials", response_model=schemas.CredentialOut)
def register_credential(req: schemas.RegisterCredentialReq):
    """Rejestruje klucz publiczny dla użytkownika.

    Tryby:
      - generate_keypair=True -> serwer generuje ECDSA P-256 (demo)
      - public_key_b64 podany -> normalna rejestracja (np. po WebAuthn attestation)
    """
    if not store.get_user(req.user_id):
        raise HTTPException(404, f"User {req.user_id} not found")

    private_key_pkcs8_b64 = None

    if req.generate_keypair:
        kp = crypto.KeyPair.generate(credential_id=req.credential_id)
        cred_id = kp.credential_id
        public_key = kp.public_key_b64()
        # Eksportujemy klucz prywatny (PKCS#8 DER) — UWAGA: tylko do demo!
        sk_bytes = kp.private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        private_key_pkcs8_b64 = base64.b64encode(sk_bytes).decode()
    elif req.credential_id and req.public_key_b64:
        cred_id = req.credential_id
        public_key = req.public_key_b64
    else:
        raise HTTPException(400, "Either generate_keypair=True or (credential_id+public_key_b64) required")

    store.register_credential(
        credential_id=cred_id,
        user_id=req.user_id,
        public_key=public_key,
        device_label=req.device_label,
        is_hardware_backed=req.is_hardware_backed,
    )

    return schemas.CredentialOut(
        credential_id=cred_id,
        user_id=req.user_id,
        device_label=req.device_label,
        is_hardware_backed=req.is_hardware_backed,
        public_key=public_key,
        private_key_pkcs8_b64=private_key_pkcs8_b64,
    )
