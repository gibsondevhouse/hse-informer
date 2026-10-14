import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '../src/lib/server/auth';

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
