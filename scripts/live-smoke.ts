/**
 * Live smoke test: loads the built extension (dist/) into Chromium and visits REAL Google pages.
 * Not part of CI (live pages change, Google may show consent or captcha pages, and AI Overviews
 * are not served for every query). It is a real-world sanity check.
 *
 *   npm run build
 *   npx tsx scripts/live-smoke.ts [--sites=en-us,de,fr,ja,home] [--dark] [--fresh] [--headed]
 *                                 [--out=/tmp/gemino-live]
 *
 *   --dark    run with colorScheme 'dark' (default: one light run, plus a dark run on en-us)
 *   --fresh   reload the page for every mode instead of switching the mode live
 *   --headed  do not pass --headless=new (needs a display)
 *
 * A full run is about 30 page loads; running it repeatedly in a short time makes Google answer
 * with its captcha page (/sorry/), which the script reports as BLOCKED. Wait and retry.
 *
 * Needs network access and a Chromium (CHROME_PATH or /usr/bin/chromium). Screenshots and
 * report.json go to /tmp/gemino-live by default, never into the repository.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  chromium,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
  type Worker,
} from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const EXTENSION = resolve(root, 'dist');
const BROWSER = process.env.CHROME_PATH ?? '/usr/bin/chromium';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string): boolean => argv.includes(`--${name}`);

const OUT = opt('out') ?? '/tmp/gemino-live';
mkdirSync(OUT, { recursive: true });

// ---- sites ---------------------------------------------------------------------------------

interface Site {
  id: string;
  url: string;
  /** Cookie domain for the consent cookies. */
  cookieDomain: string;
  home?: boolean;
}

const SITES: Site[] = [
  {
    id: 'en-us',
    url: 'https://www.google.com/search?q=how+long+to+boil+an+egg&hl=en&gl=us',
    cookieDomain: '.google.com',
  },
  {
    id: 'de',
    url: 'https://www.google.de/search?q=wie+funktioniert+ein+k%C3%BChlschrank&hl=de&gl=de',
    cookieDomain: '.google.de',
  },
  {
    id: 'fr',
    url: 'https://www.google.fr/search?q=pourquoi+le+ciel+est+bleu&hl=fr&gl=fr',
    cookieDomain: '.google.fr',
  },
  {
    id: 'ja',
    url: 'https://www.google.co.jp/search?q=%E7%A9%BA%E3%81%AF%E3%81%AA%E3%81%9C%E9%9D%92%E3%81%84&hl=ja&gl=jp',
    cookieDomain: '.google.co.jp',
  },
  {
    id: 'home',
    url: 'https://www.google.com/?hl=en&gl=us',
    cookieDomain: '.google.com',
    home: true,
  },
];

const MODES = ['show', 'hide', 'collapse', 'minimize', 'blur-hover', 'blur-click'] as const;
type Mode = (typeof MODES)[number];
const PREVIEW_PX = 160;

function settingsFor(mode: Mode): Record<string, unknown> {
  const base = {
    enabled: true,
    hideAiModeEntryPoints: true,
    hideGeminiPromos: true,
    webOnly: false,
    debug: false,
    minimize: { previewHeightPx: PREVIEW_PX },
  };
  switch (mode) {
    case 'blur-hover':
      return { ...base, aiOverview: { mode: 'blur' }, blur: { strengthPx: 8, reveal: 'hover' } };
    case 'blur-click':
      return { ...base, aiOverview: { mode: 'blur' }, blur: { strengthPx: 8, reveal: 'click' } };
    default:
      return { ...base, aiOverview: { mode } };
  }
}

// ---- results -------------------------------------------------------------------------------

interface Check {
  name: string;
  /** true = pass, false = fail, null = inconclusive (precondition not met on this page). */
  ok: boolean | null;
  detail: string;
}

interface ModeResult {
  mode: string;
  checks: Check[];
  screenshot?: string;
}

