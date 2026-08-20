import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const LIMITS = {
  chat: 10,
  generate: 4,
} as const;

type Scope = keyof typeof LIMITS;

const hits = new Map<string, number[]>();

/**
 * Sliding window. Returns true if the request is allowed.
 * In-memory only — protects Gemini free-tier quota on a single serverless instance.
 */
export function checkIpLimit(ip: string, scope: Scope = "chat"): boolean {
  const key = `${scope}:${ip || "unknown"}`;
  const now = Date.now();
  const limit = LIMITS[scope];
  const recent = (hits.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function retryAfterSeconds(): number {
  return Math.ceil(WINDOW_MS / 1000);
}
