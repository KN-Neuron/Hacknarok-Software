"""
Demo seed — generuje dane do 3 scenariuszy:

  1. Babcia + BLIK na "FakeApp" (komunikator)
     - Użytkownik "Anna" (ja, ofiara) ma rozmowę z mamą "Krystyna"
     - Krystyna ma zarejestrowane urządzenie "iPhone 14 (Touch ID)"
     - Wiadomości historyczne podpisane jej kluczem -> VERIFIED
     - Ostatnia "scam" wiadomość bez podpisu (numer sklonowany) -> UNVERIFIED + alert

  2. Personal Alibi (galeria zdjęć)
     - "Anna" ma 5 podpisanych autentycznych zdjęć z "Pixel 9 Pro (Titan M2)"
     - Atakujący publikuje "deepfake" — bez podpisu Anny + ma sygnał AI -> CONFIRMED clash

  3. OLX scam (ogłoszenia)
     - 2 normalne ogłoszenia podpisane przez sprzedawców
     - 1 oszukańcze: zdjęcia AI-generated (synthid_detected=True)
"""

from __future__ import annotations

import base64
import io
import json
import time
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .core import crypto, store
from .services import signer
from .api import sign_router


_DEMO_FILE = Path(__file__).parent / "demo_data" / "demo_state.json"
_DEMO_FILE.parent.mkdir(exist_ok=True)


# ---------- Helpers do generowania placeholder-obrazków ----------

