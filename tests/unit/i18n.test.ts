// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../src/shared/i18n.ts';

const root = resolve(import.meta.dirname, '../..');

interface Entry {
  message?: unknown;
  description?: unknown;
  placeholders?: Record<string, { content?: unknown; example?: unknown }>;
}
const catalog = JSON.parse(
  readFileSync(join(root, 'public/_locales/en/messages.json'), 'utf8'),
) as Record<string, Entry>;
const keys = Object.keys(catalog);

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

function htmlKeys(file: string): string[] {
  const html = readFileSync(file, 'utf8');
  return [...html.matchAll(/\bdata-i18n(?:-aria-label)?="([^"]+)"/g)].map((m) => m[1]!);
}

/** Every string literal passed to t(...), including both branches of `t(x ? 'a' : 'b')`. */
function tsKeys(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const call of src.matchAll(/(?<![\w.$])t\(([^)]*)\)/g)) {
    for (const lit of call[1]!.matchAll(/'([A-Za-z][A-Za-z0-9_]*)'/g)) out.push(lit[1]!);
  }
  return out;
}

describe('English message catalog', () => {
  it('has an entry for every key used in the popup and options HTML', () => {
    for (const page of ['src/popup/index.html', 'src/options/index.html']) {
      const used = htmlKeys(join(root, page));
      expect(used.length, page).toBeGreaterThan(5);
      for (const key of used) expect(catalog, `${page}: ${key}`).toHaveProperty(key);
    }
  });

  it('has an entry for every key passed to t() in src/**/*.ts', () => {
    const used = new Set<string>();
    for (const file of walk(join(root, 'src'), '.ts')) {
      for (const key of tsKeys(file)) used.add(key);
    }
    // Sanity check that the scan actually finds the known call sites.
    for (const known of ['statusHandled', 'pxUnit', 'barCollapsed', 'showMore', 'revealBlurred']) {
      expect(used, known).toContain(known);
    }
    for (const key of used) expect(catalog, `t('${key}')`).toHaveProperty(key);
  });

  it('has no unused messages', () => {
    const used = new Set<string>([
      ...walk(join(root, 'src'), '.ts').flatMap(tsKeys),
      ...htmlKeys(join(root, 'src/popup/index.html')),
      ...htmlKeys(join(root, 'src/options/index.html')),
      // Referenced from manifest.config.ts as __MSG_...__.
      ...[...readFileSync(join(root, 'manifest.config.ts'), 'utf8').matchAll(/__MSG_(\w+)__/g)].map(
        (m) => m[1]!,
      ),
    ]);
    expect(keys.filter((k) => !used.has(k))).toEqual([]);
  });

  it('gives every message a non-empty message and description', () => {
    for (const key of keys) {
      const e = catalog[key]!;
      expect(typeof e.message, `${key}.message`).toBe('string');
      expect((e.message as string).trim().length, `${key}.message`).toBeGreaterThan(0);
      expect(typeof e.description, `${key}.description`).toBe('string');
      expect((e.description as string).trim().length, `${key}.description`).toBeGreaterThan(0);
    }
  });

  it('uses valid chrome.i18n key names', () => {
    for (const key of keys) expect(key).toMatch(/^[A-Za-z0-9_@]+$/);
  });

  it('has the extension name and a store-sized description', () => {
    expect(catalog.extName?.message).toBe('Gemino');
    const description = catalog.extDescription?.message as string;
    expect(description.length).toBeGreaterThan(20);
    expect(description.length).toBeLessThanOrEqual(132);
  });

  it('declares every $NAME$ placeholder and uses every declared placeholder', () => {
    for (const key of keys) {
      const e = catalog[key]!;
      const used = [...(e.message as string).matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map((m) =>
        m[1]!.toLowerCase(),
      );
      const declared = Object.keys(e.placeholders ?? {}).map((p) => p.toLowerCase());
      for (const name of used) expect(declared, `${key}: $${name}$`).toContain(name);
      for (const name of declared) expect(used, `${key}: placeholder ${name}`).toContain(name);
      for (const [name, ph] of Object.entries(e.placeholders ?? {})) {
        expect(typeof ph.content, `${key}.${name}.content`).toBe('string');
        expect(ph.content, `${key}.${name}.content`).toMatch(/^\$[1-9]$/);
      }
    }
  });
});

describe('t()', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the bundled English catalog outside an extension', () => {
    expect(typeof (globalThis as { chrome?: unknown }).chrome).toBe('undefined');
    expect(t('showMore')).toBe('Show more');
    expect(t('extName')).toBe('Gemino');
  });

  it('substitutes values into $NAME$ placeholders in the fallback', () => {
    expect(t('statusHandled', '3')).toBe('Handled on this page: 3');
    expect(t('statusHandled', '0')).toBe('Handled on this page: 0');
    expect(t('pxUnit', '160')).toBe('160 px');
  });

  it('returns the key itself for an unknown key', () => {
    expect(t('doesNotExist')).toBe('doesNotExist');
  });

  it('prefers chrome.i18n.getMessage when it returns something', () => {
    const getMessage = vi.fn(() => 'Localisé');
    vi.stubGlobal('chrome', { i18n: { getMessage } });
    expect(t('showMore')).toBe('Localisé');
    expect(t('pxUnit', '5')).toBe('Localisé');
    expect(getMessage).toHaveBeenCalledWith('pxUnit', ['5']);
  });

  it('falls back when chrome.i18n.getMessage returns an empty string (missing key)', () => {
    vi.stubGlobal('chrome', { i18n: { getMessage: () => '' } });
    expect(t('pxUnit', '9')).toBe('9 px');
  });

  it('falls back when chrome.i18n throws', () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: () => {
          throw new Error('Extension context invalidated.');
        },
      },
    });
    expect(t('showLess')).toBe('Show less');
  });
});
