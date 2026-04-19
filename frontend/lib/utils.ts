import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { VerificationStatus } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;

  if (diff < 60_000) return "teraz";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 86400_000) {
    return d.toLocaleDateString("pl-PL", { weekday: "short" });
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export function statusColor(status: VerificationStatus): string {
  switch (status) {
    case "verified":         return "text-verified";
    case "recovered":        return "text-recovered";
    case "integrity_clash":
    case "tampered":         return "text-clash";
    case "unverified":       return "text-unverified";
  }
}

export function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case "verified":        return "Zweryfikowane";
    case "recovered":       return "Odzyskane (soft binding)";
    case "integrity_clash": return "Niespójność integralności";
    case "tampered":        return "Zmodyfikowane";
    case "unverified":      return "Niezweryfikowane";
  }
}

export function statusShortLabel(status: VerificationStatus): string {
  switch (status) {
    case "verified":        return "OK";
    case "recovered":       return "≈";
    case "integrity_clash": return "!";
    case "tampered":        return "✕";
    case "unverified":      return "?";
  }
}
