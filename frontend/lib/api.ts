// Typed API client. Wszystkie endpointy proksowane przez next.config rewrites.

export type VerificationStatus =
  | "verified"
  | "recovered"
  | "integrity_clash"
  | "tampered"
  | "unverified";

export type ClashVerdict = "none" | "suspected" | "confirmed";

export interface Author {
  identifier?: string;
  display_name?: string;
  avatar?: string;
  device_label?: string;
  hardware_backed?: boolean;
  credential_id?: string;
}

export interface ClashReport {
  verdict: ClashVerdict;
  reasons: string[];
  score: number;
}

export interface Manifest {
  version: string;
  assertions: Array<{ label: string; data: any; hash: string }>;
  claim: {
    claim_generator: string;
    instance_id: string;
    timestamp: number;
    assertion_hashes: Array<{ label: string; hash: string }>;
    signing_credential_id: string;
  } | null;
  signature: {
    algorithm: string;
    value: string;
    public_key: string;
    credential_id: string;
  } | null;
  parent_manifest_id: string | null;
}

export interface VerificationResult {
  status: VerificationStatus;
  manifest: Manifest | null;
  soft_match_distance: number | null;
  signature_valid: boolean | null;
  hard_hash_match: boolean | null;
  clash: ClashReport | null;
  author: Author | null;
  summary: string;
  badges: string[];
  details: Record<string, any>;
}

export interface KeystrokeEvent {
  t: number;
  type: "down" | "up";
}

// --- demo types ---

export interface DemoChat {
  id: string;
  name: string;
  avatar: string;
  user_id: string;
  trusted_credential_id: string | null;
  is_trusted_contact: boolean;
}

export interface DemoMessage {
  id: string;
  chat_id: string;
  sender: string;
  text: string;             // może mieć VS-y
  plain_text: string;
  manifest_id: string | null;
  timestamp: number;
  has_manifest: boolean;
  is_scam: boolean;
  scenario?: string;
}

export interface DemoPhoto {
  id: string;
  title: string;
  image_b64: string;
  manifest_id: string | null;
  has_manifest: boolean;
  is_deepfake: boolean;
  scenario?: string;
  synthid_detected?: boolean;
  ai_artifact_score?: number;
  declared_real_person_id?: string;
}

export interface DemoListing {
  id: string;
  title: string;
  price: string;
  location: string;
  description: string;
  seller: string;
  seller_name: string;
  images_b64: string[];
  has_manifest: boolean;
  scenario?: string;
  synthid_detected?: boolean;
  ai_artifact_score?: number;
}

// --- API methods ---

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function jpost<T>(path: string, body: any): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${path}: ${r.status} ${text}`);
  }
  return r.json();
}

export const api = {
  health: () => jget<{ ok: boolean }>("/api/health"),

  whatsapp: () => jget<{ chats: DemoChat[]; messages: DemoMessage[] }>("/api/demo/whatsapp"),
  gallery: () => jget<{ photos: DemoPhoto[] }>("/api/demo/gallery"),
  olx: () => jget<{ listings: DemoListing[] }>("/api/demo/olx"),
  listing: (id: string) => jget<DemoListing>(`/api/demo/olx/${id}`),
  resetDemo: () => jpost<{ ok: boolean }>("/api/demo/reset", {}),

  verifyText: (text: string, keystrokes?: KeystrokeEvent[], ai_text_score?: number) =>
    jpost<VerificationResult>("/api/verify/text", {
      text,
      keystrokes: keystrokes || [],
      ai_text_score: ai_text_score ?? null,
    }),

  verifyImage: (
    image_b64: string,
    opts: {
      declared_real_person_id?: string;
      synthid_detected?: boolean;
      ai_artifact_score?: number;
    } = {}
  ) =>
    jpost<VerificationResult>("/api/verify/image", {
      image_b64,
      declared_real_person_id: opts.declared_real_person_id ?? null,
      synthid_detected: opts.synthid_detected ?? false,
      ai_artifact_score: opts.ai_artifact_score ?? null,
    }),

  signText: (req: {
    text: string;
    user_id: string;
    credential_id: string;
    keystrokes: KeystrokeEvent[];
    declared_ai?: boolean;
  }) =>
    jpost<{
      manifest_id: string;
      plain_text: string;
      embedded_text: string;
      hard_hash: string;
      soft_hash: string;
      manifest: Manifest;
    }>("/api/sign/text", { ...req, use_server_key: true, declared_ai: req.declared_ai ?? false }),
};
