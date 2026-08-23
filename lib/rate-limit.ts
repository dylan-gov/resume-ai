import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * In-memory fallback limiter for local dev / deployments without Redis
 * configured. Per-instance only (resets on cold start, not shared across
 * serverless instances) — acceptable for Phase 1; @upstash/ratelimit
 * takes over automatically once Redis env vars are present.
 */
class InMemoryRateLimiter {
  private hits = new Map<string, number[]>();

  limit(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const existing = (this.hits.get(identifier) ?? []).filter((t) => t > windowStart);

    if (existing.length >= MAX_REQUESTS_PER_WINDOW) {
      this.hits.set(identifier, existing);
      return { success: false, remaining: 0 };
    }

    existing.push(now);
    this.hits.set(identifier, existing);
    return { success: true, remaining: MAX_REQUESTS_PER_WINDOW - existing.length };
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

const upstashLimiter =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_WINDOW, "60 s"),
        analytics: false,
        prefix: "resume-ai:generate",
      })
    : null;

/**
 * Per-IP rate limit for the /api/generate route. Uses Upstash Redis when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are configured, and
 * silently falls back to an in-memory limiter otherwise — this must never
 * throw or block requests just because Redis isn't set up.
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (upstashLimiter) {
    const { success, remaining } = await upstashLimiter.limit(identifier);
    return { success, remaining };
  }
  return inMemoryLimiter.limit(identifier);
}
