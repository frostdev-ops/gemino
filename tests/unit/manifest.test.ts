// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import manifestExport from '../../manifest.config.ts';
import domains from '../../src/shared/google-domains.json' with { type: 'json' };
import { matchPatterns } from '../../src/shared/match-patterns.ts';

const root = resolve(import.meta.dirname, '..', '..');

interface ContentScript {
  matches: string[];
  js?: string[];
  css?: string[];
  run_at?: string;
  all_frames?: boolean;
  world?: string;
}
interface Manifest {
  manifest_version: number;
  name: string;
  description: string;
  default_locale: string;
  version: string;
  permissions: string[];
  optional_permissions?: string[];
  host_permissions: string[];
  content_scripts: ContentScript[];
  declarative_net_request: { rule_resources: { id: string; enabled: boolean; path: string }[] };
  commands: Record<string, { suggested_key: { default: string }; description: string }>;
  background: { service_worker: string; type?: string };
  web_accessible_resources?: unknown;
  [key: string]: unknown;
}

let manifest: Manifest;
const catalog = JSON.parse(
  readFileSync(resolve(root, 'public/_locales/en/messages.json'), 'utf8'),
) as Record<string, unknown>;
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };

beforeAll(async () => {
  // defineManifest() returns an object, a promise or a function of the Vite env.
  const exported: unknown = manifestExport;
  const resolved =
    typeof exported === 'function'
      ? await (exported as (env: object) => unknown)({ command: 'build', mode: 'production' })
      : await exported;
  manifest = resolved as Manifest;
});

describe('manifest.config.ts', () => {
  it('is Manifest V3 with the package version', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.default_locale).toBe('en');
  });

  it('requests exactly storage and declarativeNetRequestWithHostAccess', () => {
    expect([...manifest.permissions].sort()).toEqual([
      'declarativeNetRequestWithHostAccess',
      'storage',
    ]);
    expect(manifest.optional_permissions ?? []).toEqual([]);
  });

  it('has no broad permissions, remote code or externally connectable pages', () => {
    const everything = JSON.stringify(manifest);
    for (const bad of [
      '<all_urls>',
      '"tabs"',
      '"scripting"',
      '"webRequest"',
      '"cookies"',
      '"history"',
      '"activeTab"',
      '"declarativeNetRequest"',
      'externally_connectable',
      'content_security_policy',
      'unsafe-eval',
    ]) {
      expect(everything, bad).not.toContain(bad);
    }
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it('host_permissions equals the content script matches and the generated patterns', () => {
    expect(manifest.host_permissions).toEqual(matchPatterns(domains));
    expect(manifest.content_scripts).toHaveLength(2);
    for (const cs of manifest.content_scripts)
      expect(cs.matches).toEqual(manifest.host_permissions);
  });

  it('uses only https://www.google.<tld>/ patterns, with no wildcard host or TLD', () => {
    expect(manifest.host_permissions.length).toBeGreaterThan(600);
    for (const pattern of [
      ...manifest.host_permissions,
      ...manifest.content_scripts.flatMap((c) => c.matches),
    ]) {
      expect(pattern, pattern).toMatch(/^https:\/\/www\.google\.[a-z.]+\//);
      const host = pattern.split('/')[2]!;
      expect(host, pattern).not.toContain('*');
      expect(host, pattern).toMatch(/^www\.google(\.[a-z]{2,3}){1,2}$/);
    }
    expect(manifest.host_permissions).toContain('https://www.google.com/search*');
    expect(manifest.host_permissions).toContain('https://www.google.com/?*');
  });

  it('runs the prehide script at document_start and the main script at document_idle', () => {
    const [prehide, main] = manifest.content_scripts;
    expect(prehide?.run_at).toBe('document_start');
    expect(prehide?.js).toEqual(['src/content/prehide.iife.ts']);
    expect(prehide?.css).toEqual(['src/content/prehide.css']);
    expect(main?.run_at).toBe('document_idle');
    expect(main?.js).toEqual(['src/content/index.iife.ts']);
    expect(main?.css).toEqual(['src/content/content.css']);
    for (const cs of manifest.content_scripts) {
      expect(cs.all_frames).toBeUndefined();
      expect(cs.world).toBeUndefined();
    }
  });

  it('ships the Web only ruleset disabled by default', () => {
    expect(manifest.declarative_net_request.rule_resources).toEqual([
      { id: 'web_only', enabled: false, path: 'rules/web_only.json' },
    ]);
  });

  it('declares the Alt+Shift+G toggle command', () => {
    expect(manifest.commands['toggle-gemino']).toEqual({
      suggested_key: { default: 'Alt+Shift+G' },
      description: '__MSG_cmdToggle__',
    });
  });

  it('has a module service worker', () => {
    expect(manifest.background).toEqual({
      service_worker: 'src/background/index.ts',
      type: 'module',
    });
  });

  it('only references __MSG_x__ keys that exist in the English catalog', () => {
    const refs = [...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)].map(
      (m) => m[1]!,
    );
    expect(refs.length).toBeGreaterThanOrEqual(4);
    for (const key of new Set(refs)) expect(catalog, `__MSG_${key}__`).toHaveProperty(key);
  });

  it('points at icon files that exist', () => {
    const icons = (manifest as unknown as { icons: Record<string, string> }).icons;
    for (const size of ['16', '32', '48', '128']) {
      expect(() => readFileSync(resolve(root, 'public', icons[size]!))).not.toThrow();
    }
  });
});