interface SiteResult {
  site: string;
  theme: string;
  blocked?: string;
  aioServed: boolean;
  baseline?: Snapshot;
  modes: ModeResult[];
  notes: string[];
  extensionErrors: string[];
  googleConsoleErrors: number;
}

// ---- page-side measurement -----------------------------------------------------------------

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Snapshot {
  url: string;
  title: string;
  ready: boolean;
  theme: string;
  bodyBackground: string;
  results: { centerCol: Rect | null; rso: Rect | null; organicHeadings: number };
  aio: {
    present: boolean;
    elementRendered: boolean;
    detectedRoots: number;
    root: {
      mode: string | null;
      open: boolean;
      rect: Rect | null;
      rendered: boolean;
      maxHeight: string;
      childFilter: string;
      mask: string;
    } | null;
  };
  hosts: {
    variant: string | undefined;
    theme: string | undefined;
    open: string | undefined;
    ariaExpanded: string | null;
    label: string;
    rect: Rect | null;
  }[];
  aiMode: {
    udm50Anchors: number;
    udm50Visible: number;
    searchBoxButtonVisible: boolean;
    visibleByLabel: string[];
    detected: number;
  };
  geminiLinksVisible: number;
  /** Google's top ads slot; Gemino must never hide it. */
  ads: { present: boolean; height: number };
}

