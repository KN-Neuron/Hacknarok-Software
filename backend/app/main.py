"""TrustLayer API entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import demo_router, sign_router, users_router, verify_router
from .core import store
from . import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicjalizuje bazę i seeduje demo data przy starcie."""
    store.init_db()

    # Auto-seed jeśli baza pusta
    if not seed.load_demo_state() or not store.list_users():
        print("[TrustLayer] Seeding demo data...")
        seed.seed_all()
        print("[TrustLayer] Demo ready.")
    else:
        # Reseed i tak — żeby keypairy w pamięci procesu się odtworzyły
        print("[TrustLayer] Re-seeding demo data (in-memory keys reset)...")
        seed.seed_all()

    yield


app = FastAPI(
    title="TrustLayer API",
    description="Cyfrowa warstwa autentyczności — C2PA + behavioral attestation + soft binding",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # demo only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router.router)
app.include_router(sign_router.router)
app.include_router(verify_router.router)
app.include_router(demo_router.router)


@app.get("/")
def root():
    return {
        "name": "TrustLayer",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": {
            "users": "/api/users",
            "sign": "/api/sign/{text,image}",
            "verify": "/api/verify/{text,image}",
            "demo": "/api/demo/{whatsapp,gallery,olx}",
        },
    }


@app.get("/api/health")
def health():
    return {"ok": True}
