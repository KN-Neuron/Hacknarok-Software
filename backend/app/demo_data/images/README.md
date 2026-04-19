# Demo images — wszystkie scenariusze

Seed (`backend/app/seed.py`) ładuje pliki z tego folderu przez `_load_image_file()`.
Obsługiwane rozszerzenia: `.jpg`, `.jpeg`, `.png`, `.webp` (sprawdzane w tej kolejności).

## Scenariusz 2 — Personal Alibi (galeria Anny)

| Plik                | Rola w demo                              |
|---------------------|------------------------------------------|
| `wakacje.*`         | Anna na wakacjach — autentyczne ✅       |
| `przyjaciele.*`     | Anna z przyjaciółmi — autentyczne ✅     |
| `kawiarnia.*`       | Anna selfie kawiarnia — autentyczne ✅   |
| `uczelnia.*`        | Anna na uczelni — autentyczne ✅         |
| `portret.*`         | Anna portret — autentyczne ✅            |
| `astronauta.*`      | **Deepfake** — Anna jako astronautka 🚩  |

## Scenariusz 3 — OLX scam

### Ogłoszenie 1 (Piotr, Kawalerka Świdnicka) — legit ✅

| Plik                | Rola                                 |
|---------------------|--------------------------------------|
| `mieszkanie1_1.*`   | Zdjęcie 1 (główne salon/pokój)       |
| `mieszkanie1_2.*`   | Zdjęcie 2 (kuchnia)                  |
| `mieszkanie1_3.*`   | Zdjęcie 3 (łazienka / widok z okna)  |

### Ogłoszenie 2 (Marek, 2-pok Krzyki) — legit ✅

| Plik                | Rola                                 |
|---------------------|--------------------------------------|
| `mieszkanie2_1.*`   | Zdjęcie 1 (salon z balkonem)         |
| `mieszkanie2_2.*`   | Zdjęcie 2 (sypialnia / kuchnia)      |

### Ogłoszenie 3 (scammer_olx) — scam 🚩 (AI-generated)

| Plik                  | Rola                                          |
|-----------------------|-----------------------------------------------|
| `scam_mieszkanie_1.*` | Zdjęcie "luksusowe" #1 (obviously AI)         |
| `scam_mieszkanie_2.*` | Zdjęcie "luksusowe" #2                        |
| `scam_mieszkanie_3.*` | Zdjęcie "luksusowe" #3                        |

## Jak dodać / podmienić

1. Skopiuj pliki do tego folderu pod nazwami z tabel powyżej.
2. Zresetuj stan demo:
   ```bash
   rm backend/app/demo_data/demo_state.json
   ```
   albo uderz w `POST /api/demo/reset` (jeśli jest w routerze demo).
3. Uruchom backend — przy pierwszym starcie `seed_all()` wczyta nowe zdjęcia.
4. Odśwież `/gallery` lub `/olx` we frontendzie.

## Fallback

Jeśli któregoś pliku brakuje, seed wygeneruje placeholder z kolorowymi kropkami
(tak jak poprzednio) — nic się nie wysypuje. Można więc dodawać obrazki po kolei
i stopniowo wypełniać demo.

## Downsizing

Obrazki > 1280px na dłuższym boku są automatycznie skalowane przez PIL
(JPEG quality 85) żeby base64 nie rozdymał `demo_state.json`.

## Rada narracyjna

Dla maksymalnego efektu sceny:
- **Mieszkanie legit (Piotr / Marek)** — zwykłe, trochę brzydkie, "realne" zdjęcia
  z smartfona: sypialnia z rozłożoną pościelą, widok na blok, przeciętne oświetlenie.
  To buduje kontrast.
- **Mieszkanie scam** — ostentacyjnie "AI look": idealne oświetlenie, perfekcyjna
  perspektywa szerokokątna, meble bez jednej rysy, dziwne proporcje okien, czasem
  drzwi prowadzące do ściany. Publiczność powinna od razu pomyśleć "hmm, to jednak
  wygląda podejrzanie". Wtedy TrustLayer daje im matematyczny dowód że mają rację.
