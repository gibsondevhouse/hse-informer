import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessToken } from '../lib/server/access-token.ts';

const issuer = 'https://pilot.cloudflareaccess.com';
const audience = 'hse-pilot';

async function signer() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
  publicKey.kid = 'test-key';
  const fetcher = async () => Response.json({ keys: [publicKey] });
  const sign = async (claims) => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(input));
    return `${input}.${Buffer.from(signature).toString('base64url')}`;
  };
  return { sign, fetcher };
}

test('accepts a signed Access identity with exact issuer and audience', async () => {
  const { sign, fetcher } = await signer();
  const token = await sign({ sub: 'access-user-1', email: 'Worker@Example.com', iss: issuer, aud: [audience], exp: Math.floor(Date.now() / 1000) + 300 });
  assert.deepEqual(await verifyAccessToken(token, issuer, audience, fetcher), {
    sub: 'access-user-1', email: 'worker@example.com',
  });
});

test('rejects wrong audience, expired tokens, and a tampered signature', async () => {
  const testIssuer = 'https://pilot-rejection.cloudflareaccess.com';
  const { sign, fetcher } = await signer();
  const base = { sub: 'access-user-1', email: 'worker@example.com', iss: testIssuer, aud: audience, exp: Math.floor(Date.now() / 1000) + 300 };
  await assert.rejects(verifyAccessToken(await sign({ ...base, aud: 'other-app' }), testIssuer, audience, fetcher), /claims/);
  await assert.rejects(verifyAccessToken(await sign({ ...base, exp: 1 }), testIssuer, audience, fetcher), /claims/);
  const token = await sign(base);
  const parts = token.split('.');
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ ...base, email: 'intruder@example.com' })).toString('base64url')}.${parts[2]}`;
  await assert.rejects(verifyAccessToken(tampered, testIssuer, audience, fetcher), /signature/);
});
