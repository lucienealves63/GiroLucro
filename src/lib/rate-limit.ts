/**
 * Rate limit simples em memória (por instância do servidor).
 *
 * Em serverless cada região/instância tem seu próprio contador — é o
 * suficiente para frear spam e abuso acidental de formulários públicos.
 * Persistência real (por IP no banco) é checada nas rotas que podem,
 * como o formulário de contato.
 */

type Bucket = { count: number; resetAt: number };

const globalForLimits = globalThis as typeof globalThis & {
  __glRateBuckets?: Map<string, Bucket>;
};

const buckets = globalForLimits.__glRateBuckets ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalForLimits.__glRateBuckets = buckets;

export type RateCheck = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

export function checkRate(key: string, limit: number, windowMs: number): RateCheck {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, remaining: Math.max(0, limit - 1) };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, remaining: Math.max(0, limit - bucket.count) };
}

/** IP real do visitante atrás da Vercel/Cloudflare (nunca guardado puro — só hasheado). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "desconhecido";
}
