"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldOff, Sparkles, Cpu, Fingerprint, Hash, Clock, X, Info, AlertTriangle } from "lucide-react";
import type { VerificationResult, VerificationStatus } from "@/lib/api";
import { cn, statusLabel, statusColor } from "@/lib/utils";

interface Props {
  result: VerificationResult | null;
  open: boolean;
  onClose: () => void;
}

export function NutritionSheet({ result, open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && result && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink-950/80 backdrop-blur-md z-40"
          />
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-ink-800 border-l border-ink-600 z-50 overflow-y-auto"
          >
            <SheetContent result={result} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetContent({ result, onClose }: { result: VerificationResult; onClose: () => void }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink-800/95 backdrop-blur-xl border-b border-ink-600">
        <div className="flex items-start justify-between px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-ink-300 mb-1">
              Content Credentials
            </div>
            <h2 className="font-display text-2xl text-ink-50 leading-tight">
              Etykieta autentyczności
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 text-ink-300 hover:text-ink-50 transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        <StatusBlock result={result} />
        {result.author && <AuthorBlock author={result.author} />}
        {result.clash && result.clash.verdict !== "none" && (
          <ClashBlock clash={result.clash} />
        )}
        <SignalBlock result={result} />
        {result.manifest && <ManifestBlock manifest={result.manifest} />}
        <FooterNote />
      </div>
    </div>
  );
}

// ------- Status block (L2 summary) -------

function StatusBlock({ result }: { result: VerificationResult }) {
  const Icon = iconFor(result.status);

  return (
    <div className={cn(
      "rounded-xl border p-5 relative overflow-hidden",
      bgFor(result.status),
    )}>
      <div className="flex items-start gap-4">
        <Icon className={cn("flex-shrink-0", statusColor(result.status))} size={28} strokeWidth={1.4} />
        <div className="flex-1">
          <div className={cn("text-sm font-medium mb-1", statusColor(result.status))}>
            {statusLabel(result.status)}
          </div>
          <p className="font-display text-lg leading-snug text-ink-50">
            {result.summary}
          </p>
        </div>
      </div>
      {result.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {result.badges.map((b) => (
            <span key={b} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-ink-500/50 text-ink-200 font-mono">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ------- Author -------

function AuthorBlock({ author }: { author: NonNullable<VerificationResult["author"]> }) {
  return (
    <Section title="Autor & urządzenie" icon={Fingerprint}>
      <div className="flex items-center gap-3 mb-3">
        {author.avatar && (
          <span className="text-3xl">{author.avatar}</span>
        )}
        <div>
          <div className="font-display text-lg text-ink-50">
            {author.display_name || author.identifier || "—"}
          </div>
          <div className="text-xs text-ink-300 font-mono">
            @{author.identifier}
          </div>
        </div>
      </div>
      {author.device_label && (
        <Row icon={Cpu} label="Urządzenie">
          <span className="text-ink-100">{author.device_label}</span>
          {author.hardware_backed && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-verified font-mono">
              hardware-backed
            </span>
          )}
        </Row>
      )}
      {author.credential_id && (
        <Row icon={Hash} label="Credential ID">
          <code className="text-ink-200 text-xs">{author.credential_id.slice(0, 24)}…</code>
        </Row>
      )}
    </Section>
  );
}

// ------- Clash -------

function ClashBlock({ clash }: { clash: NonNullable<VerificationResult["clash"]> }) {
  return (
    <div className="rounded-xl border border-clash/40 bg-clash/8 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="text-clash" size={18} strokeWidth={1.6} />
        <span className="font-display text-base text-clash">
          Wykryto sprzeczność ({clash.verdict === "confirmed" ? "potwierdzona" : "podejrzana"})
        </span>
      </div>
      <ul className="space-y-2 text-sm text-ink-100">
        {clash.reasons.map((r, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="text-clash mt-1.5 flex-shrink-0">·</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3 border-t border-clash/20 flex justify-between text-xs text-ink-300">
        <span>Wskaźnik niespójności</span>
        <span className="font-mono">{(clash.score * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ------- Signals (hard/soft hash, sig) -------

function SignalBlock({ result }: { result: VerificationResult }) {
  return (
    <Section title="Sygnały kryptograficzne" icon={Sparkles}>
      <Row icon={Hash} label="Hard hash">
        <Indicator ok={result.hard_hash_match === true}
                   neutral={result.hard_hash_match === null}>
          {result.hard_hash_match === true ? "zgodny (SHA-256)" :
           result.hard_hash_match === false ? "niezgodny" : "n/d"}
        </Indicator>
      </Row>
      <Row icon={ShieldCheck} label="Podpis ECDSA">
        <Indicator ok={result.signature_valid === true}
                   neutral={result.signature_valid === null}>
          {result.signature_valid === true ? "zweryfikowany (ES256)" :
           result.signature_valid === false ? "nieprawidłowy" : "n/d"}
        </Indicator>
      </Row>
      {result.soft_match_distance !== null && (
        <Row icon={Sparkles} label="Soft binding">
          <span className="text-ink-100">
            Hamming {result.soft_match_distance}/64{" "}
            <span className="text-ink-300 font-mono">
              ({((1 - result.soft_match_distance / 64) * 100).toFixed(0)}% podobieństwa)
            </span>
          </span>
        </Row>
      )}
    </Section>
  );
}

// ------- Manifest details (L3) -------

function ManifestBlock({ manifest }: { manifest: NonNullable<VerificationResult["manifest"]> }) {
  return (
    <Section title="Szczegóły manifestu" icon={Info}>
      <div className="space-y-3">
        {manifest.claim && (
          <Row icon={Clock} label="Czas podpisania">
            <span className="text-ink-100">
              {new Date(manifest.claim.timestamp).toLocaleString("pl-PL")}
            </span>
          </Row>
        )}
        {manifest.claim && (
          <Row icon={Hash} label="Instance ID">
            <code className="text-ink-200 text-xs break-all">{manifest.claim.instance_id}</code>
          </Row>
        )}
        {manifest.signature && (
          <Row icon={ShieldCheck} label="Algorytm">
            <span className="text-ink-100 font-mono text-xs">{manifest.signature.algorithm}</span>
          </Row>
        )}
      </div>
      <div className="mt-4">
        <div className="text-xs uppercase tracking-[0.15em] text-ink-300 mb-2">
          Asercje ({manifest.assertions.length})
        </div>
        <div className="space-y-1.5">
          {manifest.assertions.map((a, i) => (
            <div key={i} className="text-xs font-mono bg-ink-700/40 rounded px-3 py-2 flex items-center gap-2">
              <span className="text-amber-glow">{a.label}</span>
              <span className="ml-auto text-ink-300">{a.hash.slice(0, 12)}…</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ------- Footer disclaimer -------

function FooterNote() {
  return (
    <div className="text-xs text-ink-400 leading-relaxed pt-4 border-t border-ink-600/40">
      Brak Content Credentials nie oznacza, że treść jest fałszywa — wiele platform wciąż nie wspiera proweniencji.
      System wykrywa sprzeczności tam, gdzie podpis jest deklarowany niezgodnie z sygnałami AI.
    </div>
  );
}

// ------- Helpers -------

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-ink-300" strokeWidth={1.6} />
        <h3 className="text-xs uppercase tracking-[0.2em] text-ink-300 font-body font-medium">
          {title}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon size={14} className="text-ink-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
      <span className="text-ink-300 w-24 flex-shrink-0">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}

function Indicator({ ok, neutral, children }: { ok: boolean; neutral?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn(
      neutral ? "text-ink-300" :
      ok ? "text-verified" : "text-clash"
    )}>
      {children}
    </span>
  );
}

function iconFor(status: VerificationStatus) {
  switch (status) {
    case "verified":        return ShieldCheck;
    case "recovered":       return Sparkles;
    case "integrity_clash": return ShieldAlert;
    case "tampered":        return ShieldOff;
    case "unverified":      return ShieldOff;
  }
}

function bgFor(status: VerificationStatus): string {
  switch (status) {
    case "verified":        return "border-verified/30 bg-verified/5";
    case "recovered":       return "border-recovered/30 bg-recovered/5";
    case "integrity_clash": return "border-clash/40 bg-clash/8";
    case "tampered":        return "border-clash/40 bg-clash/8";
    case "unverified":      return "border-ink-500/40 bg-ink-700/40";
  }
}
