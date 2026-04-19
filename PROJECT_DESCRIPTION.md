# TrustLayer — warstwa zaufania dla treści w internecie

## Czym jest TrustLayer

TrustLayer to demonstracja, jak powinna wyglądać następna warstwa internetu:
warstwa, w której każda treść — zdjęcie, wiadomość, ogłoszenie, post — ma
matematycznie weryfikowalne pochodzenie. Nie wierzysz na słowo. Nie ufasz
„niebieskiej fajce". Sprawdzasz pieczęć kryptograficzną, którą zostawia
urządzenie autora w momencie zrobienia treści, i ścieżkę edycji, która jest do
niej dopisywana przy każdej zmianie.

Projekt łączy trzy zupełnie nowe pomysły z istniejącym, otwartym standardem
**C2PA** (Coalition for Content Provenance and Authenticity, przyjętym już przez
Adobe, BBC, Microsoft, Sony, Nikon, OpenAI i inne):

1. **Personal Alibi** — Twoje urządzenie podpisuje treści sprzętowym kluczem
   (Titan, Secure Enclave). Brak podpisu Twojego klucza pod zdjęciem, które
   rzekomo Cię przedstawia, jest matematycznym dowodem, że to nie Ty.
2. **Cross-checking sygnałów** — TrustLayer nie patrzy na jeden flag. Patrzy na
   spójność: podpis ↔ hash ↔ SynthID ↔ deklaracja AI ↔ Personal Alibi. Konflikt
   nawet dwóch z nich wystarczy, żeby zapalić ostrzeżenie.
3. **Behavioralna sygnatura tekstu** — to samo dla wiadomości tekstowych:
   rytm pisania (timing keystroków) jest też podpisem. Bot piszący w tempie
   maszynowym nie udaje człowieka.

## Dlaczego to ważne — wiele płaszczyzn

### Dla zwykłych ludzi

W 2026 każdy ma w kieszeni telefon, który potrafi wygenerować dowolne zdjęcie
dowolnej osoby. Każdy. Nie tylko studio Hollywood. Konsekwencje:

- **Deepfake jako narzędzie nękania.** Według ONS i Internet Watch Foundation,
  98% deepfake'ów online to NCII (Non-Consensual Intimate Imagery), a 99% ofiar
  to kobiety. TrustLayer daje ofiarom narzędzie: „to nie pochodzi z mojego
  urządzenia, mam na to dowód matematyczny" — bez konieczności udowadniania
  swojej niewinności. Zmienia ciężar dowodu.
- **Scam, w którym oszust udaje znajomego.** Ten sam mechanizm działa, gdy ktoś
  podszywa się pod brata na WhatsAppie z prośbą o BLIK. Zaufany kontakt = znany
  klucz. Brak klucza pod wiadomością = ostrzeżenie, zanim klikniesz „wyślij".
- **OLX, Vinted, Allegro.** Ogłoszenia z idealnie wygenerowanymi zdjęciami
  mieszkań, których nigdy nie istniały, to dziś masowe oszustwo. TrustLayer
  pokazuje od razu: te zdjęcia mają SynthID, te nie. Te są podpisane przez
  prawdziwy aparat, te są wyrenderowane.

### Dla dziennikarstwa i informacji publicznej

Adobe, Reuters, BBC, AP, New York Times — wszyscy podpisali się pod C2PA, bo
mają konkretny problem: **nie da się dziś odróżnić zdjęcia z frontu w Ukrainie
od renderu z Midjourney**, jeśli nie patrzysz na metadane. TrustLayer to
pokazuje na poziomie czytelnika: jeśli post na X mówi „ekskluzywnie!" o czymś,
co naprawdę miało miejsce, redakcja podpisuje swoją treść i to widać. Jeśli
podszywa się pod redakcję — natychmiast widać, że to konto z trzech dni i bez
żadnego podpisu.

### Dla wymiaru sprawiedliwości

W procesach o oszustwo, znęcanie cyfrowe, podszywanie się — sąd dziś polega na
opinii biegłego informatyka. TrustLayer dostarcza **dowód cyfrowy**, który
spełnia wymogi UK Online Safety Act i EU Digital Services Act: trzy niezależne
sygnały negatywne (brak podpisu + watermark AI + klasyfikator artefaktów) są
łańcuchem, który da się przedłożyć w sądzie. Raport generuje się sam.

### Dla platform społecznościowych

Każda platforma — Meta, X, TikTok — ma dziś trzy złe opcje:
1. Ręcznie moderować (drogo, nie skaluje się, traumatyzuje moderatorów).
2. Polegać na klasyfikatorach AI (false positive zabijają ekspresję, false
   negative przepuszczają patologię).
3. Nic nie robić (regulator karze).

C2PA + TrustLayer dają opcję czwartą: **przerzucenie ciężaru na pochodzenie
treści**. Treść z manifestem od zaufanego urządzenia ma niski threshold
moderacji. Treść anonimowa, niepodpisana, z konfliktem cross-check — wysoki.
To skaluje się do miliarda postów dziennie, bo całą weryfikację robi
kryptografia, a moderator widzi tylko spójny raport.

