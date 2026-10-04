import { describe, expect, it } from 'vitest';
import domains from '../../src/shared/google-domains.json' with { type: 'json' };
import {
  SEARCH_PATHS,
  assertDomains,
  isSupportedPath,
  matchPatterns,
} from '../../src/shared/match-patterns.ts';

describe('SEARCH_PATHS', () => {
  it('lists exactly the four supported paths', () => {
    expect([...SEARCH_PATHS]).toEqual(['/', '/?*', '/search*', '/webhp*']);
  });
});

describe('matchPatterns()', () => {
  it('produces four https://www. patterns per domain, in order', () => {
    expect(matchPatterns(['google.com'])).toEqual([
      'https://www.google.com/',
      'https://www.google.com/?*',
      'https://www.google.com/search*',
      'https://www.google.com/webhp*',
    ]);
  });

  it('handles multi-label country domains', () => {
    const p = matchPatterns(['google.co.uk', 'google.com.br']);
    expect(p).toHaveLength(8);
    expect(p).toContain('https://www.google.co.uk/search*');
    expect(p).toContain('https://www.google.com.br/webhp*');
    expect(p).toContain('https://www.google.com.br/?*');
  });

  it('returns nothing for an empty list', () => {
    expect(matchPatterns([])).toEqual([]);
  });

  it('only ever matches https on the www host', () => {
    for (const p of matchPatterns(['google.com', 'google.de', 'google.co.jp'])) {
      expect(p.startsWith('https://www.google.')).toBe(true);
      expect(p).not.toContain('http://');
      expect(p).not.toContain('*.');
    }
  });

  it('does not match subdomains or other hosts', () => {
    const p = matchPatterns(['google.com']);
    expect(p.some((x) => x.includes('mail.google.com'))).toBe(false);
    expect(p.some((x) => x.includes('news.google.com'))).toBe(false);
    expect(p.some((x) => x.includes('<all_urls>'))).toBe(false);
  });

  it('is rejected as a whole if any domain is invalid', () => {
    expect(() => matchPatterns(['google.com', 'evil.com'])).toThrow(/Invalid Google domain/);
  });
});

describe('assertDomains()', () => {
  it.each([
    'google.com',
    'google.de',
    'google.co.uk',
    'google.com.br',
    'google.co.jp',
    'google.ad',
  ])('accepts %s', (d) => expect(() => assertDomains([d])).not.toThrow());

  it.each([
    ['another site', 'evil.com'],
    ['path suffix', 'evil.com/x'],
    ['path on a real domain', 'google.com/x'],
    ['suffix attack', 'google.com.evil.com'],
    ['prefix attack', 'notgoogle.com'],
    ['bare label', 'google'],
    ['trailing dot', 'google.'],
    ['wildcard subdomain', '*.google.com'],
    ['wildcard tld', 'google.*'],
    ['subdomain', 'www.google.com'],
    ['uppercase', 'GOOGLE.COM'],
    ['mixed case', 'google.Com'],
    ['empty', ''],
    ['whitespace', ' '],
    ['inner space', 'google .com'],
    ['leading space', ' google.com'],
    ['trailing newline', 'google.com\n'],
    ['scheme', 'https://google.com'],
    ['port', 'google.com:443'],
    ['three-level country', 'google.co.uk.x'],
    ['digit tld', 'google.c0m'],
    ['one-letter tld', 'google.c'],
    ['four-letter tld', 'google.comm'],
  ])('rejects %s (%j)', (_name, d) => {
    expect(() => assertDomains([d])).toThrow(/Invalid Google domain/);
  });
});

describe('the committed Google domain list', () => {
  it('is large, unique and contains google.com first', () => {
    expect(domains.length).toBeGreaterThan(150);
    expect(domains[0]).toBe('google.com');
    expect(domains).toContain('google.co.uk');
    expect(domains).toContain('google.de');
    expect(domains).toContain('google.com.br');
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('has every entry accepted by assertDomains()', () => {
    expect(() => assertDomains(domains)).not.toThrow();
    for (const d of domains) expect(d, d).toMatch(/^google(\.[a-z]{2,3}){1,2}$/);
  });

  it('turns into patterns that fit the manifest rules', () => {
    const all = matchPatterns(domains);
    expect(all).toHaveLength(domains.length * SEARCH_PATHS.length);
    for (const p of all) {
      expect(p).toMatch(/^https:\/\/www\.google\.[a-z.]+\//);
      expect(p.split('/')[2]).not.toContain('*');
    }
  });
});

describe('isSupportedPath()', () => {
  it.each(['/', '/search', '/webhp', '/search/', '/webhp/x'])('accepts %s', (p) =>
    expect(isSupportedPath(p)).toBe(true),
  );
  it.each(['/maps', '/imghp', '/accounts', '/s', '', '/Search', '/x/search', '/url'])(
    'rejects %j',
    (p) => expect(isSupportedPath(p)).toBe(false),
  );
});