/** Runs inside the page (serialised by Playwright), so it must be self-contained. */
function measure(): Snapshot {
  const rectOf = (el: Element | null): Rect | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };
  const rendered = (el: Element | null): boolean =>
    !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

  const aioEl = document.getElementById('Odp5De');
  const roots = [...document.querySelectorAll('[data-gemino-target="aiOverview"]')];
  const rootEl = roots[0] ?? null;
  const firstChild = rootEl
    ? ([...rootEl.children].find((c) => !c.hasAttribute('data-gemino-host')) ?? null)
    : null;

  const hosts = [...document.querySelectorAll<HTMLElement>('[data-gemino-host]')].map((h) => {
    const button = h.shadowRoot?.querySelector('button') ?? null;
    return {
      variant: h.dataset.variant,
      theme: h.dataset.theme,
      open: h.dataset.open,
      ariaExpanded: button?.getAttribute('aria-expanded') ?? null,
      label: (button?.textContent ?? '').trim(),
      rect: rendered(h) ? rectOf(h) : null,
    };
  });

  const aiModeRe = /^(AI Mode|KI.Modus|Mode IA|AI\s?モード)$/i;
  const visibleByLabel = [
    ...document.querySelectorAll<HTMLElement>('a, button, [role="button"], [role="tab"]'),
  ]
    .filter((el) => rendered(el) && aiModeRe.test((el.textContent ?? '').trim()))
    .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim()}`);

  const udm50 = [...document.querySelectorAll('a[href*="udm=50"]')];
  const rootStyle = rootEl ? getComputedStyle(rootEl) : null;

  return {
    url: location.href,
    title: document.title,
    ready: document.documentElement.hasAttribute('data-gemino-ready'),
    theme: hosts[0]?.theme ?? '',
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    results: {
      centerCol: rendered(document.getElementById('center_col'))
        ? rectOf(document.getElementById('center_col'))
        : null,
      rso: rendered(document.getElementById('rso')) ? rectOf(document.getElementById('rso')) : null,
      organicHeadings: [...document.querySelectorAll('#rso h3')].filter((h) => rendered(h)).length,
    },
    aio: {
      present: !!aioEl,
      elementRendered: rendered(aioEl),
      detectedRoots: roots.length,
      root: rootEl
        ? {
            mode: rootEl.getAttribute('data-gemino-mode'),
            open: rootEl.hasAttribute('data-gemino-open'),
            rect: rendered(rootEl) ? rectOf(rootEl) : null,
            rendered: rendered(rootEl),
            maxHeight: rootStyle?.maxHeight ?? '',
            childFilter: firstChild ? getComputedStyle(firstChild).filter : '',
            mask: rootStyle?.maskImage || rootStyle?.webkitMaskImage || '',
          }
        : null,
    },
    hosts,
    aiMode: {
      udm50Anchors: udm50.length,
      udm50Visible: udm50.filter((a) => rendered(a)).length,
      searchBoxButtonVisible: [...document.querySelectorAll('button[jsname="B6rgad"]')].some((b) =>
        rendered(b),
      ),
      visibleByLabel,
      detected: document.querySelectorAll('[data-gemino-target="aiModeEntry"]').length,
    },
    ads: {
      present: !!document.getElementById('tads'),
      height: Math.round(document.getElementById('tads')?.getBoundingClientRect().height ?? 0),
    },
    geminiLinksVisible: [...document.querySelectorAll('a[href*="gemini.google.com"]')].filter(
      (a) => rendered(a) && !a.closest('#rso, #search'),
    ).length,
  };
}

// ---- helpers -------------------------------------------------------------------------------

const log = (...a: unknown[]) => console.log(...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pass = (name: string, ok: boolean | null, detail = ''): Check => ({ name, ok, detail });
const fmt = (r: Rect | null) => (r ? `${r.w}x${r.h}@${r.y}` : 'not rendered');

async function setSettings(worker: Worker, patch: Record<string, unknown>): Promise<void> {
  await worker.evaluate(async (p) => {
    await chrome.storage.sync.set({ settings: { version: 1, ...p } });
  }, patch);
}

async function blockedReason(page: Page): Promise<string | undefined> {
  const url = page.url();
  const title = await page.title().catch(() => '');
  if (url.includes('/sorry/')) return `captcha / unusual-traffic page (${url})`;
  if (url.includes('consent.google.')) return `consent wall (${url})`;
  if (/before you continue|bevor sie|avant de continuer/i.test(title)) return `consent: ${title}`;
  const body = await page
    .evaluate(() => document.body?.innerText.slice(0, 400) ?? '')
    .catch(() => '');
  if (/unusual traffic|not a robot|ungewöhnlichen Datenverkehr|trafic inhabituel/i.test(body)) {
    return 'unusual-traffic page';
  }
  return undefined;
}

async function load(page: Page, site: Site): Promise<string | undefined> {
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
  if (!site.home) {
    await page.waitForSelector('#Odp5De', { state: 'attached', timeout: 8_000 }).catch(() => {});
  }
  if (!site.home) {
    // The AI Overview streams in; give it time to get its real height (or to be handled).
    await page
      .waitForFunction(
        () =>
          (document.getElementById('Odp5De')?.getBoundingClientRect().height ?? 0) > 60 ||
          document.querySelector('[data-gemino-mode]') !== null,
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});
  }
  await page
    .waitForFunction(() => document.documentElement.hasAttribute('data-gemino-ready'), {
      timeout: 5_000,
    })
    .catch(() => {});
  await sleep(1500);
  return blockedReason(page);
}

async function waitForMode(page: Page, mode: Mode): Promise<void> {
  const expected = mode.startsWith('blur') ? 'blur' : mode;
  await page
    .waitForFunction(
      (m) => {
        const root = document.querySelector('[data-gemino-target="aiOverview"]');
        if (!root) return m === 'show' && !document.querySelector('[data-gemino-mode]');
        return m === 'show'
          ? !root.hasAttribute('data-gemino-mode')
          : root.getAttribute('data-gemino-mode') === m;
      },
      expected,
      { timeout: 4_000 },
    )
    .catch(() => {});
  await sleep(500);
}

// ---- per-mode expectations -----------------------------------------------------------------

function commonChecks(s: Snapshot, base: Snapshot | undefined, home: boolean): Check[] {
  const checks: Check[] = [];
  checks.push(pass('html[data-gemino-ready] set', s.ready, String(s.ready)));
  if (!home) {
    const c = s.results.centerCol;
    checks.push(
      pass(
        'organic results column visible',
        !!c && c.w > 300 && c.h > 200 && s.results.organicHeadings > 0,
        `#center_col ${fmt(c)}, #rso ${fmt(s.results.rso)}, ${s.results.organicHeadings} result headings`,
      ),
    );
  }
  const baseHadAiMode = !!base && (base.aiMode.udm50Anchors > 0 || base.aiMode.detected > 0);
  checks.push(
    pass(
      'AI Mode tab/button hidden',
      s.aiMode.udm50Visible === 0 &&
        !s.aiMode.searchBoxButtonVisible &&
        s.aiMode.visibleByLabel.length === 0,
      `udm=50 anchors ${s.aiMode.udm50Visible}/${s.aiMode.udm50Anchors} visible, search-box button ${s.aiMode.searchBoxButtonVisible ? 'visible' : 'hidden/absent'}, by label: [${s.aiMode.visibleByLabel.join(', ')}], detected ${s.aiMode.detected}${baseHadAiMode ? '' : ' (none found at baseline)'}`,
    ),
  );
  checks.push(
    pass('no Gemini links outside results', s.geminiLinksVisible === 0, `${s.geminiLinksVisible}`),
  );
  if (base && base.ads.height > 0) {
    checks.push(
      pass(
        'ads slot (#tads) left alone',
        s.ads.height === base.ads.height,
        `height ${s.ads.height}, baseline ${base.ads.height}`,
      ),
    );
  }
  return checks;
}

