/** Per-process limits complement the ingress limiter; keys use validated identities or socket addresses. */
export class RequestLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(private readonly maxKeys = 10_000) {}
  take(key: string, limit: number, windowMs: number, now = Date.now()): number {
    const previous = this.buckets.get(key);
    if (!previous || previous.until <= now) {
      if (this.buckets.size >= this.maxKeys) {
        for (const [candidate, value] of this.buckets) if (value.until <= now) this.buckets.delete(candidate);
        if (this.buckets.size >= this.maxKeys && !previous) return Math.ceil(windowMs / 1000);
      }
      this.buckets.set(key, { count: 1, until: now + windowMs });
      return 0;
    }
    if (previous.count >= limit) return Math.ceil((previous.until - now) / 1000);
    previous.count++;
    return 0;
  }
}

export function requestLimit(path: string, method: string): { group: string; limit: number } | null {
  if (path === '/api/activate' && method === 'POST') return { group: 'activation', limit: 10 };
  if (path === '/auth/login' || path === '/auth/callback') return { group: 'signin', limit: 30 };
  if (path.match(/^\/api\/people\/[^/]+\/account$/) && method === 'POST') return { group: 'account', limit: 12 };
  if (path === '/api/completions/export') return { group: 'export', limit: 30 };
  return null;
}

export function secureResponse(response: Response, url: URL): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) response.headers.set('Cache-Control', 'no-store');
  return response;
}
