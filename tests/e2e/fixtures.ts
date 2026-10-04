import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  chromium,
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const EXTENSION_PATH = resolve(root, 'dist');
const BROWSER_PATH = process.env.CHROME_PATH ?? '/usr/bin/chromium';

export const browserAvailable = existsSync(BROWSER_PATH) && existsSync(EXTENSION_PATH);

/** Any Google URL is answered from a saved fixture; `fx` picks which one. Nothing hits live Google. */
export function serp(host: string, fx: string, extra = ''): string {
  return `https://${host}/search?q=test&fx=${fx}${extra}`;
}

export const test = base.extend<{
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      executablePath: BROWSER_PATH,
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-sandbox',
      ],
    });

    await context.route(/^https:\/\/www\.google\.[a-z.]+\//, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().resourceType() !== 'document') return route.fulfill({ status: 204 });
      const fx = url.searchParams.get('fx') ?? 'aio-en-us';
      const body = readFileSync(resolve(root, 'tests/fixtures', `${fx}.html`), 'utf8');
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    });

    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});

export { expect };

/** Opens the options page, runs `fn`, closes it. Changes propagate live via chrome.storage. */
export async function withOptions(
  context: BrowserContext,
  extensionId: string,
  fn: (options: Page) => Promise<void>,
): Promise<void> {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await fn(options);
  await options.close();
}

/** Sets raw settings through the service worker (bypasses the UI, for test setup). */
export async function setSettings(worker: Worker, patch: Record<string, unknown>): Promise<void> {
  await worker.evaluate(async (p) => {
    const { settings } = (await chrome.storage.sync.get('settings')) as { settings?: object };
    await chrome.storage.sync.set({ settings: { ...settings, version: 1, ...p } });
  }, patch);
}
