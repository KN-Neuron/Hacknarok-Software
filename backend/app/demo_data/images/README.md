# Demo images — galeria Personal Alibi

Seed (`backend/app/seed.py → _seed_gallery`) ładuje pliki z tego folderu.
Obsługiwane rozszerzenia: `.jpg`, `.jpeg`, `.png`, `.webp`.

## Wymagane nazwy plików

| Plik                | Scenariusz                           | Rola w demo                |
|---------------------|--------------------------------------|----------------------------|
| `wakacje.*`         | "Anna na wakacjach" (plaża, zachód)  | autentyczne ✅             |
| `przyjaciele.*`     | "Anna z przyjaciółmi" (grupa)        | autentyczne ✅             |
| `kawiarnia.*`       | "Anna selfie kawiarnia"              | autentyczne ✅             |
| `uczelnia.*`        | "Anna na uczelni" (campus, laptop)   | autentyczne ✅             |
| `portret.*`         | "Anna portret" (wnętrze, okno)       | autentyczne ✅             |
| `astronauta.*`      | **Deepfake** — "Anna jako astronautka" | podróbka 🚩 (Personal Alibi mismatch) |

## Jak dodać

1. Skopiuj 6 plików z tego notebooka (albo z własnego generatora AI) do tego folderu,
   nazywając je jak w tabeli powyżej.
2. Zresetuj stan demo:

   ```bash
   rm backend/app/demo_data/demo_state.json
   ```

   Albo uderz w endpoint `/api/demo/reset` (jeśli jest).
3. Uruchom backend — przy pierwszym starcie `seed_all()` wczyta nowe zdjęcia.
4. Odśwież `/gallery` we frontendzie.

## Fallback

Jeśli któregoś pliku brakuje, seed wygeneruje placeholder z kolorowymi kropkami
(tak jak poprzednio) — nic się nie wysypuje.

## Downsizing

Obrazki > 1280px na dłuższym boku są automatycznie skalowane przez PIL
(JPEG quality 85) żeby base64 nie rozdymał `demo_state.json`.