function modeChecks(mode: Mode, s: Snapshot, base: Snapshot): Check[] {
  const checks: Check[] = [];
  const root = s.aio.root;
  const baseH = base.aio.root?.rect?.h ?? 0;
  const bar = s.hosts.find((h) => h.variant === 'bar');
  const overlay = s.hosts.find((h) => h.variant === 'overlay');
  if (mode === 'show') {
    checks.push(
      pass(
        'visible and untouched',
        s.aio.elementRendered && (!root || root.mode === null) && s.hosts.length === 0,
        `${fmt(root?.rect ?? null)}, controls ${s.hosts.length}`,
      ),
    );
    return checks;
  }
  checks.push(
    pass('AI Overview detected', !!root, root ? `data-gemino-mode=${root.mode}` : 'no root marked'),
  );
  if (!root) return checks;

  switch (mode) {
    case 'hide':
      checks.push(pass('hidden (display:none)', !root.rendered, fmt(root.rect)));
      checks.push(pass('no control inserted', s.hosts.length === 0, `${s.hosts.length} controls`));
      break;
    case 'collapse':
      checks.push(pass('block hidden', !root.rendered, fmt(root.rect)));
      checks.push(
        pass(
          'collapse bar shown, slim and full width',
          !!bar?.rect && bar.rect.h >= 24 && bar.rect.h <= 80 && bar.rect.w >= 300,
          `bar ${fmt(bar?.rect ?? null)}, label "${bar?.label}", aria-expanded=${bar?.ariaExpanded}, theme=${bar?.theme}`,
        ),
      );
      break;
    case 'minimize':
      checks.push(
        pass(
          `block capped at ${PREVIEW_PX}px`,
          !!root.rect && root.rect.h <= PREVIEW_PX + 2,
          `${fmt(root.rect)} (baseline height ${baseH})`,
        ),
      );
      checks.push(
        pass('fade mask applied', root.mask.includes('gradient'), root.mask.slice(0, 60)),
      );
      checks.push(
        pass(
          'Show more button shown',
          !!bar?.rect && bar.rect.h >= 24,
          `bar ${fmt(bar?.rect ?? null)}, label "${bar?.label}"`,
        ),
      );
      if (baseH <= PREVIEW_PX + 40) {
        checks.push(
          pass('cap is meaningful (baseline taller than cap)', null, `baseline only ${baseH}px`),
        );
      }
      break;
    case 'blur-hover':
    case 'blur-click':
      checks.push(pass('block still laid out', root.rendered, fmt(root.rect)));
      checks.push(pass('content blurred', root.childFilter.includes('blur('), root.childFilter));
      if (mode === 'blur-click') {
        checks.push(
          pass(
            'click overlay shown',
            !!overlay?.rect,
            `overlay ${fmt(overlay?.rect ?? null)}, label "${overlay?.label}"`,
          ),
        );
      } else {
        checks.push(pass('no overlay in hover mode', !overlay, `${s.hosts.length} controls`));
      }
      break;
  }
  return checks;
}

