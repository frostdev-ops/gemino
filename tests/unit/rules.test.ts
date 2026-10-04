import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import domains from '../../src/shared/google-domains.json' with { type: 'json' };
import {
  WEB_ONLY_RULESET_ID,
  WEB_ONLY_UDM,
  buildWebOnlyRules,
} from '../../src/shared/web-only-rules.ts';

describe('buildWebOnlyRules()', () => {
  const rules = buildWebOnlyRules(domains);

  it('builds exactly three rules with ids 1, 2, 3 and priorities 1, 2, 2', () => {
    expect(rules).toHaveLength(3);
    expect(rules.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rules.map((r) => r.priority)).toEqual([1, 2, 2]);
  });

  it('uses the web_only ruleset id and udm=14', () => {
    expect(WEB_ONLY_RULESET_ID).toBe('web_only');
    expect(WEB_ONLY_UDM).toBe('14');
  });

  it('redirects /search? by adding or replacing udm=14', () => {
    const [redirect] = rules;
    expect(redirect?.action).toEqual({
      type: 'redirect',
      redirect: {
        transform: { queryTransform: { addOrReplaceParams: [{ key: 'udm', value: '14' }] } },
      },
    });
    expect(redirect?.condition.urlFilter).toBe('/search?');
  });

  it('allows URLs that already carry udm= or tbm= with a higher priority than the redirect', () => {
    const [redirect, allowUdm, allowTbm] = rules;
    expect(allowUdm?.action).toEqual({ type: 'allow' });
    expect(allowUdm?.condition.urlFilter).toBe('udm=');
    expect(allowTbm?.action).toEqual({ type: 'allow' });
    expect(allowTbm?.condition.urlFilter).toBe('tbm=');
    expect(allowUdm!.priority).toBeGreaterThan(redirect!.priority);
    expect(allowTbm!.priority).toBeGreaterThan(redirect!.priority);
  });

  it('only touches main_frame requests', () => {
    for (const r of rules) expect(r.condition.resourceTypes).toEqual(['main_frame']);
  });

  it('lists the www. host of every domain and nothing else', () => {
    for (const r of rules) {
      expect(r.condition.requestDomains).toEqual(domains.map((d) => `www.${d}`));
      expect(r.condition.requestDomains.every((d) => d.startsWith('www.'))).toBe(true);
    }
  });

  it('works for a small list', () => {
    const small = buildWebOnlyRules(['google.com']);
    expect(small[0]?.condition.requestDomains).toEqual(['www.google.com']);
  });

  it('rejects invalid domains instead of emitting a broader rule', () => {
    for (const bad of ['evil.com', 'google.', '*.google.com', 'GOOGLE.COM', '', 'google.com/x']) {
      expect(() => buildWebOnlyRules(['google.com', bad])).toThrow(/Invalid Google domain/);
    }
  });

  it('is plain JSON (no enums or functions)', () => {
    expect(JSON.parse(JSON.stringify(rules))).toEqual(rules);
  });

  it('stays far below the static rule limits', () => {
    expect(rules.length).toBeLessThan(10);
  });
});

describe('public/rules/web_only.json', () => {
  it('is up to date with buildWebOnlyRules() (run `npm run rules` if this fails)', () => {
    const onDisk = readFileSync(
      resolve(import.meta.dirname, '../../public/rules/web_only.json'),
      'utf8',
    );
    expect(JSON.parse(onDisk)).toEqual(buildWebOnlyRules(domains));
  });
});
