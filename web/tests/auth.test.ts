import { describe, expect, it } from 'vitest';
import { identityTokenCurrent, safeReturnTo, type Actor } from '../src/lib/server/auth';

describe('OIDC return path', () => {
  const origin = 'https://hse.example.test';

  it('accepts a same-origin route with query parameters', () => {
    expect(safeReturnTo('/assignments?site=tifton', origin)).toBe('/assignments?site=tifton');
  });

  it('rejects protocol-relative, backslash, and control-character redirects', () => {
    for (const target of ['//evil.example', '/\\evil.example', '/assignments\nevil',
      'https://evil.example', '\\evil.example']) {
      expect(safeReturnTo(target, origin)).toBe('/');
    }
  });
});

describe('identity token revocation cutoff',()=>{
  const actor={authValidAfter:'2026-10-24T12:00:00.500Z'} as Actor;
  const second=Date.parse('2026-10-24T12:00:00Z')/1000;
  it('rejects tokens from before the exact cutoff including the same NumericDate second',()=>{
    expect(identityTokenCurrent(actor,second-1)).toBe(false);
    expect(identityTokenCurrent(actor,second)).toBe(false);
    expect(identityTokenCurrent(actor,second+1)).toBe(true);
  });
  it('fails closed without a valid issued-at or persisted cutoff',()=>{
    for(const issuedAt of[undefined,'123',NaN,Infinity])expect(identityTokenCurrent(actor,issuedAt)).toBe(false);
    expect(identityTokenCurrent({}as Actor,second+1)).toBe(false);
  });
});
