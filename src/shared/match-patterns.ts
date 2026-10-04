/**
 * Paths Gemino runs on, relative to https://www.google.<tld>. Match-pattern paths include the
 * query string, so the homepage needs both `/` and `/?*` (e.g. `/?hl=de`).
 */
export const SEARCH_PATHS = ['/', '/?*', '/search*', '/webhp*'] as const;

const DOMAIN_RE = /^google(\.[a-z]{2,3}){1,2}$/;

/** Throws on anything that is not a plain google.<tld> / google.co.<tld> style host. */
export function assertDomains(domains: readonly string[]): void {
  for (const d of domains) {
    if (!DOMAIN_RE.test(d)) throw new Error(`Invalid Google domain: ${d}`);
  }
}

/**
 * Chrome match patterns cannot express `google.*`, so every domain is listed explicitly.
 * Only https on the www host is matched.
 */
export function matchPatterns(domains: readonly string[]): string[] {
  assertDomains(domains);
  return domains.flatMap((d) => SEARCH_PATHS.map((p) => `https://www.${d}${p}`));
}

/** Whether a page path is one Gemino should act on (defence in depth for the content script). */
export function isSupportedPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/webhp');
}
