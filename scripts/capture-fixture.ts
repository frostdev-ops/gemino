/**
 * Captures a cleaned snapshot of a live Google page for use as a test fixture.
 *
 *   npx tsx scripts/capture-fixture.ts <name> <url> [--wait-text "AI Overview"] [--headed]
 *
 * Output: tests/fixtures/<name>.html (scripts, styles, svg bodies, images and personal data removed;
 * structure, classes, roles, aria-* and hrefs are kept because those are what detection keys on).
 * Set CHROME_PATH to use a system browser, e.g. CHROME_PATH=/usr/bin/chromium.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [name, url] = args;
if (!name || !url) {
  console.error('usage: capture-fixture.ts <name> <url> [--wait-text "text"] [--headed]');
  process.exit(1);
}
const flag = (f: string) => args.includes(f);
const waitText = args.includes('--wait-text') ? args[args.indexOf('--wait-text') + 1] : undefined;

const browser = await chromium.launch({
  headless: !flag('--headed'),
  executablePath: process.env.CHROME_PATH,
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
});
// Pre-accept the consent wall where it applies; harmless elsewhere.
await ctx.addCookies([
  { name: 'CONSENT', value: 'YES+', domain: '.google.com', path: '/' },
  {
    name: 'SOCS',
    value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
    domain: '.google.com',
    path: '/',
  },
]);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
if (waitText) {
  await page
    .getByText(waitText, { exact: false })
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => console.warn(`text not found: ${waitText}`));
}
await page.waitForTimeout(1500);

const html = await page.evaluate(() => {
  const doc = document.documentElement.cloneNode(true) as HTMLElement;
  doc
    .querySelectorAll('script, style, link, noscript, iframe, meta, base')
    .forEach((n) => n.remove());
  doc.querySelectorAll('svg').forEach((svg) => svg.replaceChildren());
  doc.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('src');
    img.removeAttribute('srcset');
  });
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name === 'style' || attr.name === 'nonce' || attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (attr.name !== 'href' && attr.value.length > 400) {
        el.setAttribute(attr.name, attr.value.slice(0, 40) + '…');
      }
    }
  });
  return '<!DOCTYPE html>\n' + doc.outerHTML;
});

mkdirSync(resolve(root, 'tests/fixtures'), { recursive: true });
const out = resolve(root, `tests/fixtures/${name}.html`);
writeFileSync(out, html);
console.log(
  `wrote ${out} (${html.length} bytes); title: ${await page.title()}; final url: ${page.url()}`,
);
await browser.close();
