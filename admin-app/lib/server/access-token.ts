export type AccessIdentity = { sub: string; email: string };

type AccessClaims = {
  sub?: unknown;
  email?: unknown;
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
};

const jwksCache = new Map<string, { expires: number; keys: JsonWebKey[] }>();

function decodeBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(input))) as T;
}

async function getKeys(issuer: string, fetcher: typeof fetch, refresh = false): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(issuer);
  if (!refresh && cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetcher(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('Access key lookup failed');
  const body = (await response.json()) as { keys?: JsonWebKey[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error('Access key response is invalid');
  }
  jwksCache.set(issuer, { expires: Date.now() + 5 * 60_000, keys: body.keys });
  return body.keys;
}

/** Verify Cloudflare Access JWT signature and required claims before trusting identity. */
export async function verifyAccessToken(
  token: string,
  issuer: string,
  audience: string,
  fetcher: typeof fetch = fetch,
): Promise<AccessIdentity> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid Access token');
  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Access token');
  const keys = await getKeys(issuer, fetcher);
  let jwk = keys.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid && key.kty === 'RSA');
  if (!jwk) {
    const refreshed = await getKeys(issuer, fetcher, true);
    jwk = refreshed.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid && key.kty === 'RSA');
  }
  if (!jwk) throw new Error('Unknown Access signing key');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const bytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as unknown as BufferSource, bytes as unknown as BufferSource);
  if (!valid) throw new Error('Invalid Access signature');

  const claims = decodeJson<AccessClaims>(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== issuer ||
    !(typeof claims.aud === 'string'
      ? claims.aud === audience
      : Array.isArray(claims.aud) && claims.aud.includes(audience)) ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    (typeof claims.nbf === 'number' && claims.nbf > now) ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)
  ) {
    throw new Error('Invalid Access claims');
  }
  return { sub: claims.sub, email: claims.email.toLowerCase() };
}