/** Interactions: expand / reveal, then check the state, then restore. */
async function interact(page: Page, mode: Mode, shotTag: string): Promise<Check[]> {
  const checks: Check[] = [];
  const rootLoc = page.locator('[data-gemino-target="aiOverview"]').first();
  const state = () => page.evaluate(measure);
  try {
    if (mode === 'collapse' || mode === 'minimize') {
      const button = page.locator('[data-gemino-host][data-variant="bar"] button').first();
      await button.click({ timeout: 5_000 });
      await sleep(400);
      const open = await state();
      await page.screenshot({ path: resolve(OUT, `${shotTag}-${mode}-expanded.png`) });
      const h = open.aio.root?.rect?.h ?? 0;
      checks.push(
        pass(
          `click on bar expands the block`,
          !!open.aio.root?.open && h > (mode === 'minimize' ? PREVIEW_PX + 2 : 40),
          `open=${open.aio.root?.open}, ${fmt(open.aio.root?.rect ?? null)}, bar label "${open.hosts[0]?.label}", aria-expanded=${open.hosts[0]?.ariaExpanded}`,
        ),
      );
      // Keyboard: the bar must be operable without a mouse.
      await button.focus();
      await page.keyboard.press('Enter');
      await sleep(400);
      const closed = await state();
      checks.push(
        pass(
          'Enter on the focused bar collapses it again (keyboard)',
          !closed.aio.root?.open &&
            (mode === 'collapse'
              ? !closed.aio.root?.rendered
              : (closed.aio.root?.rect?.h ?? 0) <= PREVIEW_PX + 2),
          `open=${closed.aio.root?.open}, ${fmt(closed.aio.root?.rect ?? null)}`,
        ),
      );
    } else if (mode === 'blur-hover') {
      await rootLoc.hover({ timeout: 5_000 });
      await sleep(500);
      const hovered = await state();
      checks.push(
        pass(
          'hover removes the blur',
          hovered.aio.root?.childFilter === 'none',
          hovered.aio.root?.childFilter ?? '',
        ),
      );
      await page.mouse.move(2, 2);
      await sleep(500);
      const away = await state();
      checks.push(
        pass(
          'moving away restores the blur',
          (away.aio.root?.childFilter ?? '').includes('blur('),
          away.aio.root?.childFilter ?? '',
        ),
      );
    } else if (mode === 'blur-click') {
      await page
        .locator('[data-gemino-host][data-variant="overlay"] button')
        .first()
        .click({ timeout: 5_000 });
      await sleep(400);
      const open = await state();
      checks.push(
        pass(
          'click on overlay reveals',
          !!open.aio.root?.open && open.aio.root.childFilter === 'none',
          `open=${open.aio.root?.open}, filter=${open.aio.root?.childFilter}`,
        ),
      );
      // Back to blurred for the following steps.
      await page.evaluate(() => {
        const r = document.querySelector('[data-gemino-target="aiOverview"]');
        r?.removeAttribute('data-gemino-open');
      });
    }
  } catch (err) {
    checks.push(pass('interaction', false, String(err).split('\n')[0] ?? 'failed'));
  }
  return checks;
}

// ---- scenarios -----------------------------------------------------------------------------

