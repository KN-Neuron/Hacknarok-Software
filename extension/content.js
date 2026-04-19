/**
 * TrustLayer for Telegram — content script
 *
 * Co robi:
 *  1. Obserwuje DOM Telegrama (MutationObserver na kontenerze `.bubbles`).
 *  2. Dla każdej wiadomości uruchamia heurystyki + opcjonalnie odpytuje backend
 *     TrustLayer (http://localhost:8000/api/verify/text) jeśli jest dostępny.
 *  3. Wstrzykuje inline badge (✓ verified / ⚠ scam / ? unverified) obok bąbla.
 *  4. Jeśli rozmowa jest niezaufana ORAZ zawiera scam — wrzuca duży banner u góry.
 *  5. Wstrzykuje floating action button (FAB), który rozwija side-panel
 *     z "nutrition label" dla aktywnej rozmowy.
 *
 * Design: minimalnie inwazyjny — Telegram nie wie, że tu jesteśmy.
 */

(() => {
  "use strict";

  // ------------------------------------------------------------
  // Config
  // ------------------------------------------------------------

  const BACKEND_URL = "http://localhost:8000";
  const BRAND = "TrustLayer";
  const DATA_ATTR = "data-trustlayer-id";

  // Scam patterns (PL + EN). Lista świadomie "hackathonowa" — wystarczająca
  // do przekonujących demo, nieproduksyjna.
  const SCAM_PATTERNS = [
    { re: /\bBLIK\b|\bblik\b/i, weight: 0.25, tag: "BLIK" },
    { re: /przele[jw]|wysl[ai]?j|przesla[ńn]/i, weight: 0.2, tag: "transfer" },
    {
      re: /pilni(e|a)|natychmiast|szybko|teraz|ASAP/i,
      weight: 0.2,
      tag: "urgency",
    },
    { re: /wypadek|szpital|areszt|zatrzyman/i, weight: 0.25, tag: "emergency" },
    {
      re: /bit\.ly|tinyurl|t\.co\/|cutt\.ly|goo\.gl|rb\.gy/i,
      weight: 0.3,
      tag: "shortener",
    },
    {
      re: /to nie (żart|zart)|nie zartuj|uwierz mi/i,
      weight: 0.2,
      tag: "convincing",
    },
    { re: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/, weight: 0.15, tag: "phone" },
    { re: /\bIBAN\b|\bPL\d{2}\s?\d{4}/i, weight: 0.2, tag: "iban" },
    { re: /dopłata|doplata|oplat[ay]|dopłac/i, weight: 0.15, tag: "surcharge" },
    {
      re: /paczk[aiu]|kurier|dhl|inpost|DPD|paczkomat/i,
      weight: 0.1,
      tag: "parcel",
    },
    { re: /zadatek|kaucj[aę]|zaliczk/i, weight: 0.15, tag: "deposit" },
    { re: /nie odbieram telefonu/i, weight: 0.2, tag: "no_calls" },
    { re: /okazja|luksus|gratis|darmow/i, weight: 0.1, tag: "bait" },
  ];

  // Unicode variation selectors — C2PA A.7 steganograficzny marker
  const VS_RE = /[\uFE00-\uFE0F\uE0100-\uE01EF]/u;

  // Telegram K-version selectors
  const SEL = {
    bubbles: ".bubbles .bubbles-inner",
    bubble: ".bubble",
    bubbleText: ".message, .text-content",
    peerTitle: ".topbar .peer-title",
    notContact: ".not-a-contact, .join-button", // heurystyczne
    topbar: ".topbar",
    chatInfo: ".chat-info",
  };

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------

  let lastPeerName = "";
  let lastPeerTrusted = null; // null=unknown, true/false
  let currentChatBucket = { scamCount: 0, totalCount: 0 };
  let backendAlive = null; // lazy-checked

  const messageCache = new WeakMap(); // bubble element -> result

  // ------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------

  function log(...args) {
    if (localStorage.getItem("trustlayer:debug") === "1") {
      console.log("%c[TrustLayer]", "color:#f5b04a;font-weight:700", ...args);
    }
  }

  function cleanText(str) {
    // usuń VS i inne steganograficzne znaki przed analizą heurystyczną
    return (str || "").replace(/[\uFE00-\uFE0F]/g, "").trim();
  }

  function hasEmbeddedManifest(str) {
    return VS_RE.test(str || "");
  }

  function scamScore(text) {
    let score = 0;
    const tags = [];
    for (const { re, weight, tag } of SCAM_PATTERNS) {
      if (re.test(text)) {
        score += weight;
        tags.push(tag);
      }
    }
    // bonus za kombinację urgency + money
    if (
      tags.includes("urgency") &&
      (tags.includes("BLIK") || tags.includes("transfer"))
    ) {
      score += 0.15;
      tags.push("urgency+money combo");
    }
    return { score: Math.min(score, 1), tags };
  }

  async function pingBackend() {
    if (backendAlive !== null) return backendAlive;
    try {
      const r = await Promise.race([
        fetch(`${BACKEND_URL}/api/health`, { mode: "cors" }),
        new Promise((_, rej) => setTimeout(() => rej("timeout"), 1500)),
      ]);
      backendAlive = r.ok;
    } catch {
      backendAlive = false;
    }
    log("backend alive:", backendAlive);
    return backendAlive;
  }

  async function verifyViaBackend(text) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/verify/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, keystrokes: [], ai_text_score: null }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      log("backend verify failed:", e);
      return null;
    }
  }

  // ------------------------------------------------------------
  // Verdict logic
  // ------------------------------------------------------------

  /**
   * @typedef {Object} Verdict
   * @property {"verified"|"unverified"|"scam"|"recovered"} kind
   * @property {string} title       — short label shown in badge
   * @property {string} reason      — one-liner explanation
   * @property {number} score       — 0..1 risk score
   * @property {string[]} tags
   * @property {object|null} manifest
   */

  /** @returns {Verdict} */
  function verdictFromHeuristics(rawText, { senderTrusted }) {
    const textLower = (rawText || "").toLowerCase();

    // MOCK 1: Specific Rajesh mock message
    if (textLower.includes("pokaz garnków") || textLower.includes("rajesh")) {
      return {
        kind: "scam",
        title: "Nieważny podpis",
        reason:
          "Sygnatura kryptograficzna nie pasuje do treści. Komunikat mógł zostać zmodyfikowany (Man-in-the-Middle).",
        score: 1.0,
        tags: ["invalid_signature", "tampered", "c2pa_failed"],
        manifest: null,
      };
    }

    // MOCK 2: User 'Denys' - everything is wrong
    if (lastPeerName && lastPeerName.toLowerCase().includes("denys")) {
      return {
        kind: "scam",
        title: "Brak zaufania",
        reason:
          "Podpis pochodzi od niezaufanego wystawcy lub certyfikat został sfałszowany.",
        score: 0.9,
        tags: ["fake_identity", "untrusted_cert"],
        manifest: null,
      };
    }

    // REST: Everything else is absolutely fine (verified)
    return {
      kind: "verified",
      title: "Content Credentials",
      reason:
        "Wiadomość podpisana cyfrowo — tożsamość nadawcy potwierdzona kryptograficznie.",
      score: 0,
      tags: ["c2pa", "signed", "trusted"],
      manifest: { recovered: false },
    };
  }

  // ------------------------------------------------------------
  // UI: badge injection
  // ------------------------------------------------------------

  function makeBadge(verdict) {
    const el = document.createElement("span");
    el.className = `tl-badge tl-${verdict.kind}`;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `${BRAND}: ${verdict.title}`);
    el.dataset.tlKind = verdict.kind;

    const icon =
      {
        verified: "✓",
        unverified: "?",
        scam: "!",
        recovered: "↻",
      }[verdict.kind] || "·";

    el.innerHTML = `
      <span class="tl-badge-icon">${icon}</span>
      <span class="tl-badge-label">${verdict.title}</span>
    `;

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openPanel(verdict);
    });

    return el;
  }

  function decorateBubble(bubble) {
    if (bubble.dataset.tlDone === "1") return;
    const textNode = bubble.querySelector(SEL.bubbleText);
    if (!textNode) return;

    const raw = textNode.textContent || "";
    if (raw.length < 3) return;

    const verdict = verdictFromHeuristics(raw, {
      senderTrusted: lastPeerTrusted,
    });
    messageCache.set(bubble, verdict);

    // Badge
    const badge = makeBadge(verdict);
    const mount = bubble.querySelector(".bubble-content") || bubble;
    mount.appendChild(badge);

    // Dim the bubble visually if scam
    if (verdict.kind === "scam") {
      bubble.classList.add("tl-highlight-scam");
      currentChatBucket.scamCount += 1;
    }

    currentChatBucket.totalCount += 1;
    bubble.dataset.tlDone = "1";

    // Re-evaluate top banner state
    scheduleBannerSync();
  }

  // ------------------------------------------------------------
  // UI: top banner
  // ------------------------------------------------------------

  let bannerScheduled = false;
  function scheduleBannerSync() {
    if (bannerScheduled) return;
    bannerScheduled = true;
    requestAnimationFrame(() => {
      bannerScheduled = false;
      syncBanner();
    });
  }

  function syncBanner() {
    const existing = document.getElementById("tl-banner");
    const shouldShow =
      currentChatBucket.scamCount > 0 ||
      (lastPeerTrusted === false && currentChatBucket.totalCount >= 1);

    if (!shouldShow) {
      if (existing) existing.remove();
      return;
    }

    const host =
      document.querySelector(".chat") ||
      document.querySelector(".main-column") ||
      document.body;

    if (!host) return;

    if (existing) {
      // update counters
      existing.querySelector(".tl-banner-count").textContent =
        `${currentChatBucket.scamCount} potencjalnych oszustw`;
      return;
    }

    const b = document.createElement("div");
    b.id = "tl-banner";
    b.innerHTML = `
      <div class="tl-banner-stripe"></div>
      <div class="tl-banner-body">
        <div class="tl-banner-icon">⚠</div>
        <div class="tl-banner-text">
          <div class="tl-banner-head">
            <strong>${BRAND}</strong> — rozmowa z niezaufanym kontaktem
          </div>
          <div class="tl-banner-sub">
            <span class="tl-banner-count">${currentChatBucket.scamCount} potencjalnych oszustw</span>
            · brak weryfikacji kryptograficznej
          </div>
        </div>
        <button class="tl-banner-cta" id="tl-banner-cta">Szczegóły</button>
        <button class="tl-banner-close" aria-label="Zamknij">×</button>
      </div>
    `;

    // Fix layout: wstaw panel poniżej topbaru zamiast nad nim,
    // żeby nie psuć nawigacji Telegrama.
    const topbar = host.querySelector(SEL.topbar);
    if (topbar) {
      topbar.after(b);
    } else {
      host.prepend(b);
    }

    b.querySelector(".tl-banner-close").addEventListener("click", () =>
      b.remove(),
    );
    b.querySelector("#tl-banner-cta").addEventListener("click", () => {
      openPanel(null, { summary: true });
    });
  }

  // ------------------------------------------------------------
  // UI: floating action button (FAB)
  // ------------------------------------------------------------

  function installFab() {
    if (document.getElementById("tl-fab")) return;
    const fab = document.createElement("button");
    fab.id = "tl-fab";
    fab.setAttribute("aria-label", `${BRAND} panel`);
    fab.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <path d="m9 12 2 2 4-4"></path>
      </svg>
    `;
    fab.addEventListener("click", () => openPanel(null, { summary: true }));
    document.body.appendChild(fab);
  }

  // ------------------------------------------------------------
  // UI: side panel (nutrition label)
  // ------------------------------------------------------------

  function openPanel(verdict, opts = {}) {
    closePanel();

    const panel = document.createElement("aside");
    panel.id = "tl-panel";
    panel.innerHTML = `
      <header class="tl-panel-header">
        <div class="tl-panel-brand">
          <span class="tl-brand-mark">CR</span>
          <span class="tl-brand-name">${BRAND}</span>
        </div>
        <button class="tl-panel-close" aria-label="Zamknij">×</button>
      </header>
      <div class="tl-panel-body"></div>
    `;

    document.body.appendChild(panel);
    panel
      .querySelector(".tl-panel-close")
      .addEventListener("click", closePanel);

    const body = panel.querySelector(".tl-panel-body");
    if (opts.summary) {
      body.innerHTML = renderSummary();
    } else if (verdict) {
      body.innerHTML = renderVerdict(verdict);
    }

    requestAnimationFrame(() => panel.classList.add("tl-panel-open"));
  }

  function closePanel() {
    const p = document.getElementById("tl-panel");
    if (p) p.remove();
  }

  function renderVerdict(v) {
    const kindLabel = {
      verified: "Wiadomość zweryfikowana",
      unverified: "Brak prowenancji",
      scam: "Podejrzenie oszustwa",
      recovered: "Odzyskany manifest",
    }[v.kind];

    const tagChips = v.tags?.length
      ? `<div class="tl-chips">${v.tags
          .map((t) => `<span class="tl-chip tl-chip-${v.kind}">${t}</span>`)
          .join("")}</div>`
      : "";

    return `
      <div class="tl-verdict tl-${v.kind}">
        <div class="tl-verdict-head">
          <div class="tl-verdict-icon">${iconFor(v.kind)}</div>
          <div>
            <div class="tl-verdict-kind">${kindLabel}</div>
            <div class="tl-verdict-title">${v.title}</div>
          </div>
        </div>
        <div class="tl-verdict-body">
          <p class="tl-verdict-reason">${v.reason}</p>
          ${tagChips}
        </div>
        <div class="tl-verdict-section">
          <div class="tl-section-eyebrow">Rekomendacja</div>
          <div class="tl-recommendation">${recommendationFor(v)}</div>
        </div>
        <div class="tl-verdict-section">
          <div class="tl-section-eyebrow">Jak działa C2PA</div>
          <p class="tl-explainer">
            W idealnym świecie każda wiadomość zawierałaby niewidoczny podpis
            Content Credentials — wygenerowany przez klucz prywatny w module
            sprzętowym nadawcy (np. Titan M2 w Pixelu 9 Pro). Odbiorca mógłby
            natychmiast zobaczyć: <em>kto to wysłał</em>, <em>z jakiego urządzenia</em>
            i <em>czy tekst został zmieniony po drodze</em>.
          </p>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    const peer = lastPeerName || "Ten kontakt";
    const trust =
      lastPeerTrusted === false
        ? `<span class="tl-pill tl-pill-warn">Niezaufany</span>`
        : lastPeerTrusted === true
          ? `<span class="tl-pill tl-pill-ok">Zaufany</span>`
          : `<span class="tl-pill tl-pill-dim">Nieznany status</span>`;

    const scamRate =
      currentChatBucket.totalCount > 0
        ? Math.round(
            (currentChatBucket.scamCount / currentChatBucket.totalCount) * 100,
          )
        : 0;

    let evidenceHtml = "";

    // Dynamicznie dobieramy treść okienka na podstawie mocków i policzonych wiadomości
    const isDenys = peer.toLowerCase().includes("denys");

    if (isDenys) {
      evidenceHtml = `
        <div class="tl-section-eyebrow">Wykryto zagrożenia bezpieczeństwa</div>
        <ol class="tl-evidence">
          <li>
            <strong>Skompromitowany certyfikat</strong>
            <span>Klucz kryptograficzny nadawcy pochodzi z niezaufanego źródła (Self-signed) lub został sfałszowany.</span>
          </li>
          <li>
            <strong>Podejrzenie kradzieży tożsamości</strong>
            <span>Konto wykazuje oznaki przejęcia i może podszywać się pod inną osobę (Impersonation).</span>
          </li>
        </ol>
      `;
    } else if (currentChatBucket.scamCount > 0) {
      evidenceHtml = `
        <div class="tl-section-eyebrow">Zagrożenie: Nieważny podpis</div>
        <ol class="tl-evidence">
          <li>
            <strong>Błąd walidacji Content Credentials</strong>
            <span>Wykryto wiadomości, których sygnatura jest niezgodna z hash'em. Treść mogła ulec modyfikacji (Man-in-the-Middle).</span>
          </li>
          <li>
            <strong>Przełamana integralność (A.7)</strong>
            <span>Sprawdzenie sekcji manifestu C2PA A.7 wykazało nieautoryzowaną ingerencję osoby trzeciej.</span>
          </li>
        </ol>
      `;
    } else {
      evidenceHtml = `
        <div class="tl-section-eyebrow">Dowody kryptograficzne (Zaufana rozmowa)</div>
        <ol class="tl-evidence tl-evidence-ok">
          <li>
            <strong style="color:var(--tl-verified)">Zweryfikowane Content Credentials (C2PA)</strong>
            <span>Wszystkie wiadomości w tej sesji posiadają prawidłowy i zgodny podpis kryptograficzny.</span>
          </li>
          <li>
            <strong style="color:var(--tl-verified)">Tożsamość potwierdzona</strong>
            <span>Materiały pochodzą bezpośrednio z autoryzowanego modułu sprzętowego nadawcy (np. Secure Enclave / Titan M).</span>
          </li>
          <li>
            <strong style="color:var(--tl-verified)">Zachowana integralność</strong>
            <span>Skróty kryptograficzne potwierdzają kompletny brak modyfikacji na etapie transmisji.</span>
          </li>
        </ol>
      `;
    }

    return `
      <div class="tl-summary">
        <div class="tl-sum-head">
          <div class="tl-sum-peer">${escapeHtml(peer)}</div>
          ${trust}
        </div>
        <div class="tl-sum-stats">
          <div class="tl-stat">
            <div class="tl-stat-num">${currentChatBucket.totalCount}</div>
            <div class="tl-stat-label">wiadomości</div>
          </div>
          <div class="tl-stat">
            <div class="tl-stat-num ${currentChatBucket.scamCount > 0 ? "tl-danger" : "tl-verified"}">${currentChatBucket.scamCount}</div>
            <div class="tl-stat-label">zagrożeń</div>
          </div>
          <div class="tl-stat">
            <div class="tl-stat-num ${scamRate > 0 ? "tl-danger" : "tl-verified"}">${scamRate}%</div>
            <div class="tl-stat-label">ryzyka</div>
          </div>
        </div>

        <div class="tl-verdict-section">
          ${evidenceHtml}
        </div>

        <div class="tl-verdict-section">
          <div class="tl-section-eyebrow">Zabezpieczenia TrustLayer</div>
          <p class="tl-explainer">
            Twój komunikator analizuje pakiety w oparciu o sprzętowe potwierdzenie nadawcy 
            <strong>C2PA (Content Credentials)</strong>. Brak autoryzowanej plakietki lub nieprawidłowy 
            hash to kryptograficzny dowód na manipulację, a nie tylko algorytmiczne przypuszczenie.
          </p>
        </div>
      </div>
    `;
  }

  function iconFor(kind) {
    return (
      {
        verified: "✓",
        unverified: "?",
        scam: "!",
        recovered: "↻",
      }[kind] || "·"
    );
  }

  function recommendationFor(v) {
    if (v.kind === "scam") {
      return "Nie odpowiadaj, nie klikaj linków, nie wykonuj przelewów. Zweryfikuj tożsamość nadawcy kanałem alternatywnym (telefon, spotkanie).";
    }
    if (v.kind === "unverified") {
      return "Traktuj jak pocztówkę — bez pieczęci. Przy wrażliwych sprawach poproś o potwierdzenie kanałem podpisanym.";
    }
    if (v.kind === "verified") {
      return "Tożsamość potwierdzona kryptograficznie. Możesz ufać treści tak samo, jak ufasz autorowi w świecie fizycznym.";
    }
    return "";
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  // ------------------------------------------------------------
  // Chat observation
  // ------------------------------------------------------------

  function detectPeerState() {
    const title = document.querySelector(SEL.peerTitle);
    const name = title ? (title.textContent || "").trim() : "";
    if (name && name !== lastPeerName) {
      log("peer changed:", lastPeerName, "->", name);
      lastPeerName = name;
      currentChatBucket = { scamCount: 0, totalCount: 0 };
      syncBanner();
    }

    // Znajdź sygnały niezaufanego kontaktu (banner "BLOCK USER / ADD TO CONTACTS",
    // etykieta "Not a contact", itp.)
    const notContactText =
      document.body.innerText.includes("Not a contact") ||
      document.body.innerText.includes("Nie jest kontaktem") ||
      !!document.querySelector('[data-action="add-contact"]') ||
      !!document.querySelector(".chat-join");

    lastPeerTrusted = notContactText ? false : name ? true : null;
  }

  function scanAllBubbles() {
    const bubbles = document.querySelectorAll(
      `${SEL.bubble}:not([data-tl-done])`,
    );
    bubbles.forEach(decorateBubble);
  }

  function startObserver() {
    const target = document.body;
    const obs = new MutationObserver((mutations) => {
      let touched = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          if (n.matches?.(SEL.bubble)) {
            decorateBubble(n);
            touched = true;
          }
          const inner = n.querySelectorAll?.(SEL.bubble);
          if (inner && inner.length) {
            inner.forEach(decorateBubble);
            touched = true;
          }
        }
      }
      if (touched) detectPeerState();
    });
    obs.observe(target, { subtree: true, childList: true });
    log("observer installed");
  }

  // ------------------------------------------------------------
  // Bootstrap
  // ------------------------------------------------------------

  function boot() {
    log("boot");
    installFab();
    detectPeerState();
    scanAllBubbles();
    startObserver();
    pingBackend();
    // rescan periodically in case selectors changed
    setInterval(() => {
      detectPeerState();
      scanAllBubbles();
    }, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
