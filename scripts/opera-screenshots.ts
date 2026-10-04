/**
 * Store screenshots for Opera add-ons: 612×408, white background.
 * Uses the built extension in dist/ and a saved Google page. Nothing contacts live Google.
 *
 *   npm run build && npx tsx scripts/opera-screenshots.ts
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const outDir = resolve(root, 'release/opera');
const browserPath = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const W = 612;
const H = 408;

if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}

/** Pads a screenshot onto a white 612×408 canvas, scaled down if it is larger. */
async function frame(
  page: Page,
  file: string,
  clip?: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const png = await page.screenshot({ clip, type: 'png' });
  const shot = await page.evaluate(
    async ({ bytes, width, height }) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      const bmp = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width / bmp.width, height / bmp.height, 1);
      const dw = Math.round(bmp.width * scale);
      const dh = Math.round(bmp.height * scale);
      ctx.drawImage(bmp, Math.round((width - dw) / 2), Math.round((height - dh) / 2), dw, dh);
      const out = await canvas.convertToBlob({ type: 'image/png' });
      return [...new Uint8Array(await out.arrayBuffer())];
    },
    { bytes: [...png], width: W, height: H },
  );
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, Buffer.from(shot));
  console.log(file);
}

mkdirSync(outDir, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  executablePath: browserPath,
  headless: false,
  viewport: { width: 1100, height: 800 },
  colorScheme: 'light',
  args: [
    '--headless=new',
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-first-run',
    '--no-sandbox',
  ],
});

await context.route(/^https:\/\/www\.google\.[a-z.]+\//, async (route) => {
  if (route.request().resourceType() !== 'document') return route.fulfill({ status: 204 });
  // The saved page has no stylesheets. This only tidies the screenshot; it is not part of the extension.
  const tidy = `<style>
    html, body { background:#fff !important; color:#202124 !important; margin:0 !important; }
    body { font: 15px/1.45 Arial, sans-serif !important; }
    #center_col, #rcnt, #search, #rso { margin-left: 28px !important; max-width: 680px !important; }
    a { color:#1a0dab !important; text-decoration:none !important; }
    .gyPpGe { display: none !important; }
    h3 { font-size: 20px !important; line-height: 1.3 !important; margin: 0 0 4px !important; }
    cite, .byline { color:#202124 !important; }
  </style>`;
  const body = readFileSync(resolve(root, 'tests/fixtures/aio-en-us.html'), 'utf8').replace(
    '</head>',
    `${tidy}</head>`,
  );
  await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
});

const page = await context.newPage();
await page.goto('https://www.google.com/search?q=how+long+to+boil+an+egg&fx=aio-en-us');
const bar = page.locator('[data-gemino-host]');
await bar.waitFor({ timeout: 10000 });
await bar.scrollIntoViewIfNeeded();
const box = await bar.boundingBox();
if (!box) throw new Error('collapse bar has no box');
await frame(page, resolve(outDir, '01-search.png'), {
  x: Math.max(0, box.x - 8),
  y: box.y,
  width: Math.min(700, 1100 - Math.max(0, box.x - 8)),
  height: 250,
});

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).host;

const popup = await context.newPage();
await popup.setViewportSize({ width: W, height: H });
await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
await popup.locator('#status').waitFor();
await frame(popup, resolve(outDir, '02-popup.png'));

const options = await context.newPage();
await options.setViewportSize({ width: 880, height: 720 });
await options.emulateMedia({ colorScheme: 'light' });
await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
await options.locator('h1').waitFor();
await frame(options, resolve(outDir, '03-options.png'), { x: 0, y: 0, width: 860, height: 540 });

await context.close();
