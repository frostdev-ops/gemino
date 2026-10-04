/**
 * Builds the two release artifacts into release/ (it does NOT build the extension itself; the
 * npm script `package` runs `npm run build` first):
 *
 *   gemino-<version>.zip          the extension (contents of dist/ at the zip root), for the
 *                                 Chrome Web Store and Opera add-ons
 *   gemino-<version>-source.zip   the source needed to rebuild it (Opera reviewers ask for this)
 *
 * Needs the system `zip` and `unzip` commands. Idempotent: stale zips with the same names are
 * removed first. Run it with `npm run package`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const releaseDir = resolve(root, 'release');

function fail(message: string): never {
  console.error(`package: ${message}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };

// ---- sanity checks on the build ------------------------------------------------------------

const distManifest = resolve(dist, 'manifest.json');
if (!existsSync(distManifest)) fail('dist/manifest.json is missing; run `npm run build` first.');
const manifest = JSON.parse(readFileSync(distManifest, 'utf8')) as { version: string };
if (manifest.version !== pkg.version) {
  fail(
    `dist is stale: manifest version ${manifest.version} != package.json ${pkg.version}. ` +
      'Run `npm run build`.',
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

// Anything that must never reach a store: source maps, dev-server leftovers, tests.
const forbidden = walk(dist).filter(
  (f) => /\.map$/.test(f) || /hot-update|@vite|vite\/client|\.test\.|\.spec\./.test(f),
);
if (forbidden.length > 0) fail(`dev artifacts in dist/: ${forbidden.join(', ')}`);

const messages = JSON.parse(
  readFileSync(resolve(dist, '_locales/en/messages.json'), 'utf8'),
) as Record<string, { message: string }>;
const description = messages.extDescription?.message ?? '';
if (description.length === 0 || description.length > 132) {
  fail(`extDescription must be 1-132 characters for the stores (is ${description.length}).`);
}

// ---- zipping -------------------------------------------------------------------------------

mkdirSync(releaseDir, { recursive: true });
const extensionZip = resolve(releaseDir, `gemino-${pkg.version}.zip`);
const sourceZip = resolve(releaseDir, `gemino-${pkg.version}-source.zip`);
rmSync(extensionZip, { force: true });
rmSync(sourceZip, { force: true });

/** Runs `zip -r -X -D` (no directory entries) with an argument array (no shell, nothing interpolated). */
function zip(cwd: string, out: string, entries: string[], exclude: string[] = []): void {
  const args = ['-r', '-X', '-D', '-q', out, ...entries];
  if (exclude.length > 0) args.push('-x', ...exclude);
  try {
    execFileSync('zip', args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
  } catch (err) {
    fail(`\`zip\` failed (is it installed?): ${String(err)}`);
  }
}

function listZip(file: string): { size: number; name: string }[] {
  const out = execFileSync('unzip', ['-Z', '-l', file], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.match(/^\S+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\d+\s+\S+\s+\S+\s+\S+\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ size: Number(m[1]), name: m[2]! }));
}

// Extension: the contents of dist/ at the zip root. `_metadata/` is written into dist/ by Chromium
// when it loads the unpacked extension (tests, live smoke); it is not part of the extension.
zip(dist, extensionZip, readdirSync(dist).sort(), ['_metadata/*', '*.DS_Store']);

// Source: everything needed to rebuild and test the extension from a clean checkout.
const SOURCE_ENTRIES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'manifest.config.ts',
  'eslint.config.js',
  '.prettierrc.json',
  '.prettierignore',
  '.gitignore',
  'README.md',
  'LICENSE',
  'PRIVACY.md',
  'docs',
  'scripts',
  'src',
  'public',
  'tests',
].filter((entry) => existsSync(resolve(root, entry)));
zip(root, sourceZip, SOURCE_ENTRIES, [
  '*/node_modules/*',
  'node_modules/*',
  'dist/*',
  '*/dist/*',
  'release/*',
  'test-results/*',
  'playwright-report/*',
  '*.zip',
  '*.DS_Store',
]);

// ---- verification and report ---------------------------------------------------------------

const extFiles = listZip(extensionZip);
if (!extFiles.some((f) => f.name === 'manifest.json')) fail('manifest.json is not at the zip root');
if (extFiles.some((f) => f.name.startsWith('_metadata/'))) fail('_metadata/ leaked into the zip');

const srcFiles = listZip(sourceZip);
for (const required of ['package.json', 'package-lock.json', 'manifest.config.ts', 'src/']) {
  if (!srcFiles.some((f) => f.name === required || f.name.startsWith(required))) {
    fail(`source zip is missing ${required}`);
  }
}
if (srcFiles.some((f) => /(^|\/)node_modules\/|^dist\/|\.zip$/.test(f.name))) {
  fail('source zip contains node_modules, dist or another zip');
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`\nGemino ${pkg.version}`);
console.log(`\nrelease/gemino-${pkg.version}.zip  ${kb(statSync(extensionZip).size)}`);
for (const f of extFiles.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${kb(f.size).padStart(10)}  ${f.name}`);
}

console.log(`\nrelease/gemino-${pkg.version}-source.zip  ${kb(statSync(sourceZip).size)}`);
const groups = new Map<string, { files: number; size: number }>();
for (const f of srcFiles.filter((f) => !f.name.endsWith('/'))) {
  const top = f.name.includes('/') ? `${f.name.split('/')[0]}/` : f.name;
  const g = groups.get(top) ?? { files: 0, size: 0 };
  g.files += 1;
  g.size += f.size;
  groups.set(top, g);
}
for (const [name, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${kb(g.size).padStart(10)}  ${name}${g.files > 1 ? ` (${g.files} files)` : ''}`);
}
