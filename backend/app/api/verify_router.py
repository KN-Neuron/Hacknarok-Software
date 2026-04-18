"""Verify API — weryfikacja tekstu i obrazów."""

from __future__ import annotations

import base64

from fastapi import APIRouter

from ..services import verifier
from . import schemas

router = APIRouter(prefix="/api/verify", tags=["verify"])


@router.post("/text", response_model=schemas.VerificationOut)
def verify_text(req: schemas.VerifyTextReq):
    keystrokes = [k.model_dump() for k in req.keystrokes] if req.keystrokes else None
    result = verifier.verify_text(
        text=req.text,
        keystroke_events=keystrokes,
        ai_text_score=req.ai_text_score,
    )
    return schemas.VerificationOut(**result.to_dict())


@router.post("/image", response_model=schemas.VerificationOut)
def verify_image(req: schemas.VerifyImageReq):
    image_bytes = base64.b64decode(req.image_b64)
    result = verifier.verify_image(
        image_bytes=image_bytes,
        declared_real_person_id=req.declared_real_person_id,
        synthid_detected=req.synthid_detected,
        ai_artifact_score=req.ai_artifact_score,
    )
    return schemas.VerificationOut(**result.to_dict())
