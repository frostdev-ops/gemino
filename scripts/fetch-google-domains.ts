/**
 * Fetches Google's published list of supported domains and writes
 * src/shared/google-domains.json. The output is committed to the repo;
 * run `npm run fetch-domains` to refresh it.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://www.google.com/supported_domains';
const HOST_RE = /^google(\.[a-z]{2,3}){1,2}$/;

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`GET ${SOURCE} failed: ${res.status}`);
const text = await res.text();

const domains = [
  ...new Set(
    text
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^\./, '').toLowerCase())
      .filter((d) => HOST_RE.test(d)),
  ),
].sort((a, b) => (a === 'google.com' ? -1 : b === 'google.com' ? 1 : a.localeCompare(b)));

if (domains.length < 50 || !domains.includes('google.com')) {
  throw new Error(`Suspicious domain list (${domains.length} entries); refusing to write.`);
}

writeFileSync(
  resolve(root, 'src/shared/google-domains.json'),
  JSON.stringify(domains, null, 2) + '\n',
);
console.log(`wrote ${domains.length} domains`);