async function lateLoad(page: Page): Promise<Check[]> {
  // Simulates Google streaming the block in late or re-rendering it: a fresh copy of the block
  // (without any Gemino attributes) is inserted into the page about a second after load.
  const result = await page.evaluate(async () => {
    const original = document.querySelector('[data-gemino-target="aiOverview"]');
    if (!original?.parentElement) return { ok: false as const, reason: 'no block to clone' };
    const parent = original.parentElement;
    const clone = original.cloneNode(true) as Element;
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      for (const a of [...el.getAttributeNames()]) {
        if (a.startsWith('data-gemino-')) el.removeAttribute(a);
      }
    }
    clone.querySelectorAll('[data-gemino-host]').forEach((h) => h.remove());
    // Remove the original and its bar, as if the page re-rendered the block.
    const next = original.nextElementSibling;
    const prev = original.previousElementSibling;
    for (const n of [prev, next]) if (n?.hasAttribute('data-gemino-host')) n.remove();
    original.remove();
    await new Promise((r) => setTimeout(r, 1000));
    parent.append(clone);
    await Promise.resolve(); // the observer callback is a microtask: it has run by now
    const handled = clone.getAttribute('data-gemino-mode');
    const rendered = clone.getClientRects().length > 0;
    return {
      ok: true as const,
      handled,
      rendered,
      bars: document.querySelectorAll('[data-gemino-host]').length,
    };
  });
  if (!result.ok) return [pass('late-load: block re-inserted', null, result.reason)];
  return [
    pass(
      'late-load: re-inserted block is handled in the same task, before paint',
      result.handled === 'collapse' && !result.rendered,
      `mode=${result.handled}, rendered=${result.rendered}, controls on page=${result.bars}`,
    ),
  ];
}