def _make_image(text: str, color: tuple[int, int, int], size=(800, 600)) -> bytes:
    """Generuje proste zdjęcie placeholder z tekstem (zamiast prawdziwych zdjęć w demo)."""
    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
    except OSError:
        font = ImageFont.load_default()

    # Wyśrodkuj tekst
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text(((size[0] - w) // 2, (size[1] - h) // 2), text, fill="white", font=font)

    # Dodaj trochę "noise" żeby pHash nie był identyczny dla różnych zdjęć
    import random
    rng = random.Random(text)
    for _ in range(200):
        x = rng.randint(0, size[0] - 1)
        y = rng.randint(0, size[1] - 1)
        r = rng.randint(0, 30)
        draw.ellipse((x - r, y - r, x + r, y + r),
                     fill=(rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255), 80))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


# ---------- Główny seed ----------

def seed_all() -> dict:
    """Czyści bazę i tworzy wszystkie demo data. Zwraca state do zapisu."""
    store.reset_db()

    state: dict = {
        "users": {},
        "credentials": {},
        "scenarios": {},
    }

    # --- Userzy ---
    users = [
        ("anna", "Anna Kowalska", "👩"),
        ("krystyna", "Mama (Krystyna)", "👵"),
        ("scammer_unknown", "+48 600 123 456", "📱"),
        ("piotr", "Piotr — sprzedawca OLX", "🧔"),
        ("marek", "Marek — sprzedawca OLX", "👨"),
        ("scammer_olx", "MieszkaniaWro2024", "🏠"),
    ]
    for uid, name, av in users:
        store.upsert_user(uid, name, av)
        state["users"][uid] = {"display_name": name, "avatar": av}

    # --- Credentials (z keypairami w pamięci serwera) ---
    cred_specs = [
        ("anna",     "Pixel 9 Pro (Titan M2)",   True),
        ("krystyna", "iPhone 14 (Secure Enclave)", True),
        ("piotr",    "MacBook (Touch ID)",        True),
        ("marek",    "Galaxy S24 (Knox Vault)",   True),
        # scammerzy NIE mają credentials — to jest puenta
    ]
    for uid, label, hw in cred_specs:
        kp = crypto.KeyPair.generate()
        store.register_credential(
            credential_id=kp.credential_id,
            user_id=uid,
            public_key=kp.public_key_b64(),
            device_label=label,
            is_hardware_backed=hw,
        )
        sign_router.register_demo_keypair(kp.credential_id, kp)
        state["credentials"][uid] = {
            "credential_id": kp.credential_id,
            "device_label": label,
            "is_hardware_backed": hw,
        }

    # --- SCENARIO 1: Babcia + BLIK ---
    state["scenarios"]["whatsapp"] = _seed_whatsapp(state)

    # --- SCENARIO 2: Personal Alibi gallery ---
    state["scenarios"]["gallery"] = _seed_gallery(state)

    # --- SCENARIO 3: OLX scam ---
    state["scenarios"]["olx"] = _seed_olx(state)

    with _DEMO_FILE.open("w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

    return state


def _signed_text(text: str, user_id: str, state: dict, behavior_human: bool = True):
    """Tworzy podpisaną wiadomość z syntetycznymi keystroke events."""
    cred = state["credentials"][user_id]
    cred_id = cred["credential_id"]
    cred_full = store.get_credential(cred_id)

    # Syntetyczne keystrokes
    if behavior_human:
        events = _human_keystrokes(text)
    else:
        events = _bot_keystrokes(text)

    out = signer.sign_text(
        text=text,
        user_id=user_id,
        credential_id=cred_id,
        public_key_b64=cred_full["public_key"],
        server_keypair=sign_router._DEMO_KEYS[cred_id],
        keystroke_events=events,
        device_label=cred["device_label"],
    )
    return out


def _human_keystrokes(text: str) -> list[dict]:
    """Symuluje rytm pisania człowieka — z pauzami i burstami."""
    import random
    rng = random.Random(text)
    events = []
    t = 0
    for i, ch in enumerate(text):
        if ch == " " and rng.random() < 0.3:
            t += rng.randint(400, 1200)  # pauza myślenia
        elif ch in ".,?!":
            t += rng.randint(200, 500)
        else:
            # mix burstów (znane sekwencje) i normalnych
            if rng.random() < 0.4:
                t += rng.randint(30, 80)   # burst
            else:
                t += rng.randint(90, 220)  # normalny
        events.append({"t": t, "type": "down"})
        t += rng.randint(20, 60)
        events.append({"t": t, "type": "up"})
    return events


def _bot_keystrokes(text: str) -> list[dict]:
    """Bot: równomierne ~70ms gapy, brak pauz."""
    events = []
    t = 0
    for ch in text:
        events.append({"t": t, "type": "down"})
        t += 30
        events.append({"t": t, "type": "up"})
        t += 40
    return events


# ---------- Scenario 1 ----------

def _seed_whatsapp(state: dict) -> dict:
    """Rozmowa Anna <-> mama Krystyna. Ostatnia wiadomość scammerska."""
    chat_id = "chat_mama"
    now = int(time.time() * 1000)

    messages = []

    # Historia podpisanych wiadomości
    history = [
        ("krystyna", "Cześć kochanie, jak tam u Ciebie?", -3 * 86400_000),
        ("anna",     "Cześć Mamo, w porządku, dużo nauki", -3 * 86400_000 + 600_000),
        ("krystyna", "Pamiętaj o sobie, nie pracuj za dużo", -3 * 86400_000 + 1_200_000),
        ("krystyna", "Robię na obiad rosół, wpadnij w niedzielę?", -2 * 86400_000),
        ("anna",     "Wpadnę na pewno, dziękuję!", -2 * 86400_000 + 300_000),
        ("krystyna", "Tata przesyła pozdrowienia", -1 * 86400_000),
    ]

    for sender, text, offset in history:
        out = _signed_text(text, sender, state)
        messages.append({
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "chat_id": chat_id,
            "sender": sender,
            "text": out.embedded_text,        # z osadzonymi VS!
            "plain_text": out.plain_text,
            "manifest_id": out.manifest.claim.instance_id,
            "timestamp": now + offset,
            "has_manifest": True,
            "is_scam": False,
        })

    # SCAM message: numer "Krystyny" przejęty, wysyła wiadomość bez podpisu
    # (bo scammer nie ma jej klucza prywatnego!)
    scam_text = "Synciu mam wypadek pilnie potrzebuje 5000 zl wyslij blik na 600 123 456 to nie zart"
    messages.append({
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "chat_id": chat_id,
        "sender": "krystyna",  # ← wyświetla się jako Mama (numer sklonowany)
        "text": scam_text,
        "plain_text": scam_text,
        "manifest_id": None,
        "timestamp": now,
        "has_manifest": False,
        "is_scam": True,
        "scenario": "babcia_blik",
    })

    # Druga rozmowa — z nieznanego numeru, też scam
    second_chat_id = "chat_unknown"
    scam2 = "Otrzymales paczke ale brakuje 1.99 PLN doplaty: bit.ly/oplata-paczki"
    messages.append({
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "chat_id": second_chat_id,
        "sender": "scammer_unknown",
        "text": scam2,
        "plain_text": scam2,
        "manifest_id": None,
        "timestamp": now - 30 * 60_000,
        "has_manifest": False,
        "is_scam": True,
        "scenario": "smishing",
    })

    # Trzecia rozmowa — ze sprzedawcą (legit, podpisana)
    third_chat_id = "chat_piotr"
    legit_msgs = [
        ("piotr", "Dzień dobry, mieszkanie nadal dostępne, zapraszam na oglądanie"),
        ("anna",  "Dziękuję, czy mogę jutro o 17?"),
        ("piotr", "Tak, jutro 17:00 pasuje. Adres: ul. Świdnicka 24"),
    ]
    for sender, text in legit_msgs:
        out = _signed_text(text, sender, state)
        messages.append({
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "chat_id": third_chat_id,
            "sender": sender,
            "text": out.embedded_text,
            "plain_text": out.plain_text,
            "manifest_id": out.manifest.claim.instance_id,
            "timestamp": now - 2 * 3600_000,
            "has_manifest": True,
            "is_scam": False,
        })

    chats = [
        {
            "id": chat_id,
            "name": "Mama (Krystyna)",
            "avatar": "👵",
            "user_id": "krystyna",
            "trusted_credential_id": state["credentials"]["krystyna"]["credential_id"],
            "is_trusted_contact": True,
        },
        {
            "id": second_chat_id,
            "name": "+48 600 123 456",
            "avatar": "📱",
            "user_id": "scammer_unknown",
            "trusted_credential_id": None,
            "is_trusted_contact": False,
        },
        {
            "id": third_chat_id,
            "name": "Piotr — sprzedawca OLX",
            "avatar": "🧔",
            "user_id": "piotr",
            "trusted_credential_id": state["credentials"]["piotr"]["credential_id"],
            "is_trusted_contact": False,
        },
    ]

    return {"chats": chats, "messages": messages}


# ---------- Scenario 2: Gallery ----------

def _seed_gallery(state: dict) -> dict:
    """5 podpisanych zdjęć Anny + 1 deepfake."""
    photos = []

    # Autentyczne zdjęcia podpisane Pixel 9 Pro
    real_specs = [
        ("Anna na wakacjach", (88, 130, 180)),
        ("Anna z przyjaciółmi", (200, 100, 100)),
        ("Anna selfie kawiarnia", (150, 90, 70)),
        ("Anna na uczelni", (120, 130, 90)),
        ("Anna portret", (90, 90, 120)),
    ]

    cred = state["credentials"]["anna"]
    cred_full = store.get_credential(cred["credential_id"])

    for title, color in real_specs:
        img_bytes = _make_image(title, color)
        out = signer.sign_image(
            image_bytes=img_bytes, mime="image/jpeg",
            user_id="anna",
            credential_id=cred["credential_id"],
            public_key_b64=cred_full["public_key"],
            server_keypair=sign_router._DEMO_KEYS[cred["credential_id"]],
            device_label=cred["device_label"],
        )
        photos.append({
            "id": f"photo_{uuid.uuid4().hex[:8]}",
            "title": title,
            "image_b64": out.bytes_b64,
            "manifest_id": out.manifest.claim.instance_id,
            "has_manifest": True,
            "is_deepfake": False,
        })

    # Deepfake — bez podpisu Anny, z sygnałem SynthID
    fake_bytes = _make_image("[FAKE] AI-generated", (60, 30, 30))
    photos.append({
        "id": "photo_deepfake_001",
        "title": "Rzekome zdjęcie 'Anny' — opublikowane przez nieznane konto",
        "image_b64": _b64(fake_bytes),
        "manifest_id": None,
        "has_manifest": False,
        "is_deepfake": True,
        "scenario": "personal_alibi",
        # te flagi frontend prześle do verify endpoint:
        "synthid_detected": True,
        "ai_artifact_score": 0.92,
        "declared_real_person_id": "anna",
    })

    return {"photos": photos}


# ---------- Scenario 3: OLX ----------

def _seed_olx(state: dict) -> dict:
    """3 ogłoszenia: 2 legit, 1 scam."""
    listings = []

    # Legit 1 — Piotr
    cred_p = state["credentials"]["piotr"]
    cred_p_full = store.get_credential(cred_p["credential_id"])
    legit1_imgs = []
    for i, color in enumerate([(150, 130, 110), (140, 120, 100), (160, 140, 120)]):
        img = _make_image(f"Mieszkanie 1 — zdj {i+1}", color)
        out = signer.sign_image(
            image_bytes=img, mime="image/jpeg",
            user_id="piotr",
            credential_id=cred_p["credential_id"],
            public_key_b64=cred_p_full["public_key"],
            server_keypair=sign_router._DEMO_KEYS[cred_p["credential_id"]],
            device_label=cred_p["device_label"],
        )
        legit1_imgs.append(out.bytes_b64)

    listings.append({
        "id": "listing_001",
        "title": "Kawalerka 32m² Świdnicka, Wrocław Centrum",
        "price": "2 400 zł / mies",
        "location": "Wrocław, Stare Miasto",
        "description": "Słoneczna kawalerka po remoncie. Blisko Rynku, do mojej dyspozycji od 1 maja.",
        "seller": "piotr",
        "seller_name": "Piotr",
        "images_b64": legit1_imgs,
        "has_manifest": True,
    })

    # Legit 2 — Marek
    cred_m = state["credentials"]["marek"]
    cred_m_full = store.get_credential(cred_m["credential_id"])
    legit2_imgs = []
    for i, color in enumerate([(180, 160, 130), (170, 150, 120)]):
        img = _make_image(f"Mieszkanie 2 — zdj {i+1}", color)
        out = signer.sign_image(
            image_bytes=img, mime="image/jpeg",
            user_id="marek",
            credential_id=cred_m["credential_id"],
            public_key_b64=cred_m_full["public_key"],
            server_keypair=sign_router._DEMO_KEYS[cred_m["credential_id"]],
            device_label=cred_m["device_label"],
        )
        legit2_imgs.append(out.bytes_b64)

    listings.append({
        "id": "listing_002",
        "title": "2-pok 48m² Krzyki, balkon, garaż",
        "price": "3 100 zł / mies",
        "location": "Wrocław, Krzyki",
        "description": "Mieszkanie 2-pokojowe na II piętrze. Garaż w cenie.",
        "seller": "marek",
        "seller_name": "Marek",
        "images_b64": legit2_imgs,
        "has_manifest": True,
    })

    # Scam — AI-generated bez podpisu, podejrzanie tania cena
    scam_imgs = []
    for i, color in enumerate([(100, 50, 130), (110, 60, 140), (120, 70, 150)]):
        img = _make_image(f"[AI-GEN] Mieszkanie {i+1}", color)
        scam_imgs.append(_b64(img))

    listings.append({
        "id": "listing_003_scam",
        "title": "Luksusowe mieszkanie 60m² Centrum — okazja!!! ",
        "price": "800 zł / mies",
        "location": "Wrocław, Rynek",
        "description": "Pilnie wynajme luksusowe mieszkanie. Wpłata zadatku 500zł na konto, "
                       "potem klucze. Nie odbieram telefonu, tylko wiadomości.",
        "seller": "scammer_olx",
        "seller_name": "MieszkaniaWro2024",
        "images_b64": scam_imgs,
        "has_manifest": False,
        "scenario": "olx_ai_scam",
        # Frontend prześle do verify_image:
        "synthid_detected": True,
        "ai_artifact_score": 0.88,
    })

    return {"listings": listings}


def load_demo_state() -> dict | None:
    """Zwraca już zseedowany state, jeśli istnieje."""
    if _DEMO_FILE.exists():
        try:
            return json.loads(_DEMO_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
    return None
