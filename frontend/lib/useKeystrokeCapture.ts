"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Event shape wysyłana do backendu (`/api/verify/text`).
 * Zgodna z `KeystrokeEvent` z `@/lib/api`.
 */
export type KeystrokeEvent = {
  t: number;
  type: "down" | "up";
};

/**
 * Score wyliczany lokalnie z rytmu pisania.
 * Używany do kolorowania "Behawior" bara i jako hint przed wysłaniem.
 */
export type BehaviorScore = {
  keystrokeCount: number;
  /** 0..1, gdzie 1 = bardzo ludzki rytm, 0 = regularny/bot/paste */
  confidence: number;
  looksHuman: boolean;
};

const MIN_EVENTS_FOR_SCORE = 3;

/**
 * Bardzo prosta heurystyka:
 *  - bot / paste: wszystkie odstępy prawie równe (niski CV) albo zero-delay (paste)
 *  - człowiek: duża zmienność odstępów (wysoki CV)
 *
 * Zwraca confidence w [0,1].
 */
function computeScore(events: KeystrokeEvent[]): BehaviorScore {
  const downs = events.filter((e) => e.type === "down");
  const keystrokeCount = downs.length;

  if (keystrokeCount < MIN_EVENTS_FOR_SCORE) {
    return { keystrokeCount, confidence: 0, looksHuman: false };
  }

  // Interwały między kolejnymi keydown
  const intervals: number[] = [];
  for (let i = 1; i < downs.length; i++) {
    intervals.push(Math.max(1, downs[i].t - downs[i - 1].t));
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / intervals.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / Math.max(1, mean); // coefficient of variation

  // Paste: jeśli mediana interwałów < 10ms, to ktoś wkleił
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const pasteLike = median < 10;

  // Mapa CV -> confidence. Człowiek ma zwykle CV ~0.4–1.2.
  // CV < 0.15 = podejrzanie regularne, CV > 0.35 = zdecydowanie ludzkie.
  let confidence = Math.min(1, Math.max(0, (cv - 0.1) / 0.4));

  if (pasteLike) {
    confidence = Math.min(confidence, 0.1);
  }

  // Bardzo krótkie mean (poniżej 25 ms między klawiszami) to macro/bot.
  if (mean < 25) {
    confidence = Math.min(confidence, 0.15);
  }

  const looksHuman = confidence >= 0.55;

  return { keystrokeCount, confidence, looksHuman };
}

export function useKeystrokeCapture() {
  const eventsRef = useRef<KeystrokeEvent[]>([]);
  const [tick, setTick] = useState(0); // wymuszenie re-renderu po każdym keystroke

  const onKeyDown = useCallback(() => {
    eventsRef.current.push({ t: performance.now(), type: "down" });
    setTick((n) => n + 1);
  }, []);

  const onKeyUp = useCallback(() => {
    eventsRef.current.push({ t: performance.now(), type: "up" });
    setTick((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    eventsRef.current = [];
    setTick((n) => n + 1);
  }, []);

  const getEvents = useCallback((): KeystrokeEvent[] => {
    return [...eventsRef.current];
  }, []);

  // Re-compute na każdy tick — tanie, bo tablica krótka.
  const score = useMemo<BehaviorScore>(
    () => computeScore(eventsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  return { onKeyDown, onKeyUp, score, reset, getEvents };
}
