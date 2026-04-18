"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, MessageCircle, Image as ImageIcon, Tag, ShieldCheck } from "lucide-react";

const SCENARIOS = [
  {
    href: "/fakeapp",
    icon: MessageCircle,
    eyebrow: "Scenariusz 01",
    title: "Babcia + BLIK",
    blurb:
      "Komunikator z trzema rozmowami: Mama (zweryfikowana sprzętowo), nieznany numer i sprzedawca z OLX. Ostatnia wiadomość od \u201eMamy\u201d prosi o BLIK 5000 zł. TrustLayer wykrywa, że wiadomość nie pochodzi z jej zarejestrowanego iPhone\u2019a.",
    cta: "Otwórz FakeApp",
    accent: "amber",
  },
  {
    href: "/gallery",
    icon: ImageIcon,
    eyebrow: "Scenariusz 02",
    title: "Personal Alibi",
    blurb:
      "Galeria pięciu autentycznych zdjęć Anny, podpisanych jej Pixelem 9 Pro (Titan M2). Plus jedno fałszywe zdjęcie udające ją. System tworzy \u201ecyfrowe alibi\u201d — dowód, że nie pochodzi z jej urządzenia.",
    cta: "Zobacz galerię",
    accent: "verified",
  },
  {
    href: "/olx",
    icon: Tag,
    eyebrow: "Scenariusz 03",
    title: "Ogłoszenie z AI",
    blurb:
      "Trzy ogłoszenia mieszkań we Wrocławiu. Dwa od podpisanych sprzedawców, jedno bez prowenancji ze zdjęciami wygenerowanymi przez AI i podejrzanie niską ceną. Integrity Clash w akcji.",
    cta: "Przejdź na OLX",
    accent: "clash",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative z-10 min-h-screen px-6 md:px-12 py-12 md:py-20 max-w-6xl mx-auto">
      {/* Top */}
      <header className="flex items-center justify-between mb-20 md:mb-32">
        <div className="flex items-center gap-3">
          <div className="cr-icon text-amber-glow border-amber-glow/60">CR</div>
          <span className="font-display text-lg tracking-tight">TrustLayer</span>
        </div>
        <Link
          href="https://c2pa.org"
          className="text-xs text-ink-300 hover:text-ink-100 transition-colors flex items-center gap-1.5"
          target="_blank"
        >
          spec C2PA 2.3 <ArrowUpRight size={12} />
        </Link>
      </header>

      {/* Hero */}
      <section className="mb-24 md:mb-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-xs uppercase tracking-[0.3em] text-amber-glow mb-6 font-mono">
            Dekada innowacji · Hackathon EESTEC
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight max-w-4xl">
            Prawda przeżywa{" "}
            <em className="font-display italic text-amber-glow not-italic">
              <span className="italic">screenshot</span>
            </em>
            ,{" "}
            <em className="italic text-amber-glow">copy-paste</em>{" "}
            i wycinanie metadanych.
          </h1>
          <p className="mt-10 max-w-2xl text-lg md:text-xl text-ink-200 leading-relaxed">
            Cyfrowa warstwa autentyczności dla wiadomości, ogłoszeń i mediów.
            Łączymy podpisy sprzętowe (C2PA) z behawioralną atestacją procesu
            i percepcyjnym hashowaniem — żeby odbiorca <em>widział</em>, kto
            naprawdę stworzył treść, nawet po kompresji platform.
          </p>
        </motion.div>

        {/* Big stat row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-ink-600/40 rounded-xl overflow-hidden"
        >
          <Stat value="VIII.2026" label="EU AI Act Art. 50 wchodzi w życie" />
          <Stat value="3 warstwy" label="Hard binding · Soft binding · Behavior" />
          <Stat value="ES256" label="Podpisy w Secure Enclave / TPM / Titan M2" />
          <Stat value="Section A.7" label="Manifest osadzony w Unicode VS" />
        </motion.div>
      </section>

      {/* Scenarios */}
      <section className="space-y-px">
        <div className="flex items-end justify-between mb-10">
          <h2 className="font-display text-3xl md:text-4xl text-ink-50">
            Trzy scenariusze
          </h2>
          <div className="text-xs text-ink-300 font-mono uppercase tracking-wider">
            Demo na żywo
          </div>
        </div>

        <div className="space-y-4">
          {SCENARIOS.map((s, i) => (
            <ScenarioCard key={s.href} {...s} index={i} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-32 pt-12 border-t border-ink-600/40 flex flex-wrap items-center justify-between gap-6 text-sm text-ink-300">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} />
          <span>TrustLayer · vibe-coded w 24h na hackathon EESTEC</span>
        </div>
        <div className="font-mono text-xs">
          C2PA 2.3 · ECDSA P-256 · SimHash 64 · pHash 64 · WebAuthn
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-ink-800 px-6 py-7">
      <div className="font-display text-2xl md:text-3xl text-ink-50 leading-none mb-2">
        {value}
      </div>
      <div className="text-xs text-ink-300 leading-relaxed">{label}</div>
    </div>
  );
}

function ScenarioCard({
  href, icon: Icon, eyebrow, title, blurb, cta, accent, index,
}: {
  href: string; icon: any; eyebrow: string; title: string;
  blurb: string; cta: string; accent: "amber" | "verified" | "clash"; index: number;
}) {
  const accentMap = {
    amber:    "text-amber-glow border-amber-glow/30 hover:border-amber-glow/70",
    verified: "text-verified border-verified/30 hover:border-verified/70",
    clash:    "text-clash border-clash/30 hover:border-clash/70",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href}
        className={`group block border ${accentMap[accent]} rounded-xl p-6 md:p-10 transition-all bg-ink-800/40 hover:bg-ink-800/80 relative overflow-hidden`}
      >
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-2 flex md:flex-col gap-4 items-center md:items-start">
            <Icon size={28} strokeWidth={1.4} className={accentMap[accent].split(" ")[0]} />
            <div className="text-xs uppercase tracking-[0.2em] text-ink-300 font-mono">
              {eyebrow}
            </div>
          </div>

          <div className="md:col-span-7">
            <h3 className="font-display text-3xl md:text-4xl text-ink-50 mb-3 leading-tight">
              {title}
            </h3>
            <p className="text-ink-200 leading-relaxed max-w-xl">{blurb}</p>
          </div>

          <div className="md:col-span-3 flex md:justify-end items-end h-full">
            <div className={`flex items-center gap-2 ${accentMap[accent].split(" ")[0]} font-medium group-hover:gap-3 transition-all`}>
              <span>{cta}</span>
              <ArrowUpRight size={18} className="group-hover:rotate-12 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