async function freshLoadFlashCheck(
  context: BrowserContext,
  worker: Worker,
  site: Site,
  screenshot: string,
): Promise<{ checks: Check[]; blocked?: string }> {
  await setSettings(worker, settingsFor('collapse'));
  const page = await context.newPage();
  // Records, per animation frame, whether the AI Overview was ever visible on screen.
  await page.addInitScript(() => {
    const w = window as unknown as { __flashFrames: number; __frames: number };
    w.__flashFrames = 0;
    w.__frames = 0;
    const tick = () => {
      w.__frames++;
      const el = document.getElementById('Odp5De');
      if (el) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.height > 20 && cs.visibility !== 'hidden' && cs.display !== 'none') w.__flashFrames++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const blocked = await load(page, site);
  const out = await page.evaluate(() => {
    const w = window as unknown as { __flashFrames: number; __frames: number };
    return {
      flash: w.__flashFrames,
      frames: w.__frames,
      present: !!document.getElementById('Odp5De'),
    };
  });
  const snap = await page.evaluate(measure);
  await page.screenshot({ path: screenshot });
  await page.close();
  const checks: Check[] = [
    pass(
      'fresh load: collapse mode applied',
      snap.aio.root?.mode === 'collapse' || !out.present,
      `mode=${snap.aio.root?.mode}, present=${out.present}`,
    ),
    out.present
      ? pass(
          'fresh load: AI Overview never painted visible (no flash)',
          out.flash === 0,
          `${out.flash} visible frames of ${out.frames}`,
        )
      : pass('fresh load: flash check', null, 'no AI Overview served on this load'),
  ];
  return { checks, blocked };
}

// ---- driver --------------------------------------------------------------------------------

async function launch(theme: 'light' | 'dark', sites: Site[]) {
  const context = await chromium.launchPersistentContext('', {
    executablePath: BROWSER,
    headless: false,
    viewport: { width: 1280, height: 900 },
    colorScheme: theme,
    userAgent: UA,
    args: [
      ...(flag('headed') ? [] : ['--headless=new']),
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      '--no-first-run',
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  // tsx (esbuild) wraps named functions in a __name() helper that does not exist in the page.
  await context.addInitScript('window.__name = (fn) => fn;');
  const domains = [...new Set(sites.map((s) => s.cookieDomain))];
  await context.addCookies(
    domains.flatMap((domain) => [
      { name: 'CONSENT', value: 'YES+', domain, path: '/' },
      {
        name: 'SOCS',
        value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
        domain,
        path: '/',
      },
    ]),
  );
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return { context, worker };
}

async function runSite(
  context: BrowserContext,
  worker: Worker,
  site: Site,
  theme: string,
): Promise<SiteResult> {
  const tag = `${site.id}-${theme}`;
  const result: SiteResult = {
    site: site.id,
    theme,
    aioServed: false,
    modes: [],
    notes: [],
    extensionErrors: [],
    googleConsoleErrors: 0,
  };
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location().url;
    if (loc.startsWith('chrome-extension://') || msg.text().includes('Gemino')) {
      result.extensionErrors.push(`${msg.text().slice(0, 200)} (${loc})`);
    } else {
      result.googleConsoleErrors++;
    }
  };
  context.on('console', onConsole);

  try {
    // Baseline: debug mode shows every block untouched but marks what was detected, so the
    // unmodified size of the AI Overview and the native AI Mode buttons can be measured.
    await setSettings(worker, { ...settingsFor('show'), debug: true });
    const page = await context.newPage();
    result.blocked = await load(page, site);
    page.on('pageerror', (e) => {
      if (/gemino/i.test(String(e.stack ?? e.message)))
        result.extensionErrors.push(`pageerror: ${e.message}`);
    });
    if (result.blocked) {
      await page.screenshot({ path: resolve(OUT, `${tag}-blocked.png`) });
      await page.close();
      return result;
    }

    const base = await page.evaluate(measure);
    result.baseline = base;
    result.aioServed = base.aio.elementRendered && (base.aio.root?.rect?.h ?? 0) > 30;
    await page.screenshot({ path: resolve(OUT, `${tag}-baseline-debug-outlines.png`) });
    if (site.home) {
      // Homepage: only the AI Mode button and Gemini promos apply.
      const modeResult: ModeResult = { mode: 'home', checks: [] };
      await setSettings(worker, settingsFor('collapse'));
      await sleep(800);
      const s = await page.evaluate(measure);
      modeResult.checks.push(...commonChecks(s, base, true));
      modeResult.checks.push(
        pass(
          'AI Mode button was present before (precondition)',
          base.aiMode.searchBoxButtonVisible || base.aiMode.visibleByLabel.length > 0 ? true : null,
          `baseline: button ${base.aiMode.searchBoxButtonVisible}, by label [${base.aiMode.visibleByLabel.join(', ')}]`,
        ),
      );
      modeResult.screenshot = resolve(OUT, `${tag}-home.png`);
      await page.screenshot({ path: modeResult.screenshot });
      result.modes.push(modeResult);
      await page.close();
      return result;
    }

    if (!result.aioServed) {
      result.notes.push(
        base.aio.present
          ? 'AI Overview element present but not rendered at baseline'
          : 'No AI Overview served for this query/session; mode checks are inconclusive',
      );
    }

    for (const mode of MODES) {
      if (flag('fresh') && mode !== 'show') {
        await setSettings(worker, settingsFor(mode));
        result.blocked = await load(page, site);
        if (result.blocked) break;
      } else {
        await setSettings(worker, settingsFor(mode));
        await waitForMode(page, mode);
      }
      // Park the mouse away from the block: a pointer left over it would reveal hover-blur.
      await page.mouse.move(2, 2);
      await sleep(400);
      const s = await page.evaluate(measure);
      const modeResult: ModeResult = { mode, checks: [] };
      // Screenshot first: the interactions below leave focus rings and hover states behind.
      modeResult.screenshot = resolve(OUT, `${tag}-${mode}.png`);
      await page.screenshot({ path: modeResult.screenshot });
      if (result.aioServed) {
        modeResult.checks.push(...modeChecks(mode, s, base));
        modeResult.checks.push(...(await interact(page, mode, tag)));
      }
      modeResult.checks.push(...commonChecks(s, base, false));
      result.modes.push(modeResult);
    }

    // Late-load scenario in collapse mode.
    if (result.aioServed) {
      await setSettings(worker, settingsFor('collapse'));
      await waitForMode(page, 'collapse');
      const late: ModeResult = { mode: 'late-load', checks: await lateLoad(page) };
      late.screenshot = resolve(OUT, `${tag}-late-load.png`);
      await page.screenshot({ path: late.screenshot });
      result.modes.push(late);
    }
    await page.close();

    // Fresh load in collapse mode with flash detection (the pre-hide path).
    const fresh = await freshLoadFlashCheck(
      context,
      worker,
      site,
      resolve(OUT, `${tag}-fresh-collapse.png`),
    );
    if (fresh.blocked) result.notes.push(`fresh load blocked: ${fresh.blocked}`);
    result.modes.push({
      mode: 'fresh-load',
      checks: fresh.checks,
      screenshot: resolve(OUT, `${tag}-fresh-collapse.png`),
    });
  } catch (err) {
    result.notes.push(`script error: ${String(err).split('\n')[0]}`);
  } finally {
    context.off('console', onConsole);
  }
  return result;
}

function printResult(r: SiteResult): void {
  log(`\n=== ${r.site} (${r.theme}) ===`);
  if (r.blocked) {
    log(`  BLOCKED: ${r.blocked}`);
    return;
  }
  log(
    `  AI Overview served: ${r.aioServed}${r.baseline ? ` (baseline ${fmt(r.baseline.aio.root?.rect ?? null)}, title "${r.baseline.title}")` : ''}`,
  );
  for (const n of r.notes) log(`  note: ${n}`);
  for (const m of r.modes) {
    log(`  [${m.mode}]`);
    for (const c of m.checks) {
      const mark = c.ok === true ? 'PASS' : c.ok === false ? 'FAIL' : 'N/A ';
      log(`    ${mark} ${c.name}${c.detail ? ` -- ${c.detail}` : ''}`);
    }
  }
  log(
    `  extension console errors: ${r.extensionErrors.length}${r.extensionErrors.length ? `\n    ${r.extensionErrors.join('\n    ')}` : ''}`,
  );
  log(`  (page console errors from Google itself: ${r.googleConsoleErrors})`);
}

async function main(): Promise<void> {
  const wanted = opt('sites')?.split(',');
  const sites = SITES.filter((s) => !wanted || wanted.includes(s.id));
  const results: SiteResult[] = [];

  const runs: { theme: 'light' | 'dark'; sites: Site[] }[] = flag('dark')
    ? [{ theme: 'dark', sites }]
    : [
        { theme: 'light', sites },
        { theme: 'dark', sites: sites.filter((s) => s.id === 'en-us') },
      ];

  for (const run of runs) {
    if (run.sites.length === 0) continue;
    const { context, worker } = await launch(run.theme, run.sites);
    try {
      for (const site of run.sites) {
        const r = await runSite(context, worker, site, run.theme);
        printResult(r);
        results.push(r);
        await sleep(1500);
      }
    } finally {
      await context.close();
    }
  }

  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(results, null, 2));
  const all = results.flatMap((r) => r.modes.flatMap((m) => m.checks));
  const failed = all.filter((c) => c.ok === false).length;
  const extErrors = results.reduce((n, r) => n + r.extensionErrors.length, 0);
  log(
    `\nSummary: ${all.filter((c) => c.ok === true).length} passed, ${failed} failed, ${all.filter((c) => c.ok === null).length} inconclusive; ${extErrors} extension console errors; ${results.filter((r) => r.blocked).length} blocked page(s). Screenshots + report.json in ${OUT}`,
  );
  process.exitCode = failed > 0 || extErrors > 0 ? 1 : 0;
}

await main();
