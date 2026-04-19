"use client";

/**
 * SocialFeed — sekcja pod galerią Anny, która pokazuje pełne spektrum
 * statusów Content Credentials na przykładzie postów w social media.
 *
 * Sześć kart, po jednym casie:
 *   1. VERIFIED (human, real)         — Anna publikuje swoje zdjęcie
 *   2. VERIFIED + AI declared (legit) — artysta publikuje AI-art, manifest spójny
 *   3. RECOVERED                      — repost bez oryginalnych metadanych,
 *                                        manifest odzyskany przez SynthID
 *   4. UNVERIFIED                     — brak jakichkolwiek sygnałów
 *   5. INTEGRITY_CLASH                — deepfake Anny, SynthID + brak podpisu
 *   6. TAMPERED                       — edycja bez deklaracji, hash nie gra
 *
 * Design: layout dwukolumnowy feed + floating trust chip na każdej karcie.
 * Klik w kartę otwiera prostą "nutrition label" w modal-popoverze.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  Link2,
  X as XIcon,
} from "lucide-react";
import type { DemoPhoto, VerificationStatus } from "@/lib/api";
import { CrIcon } from "@/components/nutrition/CrIcon";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export interface SocialPost {
  id: string;
  platform: "instagram" | "x" | "linkedin";
  author: string;
  authorHandle: string;
  authorVerifiedOrg?: string; // "Adobe Firefly Certified"
  timeAgo: string;
  caption: string;
  likes: number;
  comments: number;
  status: VerificationStatus;
  // Etykieta obok CR ikony — krótki tag, np. "AI declared"
  extraBadge?: { label: string; tone: "ai" | "info" | "warn" };
  // Obrazek — albo referencja do zdjęcia z galerii (po tytule),
  // albo pusty slot z gradient fallback.
  photoTitle?: string;
  fallbackTone?: "ai-art" | "stock" | "news";
  // Szczegóły do nutrition label
  details: {
    signedBy?: string;
    device?: string;
    timestamp?: string;
    aiDeclared?: boolean;
    aiModel?: string;
    synthid?: "present" | "absent" | "mismatch";
    hashMatch?: "ok" | "mismatch" | "recovered";
    clashReasons?: string[];
    recoveredVia?: string;
    verdictHeadline: string;
    verdictBody: string;
  };
}

// ----------------------------------------------------------------------
// Demo data
// ----------------------------------------------------------------------

const POSTS: SocialPost[] = [
  {
    id: "p1",
    platform: "instagram",
    author: "Anna Kowalska",
    authorHandle: "@anna.kow",
    timeAgo: "2 godz.",
    caption:
      "Pierwszy dzień w bibliotece głównej 🍂 Zostało 42 stron do egzaminu z kryptografii.",
    likes: 234,
    comments: 18,
    status: "verified",
    photoTitle: "Anna na uczelni",
    details: {
      signedBy: "Anna Kowalska",
      device: "Pixel 9 Pro · Titan M2",
      timestamp: "dzisiaj, 14:02",
      aiDeclared: false,
      synthid: "absent",
      hashMatch: "ok",
      verdictHeadline: "Autor i urządzenie potwierdzone kryptograficznie",
      verdictBody:
        "Manifest C2PA podpisany kluczem sprzętowym Titan M2. Hash pliku " +
        "zgadza się z podpisem — treść nie była zmieniana od zrobienia zdjęcia.",
    },
  },
  {
    id: "p2",
    platform: "linkedin",
    author: "Jakub Nowak",
    authorHandle: "@jnowak.art",
    authorVerifiedOrg: "Adobe Firefly Certified Creator",
    timeAgo: "5 godz.",
    caption:
      'Nowa seria „Brutalist Poland” — generowana w Adobe Firefly 4, ' +
      'edytowana w Photoshopie. Cały łańcuch w Content Credentials.',
    likes: 1_420,
    comments: 87,
    status: "verified",
    extraBadge: { label: "AI declared", tone: "ai" },
    fallbackTone: "ai-art",
    details: {
      signedBy: "Jakub Nowak (Adobe ID)",
      device: "Adobe Photoshop 2026 · Firefly 4 plugin",
      timestamp: "dzisiaj, 11:18",
      aiDeclared: true,
      aiModel: "Adobe Firefly 4 (trainedAlgorithmicMedia)",
      synthid: "present",
      hashMatch: "ok",
      verdictHeadline: "AI wykryte, ale autor to zgłosił — spójne",
      verdictBody:
        "Manifest deklaruje generację przez Firefly 4 i edycję w Photoshopie. " +
        "Wodny znak SynthID wykryty i zgodny z manifestem. Cross-check " +
        "udany: AI present ∧ AI declared ⇒ brak oszustwa, tylko transparentność.",
    },
  },
  {
    id: "p3",
    platform: "x",
    author: "Kasia Nowak",
    authorHandle: "@kasia_wrc",
    timeAgo: "1 dzień",
    caption: "Lato '25 @ Amalfi z Anną. Może tak za rok znowu? 🌅",
    likes: 89,
    comments: 6,
    status: "recovered",
    photoTitle: "Anna na wakacjach",
    details: {
      signedBy: "(oryginalnie) Anna Kowalska",
      device: "Pixel 9 Pro · Titan M2 (re-upload zdjął manifest)",
      timestamp: "oryginał: lipiec 2025",
      synthid: "present",
      hashMatch: "recovered",
      recoveredVia: "Digimarc watermark → Content Credentials Manifest Store",
      verdictHeadline: "Metadane usunięte przez platformę — odzyskane",
      verdictBody:
        "X wycina manifest z pliku przy re-enkodzie. Invisible watermark " +
        "Digimarc pozwolił pobrać oryginalny manifest z chmurowego Manifest " +
        "Store. Autor oryginału: Anna Kowalska. Repost oznaczony jako " +
        "pochodna — łańcuch prowenancji spójny.",
    },
  },
  {
    id: "p4",
    platform: "instagram",
    author: "Memes_Daily_Wrc",
    authorHandle: "@memes_daily_wrc",
    timeAgo: "3 godz.",
    caption: "Kiedy piątek a Ty jeszcze na uczelni 😅 (fot. nieznany)",
    likes: 3_200,
    comments: 144,
    status: "unverified",
    photoTitle: "Mem uczelniany — źródło nieznane",
    fallbackTone: "stock",
    details: {
      timestamp: "dzisiaj, 12:45",
      hashMatch: "ok", // plik nie jest zmodyfikowany, po prostu bez manifestu
      verdictHeadline: "Brak prowenancji — nie da się ocenić",
      verdictBody:
        "Żadnych Content Credentials, żadnego watermarka, żadnego SynthID. " +
        "Nie oznacza że fałszywe — ale też nie ma jak potwierdzić autora. " +
        "Treść bez prowenancji to pocztówka bez pieczęci.",
    },
  },
  {
    id: "p5",
    platform: "x",
    author: "RealNews_PL_official",
    authorHandle: "@realnews_pl_official",
    timeAgo: "12 min",
    caption:
      "EKSKLUZYWNIE: Polka Anna Kowalska wybrana do programu NASA Artemis IV! " +
      "Pierwsze zdjęcia ze szkolenia orbitalnego. 🇵🇱🚀",
    likes: 18_400,
    comments: 2_103,
    status: "integrity_clash",
    extraBadge: { label: "Personal Alibi mismatch", tone: "warn" },
    photoTitle: "Rzekome zdjęcie 'Anny'",
    details: {
      timestamp: "dzisiaj, 00:38",
      aiDeclared: false,
      aiModel: "(niezadeklarowany)",
      synthid: "present",
      hashMatch: "mismatch",
      clashReasons: [
        "Brak podpisu sprzętowego Anny (żadne z 5 jej autentycznych zdjęć nie pasuje)",
        "SynthID wykryty — treść pochodzi z modelu generatywnego",
        "Konto '@realnews_pl_official' zarejestrowane 3 dni temu",
        "Klasyfikator artefaktów: 92% AI",
      ],
      verdictHeadline: "Deepfake — treść udaje osobę której nie pochodzi z jej urządzenia",
      verdictBody:
        "Wiele sygnałów negatywnych się pokrywa. Personal Alibi nie zgadza się: " +
        "jeśli Anna naprawdę była na szkoleniu NASA, publikowałaby zdjęcia " +
        "z zarejestrowanego urządzenia. Ich brak jest dowodem matematycznym.",
    },
  },
  {
    id: "p6",
    platform: "instagram",
    author: "Anna Kowalska",
    authorHandle: "@anna.kow",
    timeAgo: "1 godz.",
    caption: "Kawiarnia na Rynku ☕ (lekki retusz bo oświetlenie było fatalne)",
    likes: 156,
    comments: 9,
    status: "tampered",
    photoTitle: "Anna selfie kawiarnia",
    details: {
      signedBy: "Anna Kowalska",
      device: "Pixel 9 Pro · Titan M2",
      timestamp: "dzisiaj, 16:30",
      synthid: "absent",
      hashMatch: "mismatch",
      clashReasons: [
        "Hash pliku nie zgadza się z tym zapisanym w manifeście",
        "W łańcuchu edycji brak kroku 'retouch' — edycja nieudokumentowana",
      ],
      verdictHeadline: "Podpis ważny, ale edycja nieudokumentowana",
      verdictBody:
        "Oryginalny manifest z Pixela 9 Pro jest poprawny — to zdjęcie " +
        "faktycznie zrobiła Anna. Ale aktualny hash nie zgadza się z zapisanym. " +
        "Ktoś (lub sama autorka) edytował zdjęcie po podpisaniu i nie dopisał " +
        "tego do chain of custody. Nie deepfake — ale prowenancja pęknięta.",
    },
  },
];

// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------

export function SocialFeed({ photos }: { photos: DemoPhoto[] }) {
  const [active, setActive] = useState<SocialPost | null>(null);

  // Mapa po tytule — żeby karty mogły pokazać obrazek z bazy
  const photoMap = useMemo(() => {
    const m = new Map<string, DemoPhoto>();
    for (const p of photos) {
      // dopasowanie "Anna na uczelni" lub prefix "Rzekome zdjęcie"
      m.set(p.title, p);
    }
    return m;
  }, [photos]);

  function resolveImage(post: SocialPost): DemoPhoto | undefined {
    if (!post.photoTitle) return undefined;
    // fuzzy match: exact or startsWith
    if (photoMap.has(post.photoTitle)) return photoMap.get(post.photoTitle);
    for (const [title, photo] of photoMap.entries()) {
      if (title.startsWith(post.photoTitle)) return photo;
    }
    return undefined;
  }

  return (
    <section className="mt-24">
      <div className="flex items-end justify-between border-b border-ink-600/40 pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-400 mb-1 font-mono">
            Scenariusz 02b — Pełne spektrum
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-ink-50">
            Feed społecznościowy — sześć statusów
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-ink-400 font-mono">
          <Sparkles size={12} className="text-amber-glow" />
          Każda karta = inny przypadek Content Credentials
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] font-mono">
        <LegendChip status="verified"        label="Zweryfikowane" />
        <LegendChip status="verified"        label="+ AI declared" aiFlag />
        <LegendChip status="recovered"       label="Odzyskane" />
        <LegendChip status="unverified"      label="Brak prowenancji" />
        <LegendChip status="integrity_clash" label="Deepfake / clash" />
        <LegendChip status="tampered"        label="Edycja nieudokumentowana" />
      </div>

      {/* Feed grid */}
      <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {POSTS.map((post, i) => (
          <FeedCard
            key={post.id}
            post={post}
            index={i}
            photo={resolveImage(post)}
            onClick={() => setActive(post)}
          />
        ))}
      </div>

      {/* Nutrition popover */}
      <AnimatePresence>
        {active && (
          <FeedDetailModal
            post={active}
            photo={resolveImage(active)}
            onClose={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// ----------------------------------------------------------------------
// Legend chip
// ----------------------------------------------------------------------

function LegendChip({
  status,
  label,
  aiFlag = false,
}: {
  status: VerificationStatus;
  label: string;
  aiFlag?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-ink-800/60 border border-ink-600/40">
      <CrIcon status={status} size="sm" />
      <span className="text-ink-200 truncate">{label}</span>
      {aiFlag && (
        <span className="ml-auto text-[9px] uppercase tracking-wider text-amber-glow font-semibold">
          AI
        </span>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Feed card
// ----------------------------------------------------------------------

function FeedCard({
  post,
  index,
  photo,
  onClick,
}: {
  post: SocialPost;
  index: number;
  photo?: DemoPhoto;
  onClick: () => void;
}) {
  const statusBorder = {
    verified: "border-verified/30",
    recovered: "border-recovered/30",
    integrity_clash: "border-clash/50",
    tampered: "border-clash/40",
    unverified: "border-ink-600/40",
  }[post.status];

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.4 }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`group text-left bg-ink-800/80 rounded-xl border ${statusBorder} overflow-hidden hover:border-amber-glow/40 transition-all`}
    >
      {/* Author row */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlatformAvatar post={post} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-ink-50 font-medium truncate">
                {post.author}
              </span>
              {post.authorVerifiedOrg && (
                <span
                  title={post.authorVerifiedOrg}
                  className="text-[9px] uppercase tracking-wider text-amber-glow font-mono"
                >
                  ✓ {post.authorVerifiedOrg.split(" ")[0]}
                </span>
              )}
            </div>
            <div className="text-[11px] text-ink-400 font-mono flex items-center gap-1.5">
              <span>{post.authorHandle}</span>
              <span>·</span>
              <Clock size={9} />
              <span>{post.timeAgo}</span>
            </div>
          </div>
        </div>
        <CrIcon status={post.status} size="md" />
      </div>

      {/* Image */}
      <CardImage post={post} photo={photo} />

      {/* Caption & stats */}
      <div className="px-4 py-3">
        <p className="text-sm text-ink-100 leading-relaxed line-clamp-3">
          {post.caption}
        </p>
        <div className="mt-2.5 flex items-center justify-between text-xs text-ink-400 font-mono">
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1">
              <Heart size={11} /> {formatNum(post.likes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={11} /> {formatNum(post.comments)}
            </span>
            <Share2 size={11} />
          </div>
          {post.extraBadge && <ExtraBadge badge={post.extraBadge} />}
        </div>
      </div>
    </motion.button>
  );
}

function ExtraBadge({
  badge,
}: {
  badge: NonNullable<SocialPost["extraBadge"]>;
}) {
  const tone =
    badge.tone === "ai"
      ? "text-amber-glow border-amber-glow/40 bg-amber-glow/8"
      : badge.tone === "warn"
      ? "text-clash border-clash/40 bg-clash/10"
      : "text-ink-200 border-ink-600/60 bg-ink-700/40";

  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded border ${tone}`}
    >
      {badge.label}
    </span>
  );
}

function PlatformAvatar({ post }: { post: SocialPost }) {
  // Kolorystyka avatara zależna od platformy — symbolicznie
  const bg =
    post.platform === "instagram"
      ? "bg-gradient-to-br from-fuchsia-500/80 to-amber-500/80"
      : post.platform === "x"
      ? "bg-gradient-to-br from-slate-700 to-slate-900"
      : "bg-gradient-to-br from-blue-600 to-blue-800";

  const initials = post.author
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`w-9 h-9 rounded-full grid place-items-center text-[11px] text-white font-semibold ${bg}`}
    >
      {initials}
    </div>
  );
}

function CardImage({ post, photo }: { post: SocialPost; photo?: DemoPhoto }) {
  if (photo) {
    return (
      <div className="relative aspect-[4/5] bg-ink-900">
        <img
          src={`data:image/jpeg;base64,${photo.image_b64}`}
          alt={post.caption}
          className="w-full h-full object-cover"
        />
        {/* Diagonal stripe for clash */}
        {(post.status === "integrity_clash" || post.status === "tampered") && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(226,92,74,0.10) 14px, rgba(226,92,74,0.10) 15px)`,
            }}
          />
        )}
        {post.status === "recovered" && (
          <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-recovered bg-ink-950/80 px-2 py-1 rounded">
            recovered via watermark
          </div>
        )}
      </div>
    );
  }

  // Fallback visuals
  if (post.fallbackTone === "ai-art") {
    return (
      <div className="relative aspect-[4/5] bg-gradient-to-br from-[#0a1430] via-[#3a1f55] to-[#c47e1a] overflow-hidden">
        {/* Generative-looking grid */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(245,176,74,0.6), transparent 40%), radial-gradient(circle at 80% 70%, rgba(226,92,74,0.5), transparent 35%), linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)",
          }}
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-glow bg-ink-950/70 px-2 py-1 rounded">
          <Sparkles size={10} /> Firefly 4
        </div>
      </div>
    );
  }

  // "stock" — colorful blocks reminiscent of a generic stock-photo layout
  return (
    <div className="relative aspect-[4/5] bg-ink-700 overflow-hidden">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(150,150,150,0.2), rgba(80,80,80,0.4)), repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px)",
        }}
      />
      <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-ink-300 bg-ink-950/70 px-2 py-1 rounded">
        no provenance
      </div>
    </div>
  );
}