### Dla AI

Najbardziej kontrowersyjna implikacja. Modele generatywne **mogą i powinny
podpisywać swoje wytwory**. Adobe Firefly już to robi. OpenAI deklaruje
SynthID-text na ChatGPT. W TrustLayer pokazujemy, że to nie jest zagrożenie dla
twórców AI — wręcz przeciwnie. Świat, w którym AI deklaruje swoją obecność, to
świat, w którym AI **może być profesjonalnym narzędziem**, a nie podejrzanym
obywatelem drugiej kategorii. Post Jakuba Nowaka z naszej galerii (AI-art z
Firefly, podpisany, z manifestem) jest legalny i zaufany. Post „RealNews"
udający redakcję z deepfake'em — nie. Tę linię trzeba narysować, żeby AI w
ogóle miało szansę współistnieć z autentyczną treścią.

### Dla społeczeństwa jako całości

Internet ostatnich 30 lat działał na **domyślnym zaufaniu**: wierzymy, że post
od @anna.kow naprawdę napisała Anna; wierzymy, że zdjęcie z aparatu naprawdę
zostało zrobione tam, gdzie podpis. Ten domyślny model umiera, bo generatywne
AI wyzeruje koszt produkcji fałszerstwa.

Mamy dwa wyjścia:
- **Powrót do gatekeeperów.** Tylko zweryfikowane konta na zweryfikowanych
  platformach. Centralizacja, kontrola, koniec wolnego internetu.
- **Provenance jako protokół.** Każdy może publikować cokolwiek, ale każdy
  odbiorca widzi, czy to ma pieczęć. Decentralizacja, otwarty standard, brak
  bramkarza.

C2PA + TrustLayer to ścieżka druga. Dlatego ten projekt jest „przyszłością
internetu" — nie dlatego, że to jakaś nowa technologia, tylko dlatego, że jest
**jedyną alternatywą dla cenzury**, gdy autentyczność przestaje być domyślna.

## Co odróżnia TrustLayer

Większość rozwiązań „walka z deepfake" próbuje **wykryć fałsz**. Klasyfikator
patrzy na piksele, mówi „to AI z 87% pewnością". Problem: za pół roku
klasyfikator nie nadąża, fałszerz znajdzie sposób.

TrustLayer odwraca pytanie: **udowodnij autentyczność, nie wykrywaj fałszu**.
Nie liczy się, czy klasyfikator dziś jeszcze działa. Liczy się, czy treść ma
ważny podpis kluczem, którego nikt nie potrafi odtworzyć. To matematyka
asymetryczna. To nie wyścig zbrojeń.

Dodatkowo Personal Alibi rozwiązuje case, którego nie rozwiąże żaden inny
system: **co zrobić, kiedy ktoś tworzy deepfake mnie?** Klasyk: „nie da się
udowodnić nieistnienia". W świecie z Personal Alibi się da. „Jeśli to byłaby
ja, miałaby podpis mojego urządzenia. Nie ma. QED."

## Stack demonstracji

Nie jest to teoria. To prototyp z czterema scenariuszami end-to-end:

- **Scenariusz 01 — FakeApp.** Komunikator typu WhatsApp, w którym kontakt
  zaufany dostaje podpisane wiadomości, a podszywający się oszust — żółtą
  flagę, mimo że ma to samo zdjęcie profilowe. Plus wykrywanie bota po rytmie
  pisania.
- **Scenariusz 02 — Personal Alibi.** Galeria Anny: pięć autentycznych zdjęć z
  jej Pixela, jeden deepfake. Trzy dowody negatywne wygenerowane do raportu
  zgodnego z UK Online Safety Act.
- **Scenariusz 02b — Cross-checking w social media.** Te same zdjęcia
  reposorowane na Instagramie, X i LinkedIn. Pełne spektrum: verified,
  recovered (manifest odzyskany przez SynthID po stripie metadanych),
  unverified, AI-declared (legalne!), tampered, integrity_clash.
- **Scenariusz 03 — OLX scam.** Trzy ogłoszenia mieszkań. Dwa zwykłe, jedno z
  fotami wygenerowanymi przez AI. TrustLayer mówi od razu które.

Plus rozszerzenie do przeglądarki, które wstrzykuje TrustLayer w Telegram Web —
demonstracja, jak to mogłoby trafić do realnej aplikacji **bez czekania, aż
operator messengera wbuduje C2PA u siebie**.

## Po co to istnieje

Bo żyjemy w pierwszym momencie historii, kiedy „zdjęcie ≠ dowód". I jeszcze
przez kilka lat decydujemy, czy pójdziemy w stronę świata, w którym nie da się
ufać niczemu, czy w stronę świata, w którym można ufać selektywnie, na
podstawie jawnych pieczęci kryptograficznych.

TrustLayer to argument za tym drugim światem.
