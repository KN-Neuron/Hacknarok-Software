"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, AlertTriangle, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { api, type DemoPhoto, type VerificationResult } from "@/lib/api";
import { CrIcon } from "@/components/nutrition/CrIcon";
import { NutritionSheet } from "@/components/nutrition/NutritionSheet";
import { SocialFeed } from "@/components/gallery/SocialFeed";

export default function GalleryPage() {
  const [photos, setPhotos] = useState<DemoPhoto[]>([]);
  const [activePhoto, setActivePhoto] = useState<DemoPhoto | null>(null);
  const [sheetResult, setSheetResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    api.gallery().then((d) => setPhotos(d.photos));
  }, []);

  const realPhotos = photos.filter((p) => !p.is_deepfake);
  const fakePhotos = photos.filter((p) => p.is_deepfake);

  return (
    <div className="relative z-10 min-h-screen px-6 md:px-12 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <Link href="/" className="flex items-center gap-2 text-ink-300 hover:text-ink-50 transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">TrustLayer</span>
        </Link>
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-amber-glow" />
          <span className="text-sm font-display">Galeria · Anna Kowalska</span>
        </div>
      </header>

      {/* Title */}
      <section className="mb-16">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-glow mb-4 font-mono">
          Scenariusz 02 — Personal Alibi
        </div>
        <h1 className="font-display text-4xl md:text-6xl text-ink-50 leading-tight mb-6 max-w-3xl">
          Pięć autentycznych zdjęć.
          <br />
          <em className="italic text-amber-glow">Jedno fałszywe.</em>
        </h1>
        <p className="text-lg text-ink-200 leading-relaxed max-w-2xl">
          Anna używa Pixel 9 Pro z chipem Titan M2 — każde zdjęcie z aparatu jest podpisywane
          jej kluczem sprzętowym, którego nikt nie potrafi odtworzyć. To <em>cyfrowe alibi</em>:
          gdy ktoś opublikuje deepfake udający ją, brak podpisu jest dowodem matematycznym.
        </p>
      </section>

      {/* Real photos grid */}
      <section className="mb-20">
        <SectionHeading
          eyebrow="Galeria autentyczna"
          title="Zdjęcia z urządzenia Anny"
          right={
            <div className="flex items-center gap-2 text-xs text-verified font-mono">
              <ShieldCheck size={12} />
              {realPhotos.length} podpisane przez Pixel 9 Pro · Titan M2
            </div>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
          {realPhotos.map((p, i) => (
            <PhotoCard
              key={p.id}
              photo={p}
              index={i}
              onClick={() => setActivePhoto(p)}
            />
          ))}
        </div>
      </section>

      {/* Deepfake section — strong visual hook */}
      <section>
        <SectionHeading
          eyebrow="Wykryto"
          title="Treść opublikowana w sieci"
          right={
            <div className="flex items-center gap-2 text-xs text-clash font-mono">
              <AlertTriangle size={12} />
              Personal Alibi mismatch
            </div>
          }
        />

        <div className="mt-6 grid md:grid-cols-2 gap-px rounded-xl overflow-hidden border border-clash/30 bg-ink-800">
          {fakePhotos.map((p) => (
            <DeepfakeCard
              key={p.id}
              photo={p}
              onClick={() => setActivePhoto(p)}
            />
          ))}
          <ReportCard photo={fakePhotos[0]} />
        </div>
      </section>

      {/* Social feed — full spectrum of verification states */}
      <section className="mt-24">
        <SectionHeading
          eyebrow="Scenariusz 02b — Cross-checking w social media"
          title="Te same zdjęcia, różne źródła"
          right={
            <div className="flex items-center gap-2 text-xs text-ink-400 font-mono">
              <ShieldCheck size={12} />
              verified · recovered · clash · tampered · unverified
            </div>
          }
        />
        <p className="text-sm text-ink-300 leading-relaxed mt-4 max-w-2xl">
          Co się dzieje, gdy te same treści krążą po Instagramie, X i LinkedIn? TrustLayer
          pokazuje cały spektrum: legalne AI z deklaracją, repost z odzyskanym podpisem,
          deepfake na koncie udającym redakcję i oryginał, którego ktoś subtelnie podretuszował.
        </p>

        <div className="mt-6">
          <SocialFeed photos={photos} />
        </div>
      </section>

      {/* Photo detail modal */}
      {activePhoto && (
        <PhotoModal
          photo={activePhoto}
          onClose={() => setActivePhoto(null)}
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

// ---------- helpers ----------

function SectionHeading({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b border-ink-600/40 pb-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-ink-400 mb-1 font-mono">
          {eyebrow}
        </div>
        <h2 className="font-display text-2xl md:text-3xl text-ink-50">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function PhotoCard({ photo, index, onClick }: { photo: DemoPhoto; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative aspect-square rounded-lg overflow-hidden bg-ink-700 border border-ink-600/40 hover:border-amber-glow/40 transition-all"
    >
      <img
        src={`data:image/jpeg;base64,${photo.image_b64}`}
        alt={photo.title}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 right-2">
        <CrIcon status="verified" size="sm" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-ink-950/90 to-transparent">
        <div className="text-xs text-ink-100 truncate">{photo.title}</div>
      </div>
    </motion.button>
  );
}

function DeepfakeCard({ photo, onClick }: { photo: DemoPhoto; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative aspect-[4/3] bg-ink-700 group">
      <img
        src={`data:image/jpeg;base64,${photo.image_b64}`}
        alt={photo.title}
        className="w-full h-full object-cover opacity-90"
      />
      {/* Diagonal stripe overlay */}
      <div className="absolute inset-0 bg-clash/10" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(226,92,74,0.06) 12px, rgba(226,92,74,0.06) 13px)`,
        }}
      />

      <div className="absolute top-3 right-3">
        <CrIcon status="integrity_clash" size="lg" pulse />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent">
        <div className="text-[10px] uppercase tracking-wider text-clash font-mono mb-1">
          Brak Personal Alibi
        </div>
        <div className="text-ink-50 font-display text-lg leading-snug">
          Rzekome zdjęcie Anny —<br />
          <em className="italic text-clash">deepfake</em>
        </div>
      </div>
    </button>
  );
}

function ReportCard({ photo }: { photo: DemoPhoto }) {
  if (!photo) return null;

  return (
    <div className="bg-ink-800 p-6 md:p-8 flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.25em] text-clash mb-2 font-mono flex items-center gap-2">
        <FileText size={12} />
        Raport dla moderatora platformy
      </div>
      <h3 className="font-display text-2xl text-ink-50 mb-5 leading-tight">
        Trzy dowody negatywne
      </h3>

      <div className="space-y-4 flex-1">
        <Evidence
          n="01"
          title="Brak podpisu sprzętowego ofiary"
          body="Anna ma zarejestrowane urządzenie Pixel 9 Pro (Titan M2). Treść NIE pochodzi z tego urządzenia — żaden z 5 jej autentycznych zdjęć nie ma takiej cechy."
        />
        <Evidence
          n="02"
          title="Watermark AI obecny"
          body="W pikselach wykryto sygnał Google SynthID — niewidzialny znacznik wstrzykiwany przez modele generatywne."
        />
        <Evidence
          n="03"
          title="Klasyfikator artefaktów"
          body={`Model wykrywający artefakty generatywne ocenia treść na ${(photo.ai_artifact_score! * 100).toFixed(0)}% prawdopodobieństwa AI.`}
        />
      </div>

      <div className="mt-6 pt-4 border-t border-ink-600/40 text-xs text-ink-400 leading-relaxed">
        Raport spełnia wymogi dowodowe dla NCII (Non-Consensual Intimate Imagery)
        zgodnie z UK Online Safety Act i EU Digital Services Act.
      </div>
    </div>
  );
}

function Evidence({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[auto,1fr] gap-3 items-start">
      <div className="font-mono text-clash text-xs pt-0.5">{n}</div>
      <div>
        <div className="text-ink-50 text-sm font-medium leading-snug">{title}</div>
        <div className="text-ink-300 text-xs leading-relaxed mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function PhotoModal({
  photo, onClose, onShowSheet,
}: { photo: DemoPhoto; onClose: () => void; onShowSheet: (r: VerificationResult) => void }) {
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    setVerifying(true);
    api.verifyImage(photo.image_b64, {
      declared_real_person_id: photo.declared_real_person_id,
      synthid_detected: photo.synthid_detected ?? false,
      ai_artifact_score: photo.ai_artifact_score,
    })
      .then(setResult)
      .finally(() => setVerifying(false));
  }, [photo]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="fixed inset-0 bg-ink-950/90 backdrop-blur-md z-30 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-3xl w-full bg-ink-800 rounded-xl border border-ink-600 overflow-hidden"
      >
        <div className="aspect-video bg-ink-900 relative">
          <img
            src={`data:image/jpeg;base64,${photo.image_b64}`}
            alt={photo.title}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="p-5 flex items-center justify-between border-t border-ink-600/40">
          <div>
            <div className="font-display text-lg text-ink-50">{photo.title}</div>
            <div className="text-xs text-ink-400 mt-0.5 font-mono">
              {verifying ? "Weryfikacja..." : result?.summary}
            </div>
          </div>
          <button
            onClick={() => result && onShowSheet(result)}
            disabled={!result}
            className="flex items-center gap-2 text-sm text-amber-glow hover:text-amber-glow/80 disabled:text-ink-400 transition-colors"
          >
            Zobacz manifest <ExternalLink size={14} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
