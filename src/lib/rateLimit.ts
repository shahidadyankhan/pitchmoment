/**
 * In-memory sliding-window limiter per client IP — a cost guard so a public
 * deployment can't be used to burn through your video credits.
 */
const g = globalThis as unknown as { __pitchHits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__pitchHits ??= new Map());

const WINDOW_MS = 60 * 60 * 1000;

export function checkRateLimit(ip: string): { ok: true } | { ok: false; retryInMin: number } {
  const limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
  if (!limit || limit <= 0) return { ok: true };

  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    const retryInMin = Math.ceil((WINDOW_MS - (now - recent[0])) / 60_000);
    hits.set(ip, recent);
    return { ok: false, retryInMin };
  }
  recent.push(now);
  hits.set(ip, recent);
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
