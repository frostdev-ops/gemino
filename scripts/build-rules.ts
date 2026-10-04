/** Generates public/rules/web_only.json from the committed domain list. Runs before every build. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWebOnlyRules } from '../src/shared/web-only-rules.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const domains = JSON.parse(
  readFileSync(resolve(root, 'src/shared/google-domains.json'), 'utf8'),
) as string[];

const outDir = resolve(root, 'public/rules');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, 'web_only.json');
const next = JSON.stringify(buildWebOnlyRules(domains), null, 2) + '\n';

// Idempotent: only touch the file when the content actually changed.
let prev = '';
try {
  prev = readFileSync(out, 'utf8');
} catch {
  /* first run */
}
if (prev !== next) {
  writeFileSync(out, next);
  console.log('wrote public/rules/web_only.json');
} else {
  console.log('public/rules/web_only.json is up to date');
}
