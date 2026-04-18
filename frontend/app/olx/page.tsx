"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Tag, AlertTriangle, ShieldCheck, ChevronRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { api, type DemoListing, type VerificationResult } from "@/lib/api";
import { CrIcon } from "@/components/nutrition/CrIcon";
import { NutritionSheet } from "@/components/nutrition/NutritionSheet";
import { cn } from "@/lib/utils";

export default function OlxPage() {
  const [listings, setListings] = useState<DemoListing[]>([]);
  const [active, setActive] = useState<DemoListing | null>(null);
  const [sheetResult, setSheetResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    api.olx().then((d) => setListings(d.listings));
  }, []);

  return (
    <div className="relative z-10 min-h-screen px-6 md:px-12 py-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-12">
        <Link href="/" className="flex items-center gap-2 text-ink-300 hover:text-ink-50 transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">TrustLayer</span>
        </Link>
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-amber-glow" />
          <span className="text-sm font-display">FakeOLX · Mieszkania we Wrocławiu</span>
        </div>
      </header>

      <section className="mb-12">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-glow mb-4 font-mono">
          Scenariusz 03 — Integrity Clash
        </div>
        <h1 className="font-display text-4xl md:text-6xl text-ink-50 leading-tight mb-6 max-w-3xl">
          Trzy ogłoszenia. Jedno z nich {" "}
          <em className="italic text-amber-glow">zarobi 500 zł</em>{" "}
          na zadatku.
        </h1>
        <p className="text-lg text-ink-200 leading-relaxed max-w-2xl">
          Mieszkania we Wrocławiu od dwóch zweryfikowanych sprzedawców i jednego konta bez prowenancji.
          Ceny mówią same za siebie — ale to TrustLayer wykrywa, że zdjęcia tego trzeciego ogłoszenia
          zostały wygenerowane przez AI.
        </p>
      </section>

      <section className="space-y-3">
        {listings.map((l, i) => (
          <ListingCard
            key={l.id}
            listing={l}
            index={i}
            onOpen={() => setActive(l)}
          />
        ))}
      </section>

      {active && (
        <ListingModal
          listing={active}
          onClose={() => setActive(null)}
          onShowSheet={setSheetResult}
        />
      )}

      <NutritionSheet
        result={sheetResult}
        open={sheetResult !== null}
        onClose={() => setSheetResult(null)}
      />
    </div>
  );
}

function ListingCard({ listing, index, onOpen }: { listing: DemoListing; index: number; onOpen: () => void }) {
  const isScam = listing.scenario === "olx_ai_scam";

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={onOpen}
      className={cn(
        "w-full text-left grid md:grid-cols-[200px,1fr,auto] gap-4 md:gap-6 items-center p-4 md:p-5 rounded-xl border bg-ink-800/40 hover:bg-ink-800/80 transition-colors",
        isScam ? "border-clash/30 hover:border-clash/60" : "border-ink-600/40 hover:border-amber-glow/40",
      )}
    >
      <div className="aspect-[4/3] md:aspect-square rounded-lg overflow-hidden bg-ink-700 relative">
        <img
          src={`data:image/jpeg;base64,${listing.images_b64[0]}`}
          alt={listing.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          {listing.has_manifest ? (
            <CrIcon status="verified" size="sm" />
          ) : (
            <CrIcon status="integrity_clash" size="sm" pulse={isScam} />
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-display text-xl md:text-2xl text-ink-50 leading-tight truncate">
            {listing.title}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-300 mb-2">
          <span className="flex items-center gap-1">
            <MapPin size={11} /> {listing.location}
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded-full border font-mono text-[10px] uppercase tracking-wider",
            listing.has_manifest
              ? "border-verified/40 text-verified"
              : "border-clash/40 text-clash",
          )}>
            {listing.has_manifest ? "Sprzedawca zweryfikowany" : "Brak weryfikacji"}
          </span>
        </div>
        <p className="text-sm text-ink-200 line-clamp-2 leading-relaxed">
          {listing.description}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 md:min-w-[140px]">
        <div className={cn(
          "font-display text-2xl md:text-3xl",
          isScam ? "text-clash" : "text-ink-50",
        )}>
          {listing.price}
        </div>
        <div className="text-xs text-ink-400 font-mono">
          @{listing.seller_name}
        </div>
        <ChevronRight size={16} className="text-ink-400 mt-2 hidden md:block" />
      </div>
    </motion.button>
  );
}