function formatNum(n: number) {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

// ----------------------------------------------------------------------
// Detail modal (lightweight nutrition sheet)
// ----------------------------------------------------------------------

function FeedDetailModal({
  post,
  photo,
  onClose,
}: {
  post: SocialPost;
  photo?: DemoPhoto;
  onClose: () => void;
}) {
  const d = post.details;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-ink-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-ink-800 rounded-xl border border-ink-600 overflow-hidden grid md:grid-cols-[1fr,360px]"
      >
        {/* Image side */}
        <div className="relative bg-ink-900 min-h-[260px]">
          {photo ? (
            <img
              src={`data:image/jpeg;base64,${photo.image_b64}`}
              alt={post.caption}
              className="w-full h-full object-cover"
            />
          ) : (
            <CardImage post={post} photo={undefined} />
          )}
        </div>

        {/* Info side */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <CrIcon status={post.status} size="lg" />
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 font-mono">
                  {statusEyebrow(post.status)}
                </div>
                <div className="font-display text-lg text-ink-50 leading-tight">
                  {d.verdictHeadline}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-50 transition-colors"
              aria-label="Zamknij"
            >
              <XIcon size={18} />
            </button>
          </div>

          <p className="text-sm text-ink-200 leading-relaxed">{d.verdictBody}</p>

          <div className="border-t border-ink-600/40 pt-4 space-y-2 text-xs font-mono">
            {d.signedBy && (
              <Row icon={<ShieldCheck size={11} />} label="Podpisane przez">
                {d.signedBy}
              </Row>
            )}
            {d.device && <Row label="Urządzenie">{d.device}</Row>}
            {d.timestamp && <Row label="Timestamp">{d.timestamp}</Row>}
            {d.aiDeclared !== undefined && (
              <Row
                icon={<Sparkles size={11} />}
                label="AI declared"
              >
                {d.aiDeclared ? `Tak — ${d.aiModel ?? "nieznany model"}` : "Nie"}
              </Row>
            )}
            {d.synthid && (
              <Row label="SynthID watermark">
                <SyntIdChip v={d.synthid} />
              </Row>
            )}
            {d.hashMatch && (
              <Row label="Hash C2PA">
                <HashChip v={d.hashMatch} />
              </Row>
            )}
            {d.recoveredVia && (
              <Row icon={<Link2 size={11} />} label="Odzyskano przez">
                {d.recoveredVia}
              </Row>
            )}
            {d.clashReasons && d.clashReasons.length > 0 && (
              <div className="pt-2 border-t border-ink-600/30">
                <div className="flex items-center gap-1.5 text-clash uppercase tracking-wider text-[10px] mb-2">
                  <AlertTriangle size={10} /> Dowody negatywne
                </div>
                <ol className="space-y-1.5 text-ink-200">
                  {d.clashReasons.map((r, i) => (
                    <li key={i} className="grid grid-cols-[16px,1fr] gap-2">
                      <span className="text-clash">{String(i + 1).padStart(2, "0")}</span>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px,1fr] gap-3 items-start">
      <div className="text-ink-400 flex items-center gap-1.5 pt-[2px]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-ink-100">{children}</div>
    </div>
  );
}

function SyntIdChip({ v }: { v: "present" | "absent" | "mismatch" }) {
  const style = {
    present:  "text-amber-glow border-amber-glow/40 bg-amber-glow/10",
    absent:   "text-ink-300 border-ink-600 bg-ink-700/40",
    mismatch: "text-clash border-clash/40 bg-clash/10",
  }[v];
  const label = {
    present:  "present",
    absent:   "not detected",
    mismatch: "mismatch",
  }[v];
  return (
    <span className={`inline-block px-2 py-0.5 rounded border ${style} text-[10px] uppercase tracking-wider`}>
      {label}
    </span>
  );
}

function HashChip({ v }: { v: "ok" | "mismatch" | "recovered" }) {
  const style = {
    ok:        "text-verified border-verified/40 bg-verified/10",
    mismatch:  "text-clash border-clash/40 bg-clash/10",
    recovered: "text-recovered border-recovered/40 bg-recovered/10",
  }[v];
  const label = {
    ok:        "match",
    mismatch:  "mismatch",
    recovered: "recovered",
  }[v];
  return (
    <span className={`inline-block px-2 py-0.5 rounded border ${style} text-[10px] uppercase tracking-wider`}>
      {label}
    </span>
  );
}

function statusEyebrow(s: VerificationStatus) {
  return {
    verified: "Zweryfikowane",
    recovered: "Odzyskane",
    integrity_clash: "Integrity clash",
    tampered: "Tampered",
    unverified: "Bez prowenancji",
  }[s];
}
