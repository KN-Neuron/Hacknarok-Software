# TrustLayer

> **Cyfrowa warstwa autentyczności dla wiadomości, ogłoszeń i mediów społecznościowych.**
> C2PA + behawioralna atestacja procesu + percepcyjne hashowanie + Integrity Clash detection.
> Prawda przeżywa screenshot, copy-paste i strip-metadata.

Projekt hackathonowy. Temat: **Dekada innowacji — zbuduj fundamenty nowej ery w otaczającej nas rzeczywistości**.

---

## Problem

Od sierpnia 2026 EU AI Act Art. 50 wymaga oznaczania treści generatywnych. Ale prawo to tylko ramka — nie daje narzędzi:

- **Babcia + BLIK**: oszust przejmuje numer mamy na WhatsAppie. "Synu, miałam wypadek, wyślij 5000 zł". Nie ma sposobu, by odbiorca zweryfikował, że to faktycznie urządzenie mamy.
- **Deepfake porn**: ofiara nie ma sposobu, by udowodnić "to nie ja". Słowo przeciw słowu.
- **Scam OLX**: ogłoszenia z AI-generated zdjęciami "mieszkania" zalewają serwisy. Brak warstwy detekcji niespójności.

C2PA jako standard rozwiązuje część problemów, ale: (1) metadane są wycinane przez platformy, (2) tekst sie nie da klasycznie podpisać, (3) sam podpis nie wykrywa AI.

## Rozwiązanie — TrustLayer

Trzy warstwy weryfikacji w jednym manifeście:

1. **Hard binding** (klasyczny C2PA) — kryptograficzny podpis treści przez WebAuthn (Touch ID / Windows Hello / Android fingerprint). Klucz prywatny nigdy nie opuszcza secure enclave urządzenia.
2. **Soft binding** — SimHash dla tekstu, pHash dla obrazów. Manifest da się odzyskać z chmury nawet po screenshocie / przepisaniu / kompresji.
3. **Behavioral attestation (ZK-PoP lite)** — dynamika pisania (interwały klawiszy) jako dowód, że tekst napisał człowiek, nie LLM.

Plus: **Integrity Clash detection** — wykrycie sprzeczności typu "manifest mówi człowiek, ale klasyfikator AI wykrywa generację".

## Stack

- **Backend**: FastAPI + PostgreSQL (Manifest Store + key registry)
- **Frontend**: Next.js 15 (App Router) + Tailwind + Motion
- **Crypto**: WebAuthn (natywne) + WebCrypto dla hashowania
- **Soft binding**: Datasketch (SimHash), ImageHash (pHash)
- **C2PA**: własna implementacja oparta o spec 2.3 (manifest = JSON + JUMBF-like envelope, podpis ECDSA P-256)

## Demo scenarios

1. **Babcia + BLIK** (komunikator) — wiadomość scam vs wiadomość z prawdziwego urządzenia
2. **Personal Alibi** (galeria) — porównanie deepfake'a z bazą podpisanych zdjęć ofiary
3. **OLX scam** (ogłoszenia) — wykrycie AI-generated zdjęć w ogłoszeniu

## Uruchomienie

```bash
# Backend
cd backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:8000/docs