function ListingModal({
  listing, onClose, onShowSheet,
}: { listing: DemoListing; onClose: () => void; onShowSheet: (r: VerificationResult) => void }) {
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    Promise.all(
      listing.images_b64.map((b64) =>
        api.verifyImage(b64, {
          synthid_detected: listing.synthid_detected ?? false,
          ai_artifact_score: listing.ai_artifact_score,
        })
      )
    ).then(setResults);
  }, [listing]);

  const allClash = results.length > 0 && results.every((r) => r.status === "integrity_clash" || r.status === "unverified");
  const anyScam = listing.scenario === "olx_ai_scam";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="fixed inset-0 bg-ink-950/90 backdrop-blur-md z-30 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-5xl w-full bg-ink-800 rounded-xl border border-ink-600 overflow-hidden my-auto"
      >
        <div className="grid md:grid-cols-[1.4fr,1fr]">
          {/* Left: images */}
          <div className="bg-ink-900">
            <div className="aspect-[4/3] relative bg-ink-900">
              <img
                src={`data:image/jpeg;base64,${listing.images_b64[activeImage]}`}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
              {results[activeImage] && (
                <div className="absolute top-3 right-3">
                  <CrIcon
                    status={results[activeImage].status}
                    size="lg"
                    pulse={results[activeImage].status === "integrity_clash"}
                    onClick={() => onShowSheet(results[activeImage])}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 p-3 overflow-x-auto">
              {listing.images_b64.map((b64, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "w-16 h-16 rounded overflow-hidden border-2 flex-shrink-0 relative",
                    i === activeImage ? "border-amber-glow" : "border-transparent",
                  )}
                >
                  <img src={`data:image/jpeg;base64,${b64}`} className="w-full h-full object-cover" />
                  {results[i] && (
                    <div className="absolute bottom-0.5 right-0.5">
                      <CrIcon status={results[i].status} size="sm" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: details */}
          <div className="p-6 md:p-8 flex flex-col">
            <h2 className="font-display text-2xl md:text-3xl text-ink-50 leading-tight mb-3">
              {listing.title}
            </h2>
            <div className={cn(
              "font-display text-4xl mb-4",
              anyScam ? "text-clash" : "text-amber-glow",
            )}>
              {listing.price}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-300 mb-4">
              <MapPin size={11} />
              {listing.location}
            </div>

            <p className="text-sm text-ink-200 leading-relaxed mb-6">
              {listing.description}
            </p>

            <div className="text-xs text-ink-400 mb-6 font-mono">
              Sprzedawca: <span className="text-ink-100">{listing.seller_name}</span>
            </div>

            {/* Verification banner */}
            {allClash && anyScam && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-lg border border-clash/40 bg-clash/8 p-4 mb-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-clash flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="font-display text-clash mb-1">
                      Wszystkie zdjęcia w tym ogłoszeniu wyglądają na wygenerowane przez AI
                    </div>
                    <div className="text-xs text-ink-200 leading-relaxed">
                      Brak prowenancji + watermark SynthID + klasyfikator artefaktów
                      ({((listing.ai_artifact_score ?? 0) * 100).toFixed(0)}%).
                      Połączone z ceną odbiegającą od rynkowej (800 zł vs średnia 2400 zł)
                      i konstrukcją „wpłać zadatek" — to klasyczny wzorzec scamu.
                    </div>
                    <button
                      onClick={() => results[0] && onShowSheet(results[0])}
                      className="mt-3 text-xs text-clash hover:underline flex items-center gap-1"
                    >
                      Zobacz raport techniczny <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {!anyScam && results[0]?.status === "verified" && (
              <div className="rounded-lg border border-verified/30 bg-verified/5 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-verified flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="font-display text-verified text-sm mb-1">
                      Sprzedawca zweryfikowany sprzętowo
                    </div>
                    <div className="text-xs text-ink-200 leading-relaxed">
                      Wszystkie zdjęcia podpisane przez {results[0].author?.device_label}.
                      Treść niezmieniona od momentu zrobienia.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 flex gap-2">
              <button
                disabled={anyScam}
                className={cn(
                  "flex-1 py-3 rounded-lg font-medium transition-colors text-sm",
                  anyScam
                    ? "bg-ink-700/40 text-ink-400 cursor-not-allowed"
                    : "bg-amber-glow text-ink-900 hover:bg-amber-glow/90",
                )}
              >
                {anyScam ? "Zablokowane przez TrustLayer" : "Skontaktuj się ze sprzedawcą"}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-lg border border-ink-500 text-ink-200 hover:bg-ink-700/40 text-sm"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
