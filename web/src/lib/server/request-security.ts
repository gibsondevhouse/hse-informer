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

function identityFormOrigin(): string | null {
  if (process.env.DEV_AUTH === 'synthetic') return null;
  const configured = process.env.OIDC_ISSUER;
  if (!configured || /[\s\u0000-\u001f\u007f]/.test(configured)) return null;
  try {
    const issuer = new URL(configured);
    if (issuer.username || issuer.password || issuer.search || issuer.hash
      || !/^(?:[a-z0-9.-]+|\[[a-f0-9:.]+\])$/i.test(issuer.hostname)) return null;
    const localHttp = process.env.NODE_ENV !== 'production' && issuer.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(issuer.hostname);
    if (issuer.protocol !== 'https:' && !localHttp) return null;
    return issuer.origin;
  } catch { return null; }
}

function allowIdentityFormRedirect(response: Response): void {
  if (response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'text/html') return;
  const policy = response.headers.get('Content-Security-Policy');
  const origin = identityFormOrigin();
  if (!policy || !origin) return;
  // Chromium checks the initiating page's form-action on a POST redirect too.
  // Extend only an existing self policy; retain every other directive/nonce.
  const updated = policy.replace(/(^|[;,])(\s*form-action\s+)([^;,]*)/gi, (directive, separator, name, value: string) => {
    const sources = value.trim().split(/\s+/);
    if (!sources.includes("'self'") || sources.includes("'none'") || sources.includes(origin)) return directive;
    return `${separator}${name}${value.trimEnd()} ${origin}${value.slice(value.trimEnd().length)}`;
  });
  if (updated !== policy) response.headers.set('Content-Security-Policy', updated);
}

export function secureResponse(response: Response, url: URL): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (url.protocol === 'https:') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  allowIdentityFormRedirect(response);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) response.headers.set('Cache-Control', 'no-store');
  return response;
}
