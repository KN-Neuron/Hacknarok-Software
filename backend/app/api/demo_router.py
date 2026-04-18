"""Demo API — zwraca gotowe scenariusze + endpoint do reseed."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import seed

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/reset")
def reset_demo():
    """Czyści bazę i tworzy świeże demo data."""
    state = seed.seed_all()
    return {
        "ok": True,
        "users": list(state["users"].keys()),
        "scenarios": list(state["scenarios"].keys()),
    }


@router.get("/state")
def get_state():
    state = seed.load_demo_state()
    if not state:
        raise HTTPException(404, "Demo not seeded yet — call POST /api/demo/reset")
    return state


@router.get("/whatsapp")
def get_whatsapp():
    state = seed.load_demo_state()
    if not state:
        raise HTTPException(404, "Demo not seeded")
    return state["scenarios"]["whatsapp"]


@router.get("/gallery")
def get_gallery():
    state = seed.load_demo_state()
    if not state:
        raise HTTPException(404, "Demo not seeded")
    return state["scenarios"]["gallery"]


@router.get("/olx")
def get_olx():
    state = seed.load_demo_state()
    if not state:
        raise HTTPException(404, "Demo not seeded")
    return state["scenarios"]["olx"]


@router.get("/olx/{listing_id}")
def get_olx_listing(listing_id: str):
    state = seed.load_demo_state()
    if not state:
        raise HTTPException(404, "Demo not seeded")
    for l in state["scenarios"]["olx"]["listings"]:
        if l["id"] == listing_id:
            return l
    raise HTTPException(404, "Listing not found")
