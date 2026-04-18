"use client";

import { motion } from "framer-motion";
import type { VerificationStatus } from "@/lib/api";
import { cn, statusColor, statusShortLabel } from "@/lib/utils";

interface Props {
  status: VerificationStatus;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CrIcon({ status, size = "md", pulse = false, onClick, className }: Props) {
  const sizes = {
    sm: "w-5 h-5 text-[0.55rem]",
    md: "w-6 h-6 text-[0.6rem]",
    lg: "w-8 h-8 text-xs",
  };

  const ring = {
    verified:        "border-verified/60 bg-verified/8",
    recovered:       "border-recovered/60 bg-recovered/8",
    integrity_clash: "border-clash/70 bg-clash/12",
    tampered:        "border-clash/70 bg-clash/12",
    unverified:      "border-unverified/60 bg-unverified/10",
  }[status];

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border font-display font-medium leading-none",
        sizes[size],
        ring,
        statusColor(status),
        onClick && "cursor-pointer",
        className,
      )}
      aria-label={`Content Credentials: ${status}`}
    >
      {/* Litery CR — zawsze widoczne, kropka statusowa w rogu */}
      <span className="tracking-tight">CR</span>

      {/* Kropka statusu w prawym górnym rogu */}
      <span className={cn(
        "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
        status === "verified"        && "bg-verified",
        status === "recovered"       && "bg-recovered",
        status === "integrity_clash" && "bg-clash",
        status === "tampered"        && "bg-clash",
        status === "unverified"      && "bg-unverified",
        pulse && "animate-pulse-soft",
      )} />

      <span className="sr-only">{statusShortLabel(status)}</span>
    </motion.button>
  );
}
