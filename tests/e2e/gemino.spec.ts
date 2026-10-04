import { browserAvailable, expect, serp, setSettings, test, withOptions } from './fixtures.ts';

test.skip(
  !browserAvailable,
  'needs a built extension (npm run build) and a Chromium (CHROME_PATH)',
);

const OVERVIEW = '[data-gemino-target="aiOverview"]';

test.describe('AI Overview modes', () => {
  test('collapse (default): hidden behind a bar that expands on click', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));

    const overview = page.locator(OVERVIEW);
    await expect(overview).toHaveAttribute('data-gemino-mode', 'collapse');
    await expect(overview).toBeHidden();

    const bar = page.locator('[data-gemino-host] >> role=button');
    await expect(bar).toHaveText(/Click to expand/);
    await expect(page.locator('html')).toHaveAttribute('data-gemino-ready', '');

    await bar.click();
    await expect(overview).toBeVisible();
    await expect(bar).toHaveText(/Click to collapse/);
    await bar.click();
    await expect(overview).toBeHidden();
  });

  for (const mode of ['hide', 'collapse', 'minimize', 'blur'] as const) {
    test(`${mode}: never hides the ads slot that shares the AI Overview's wrapper`, async ({
      context,
      worker,
    }) => {
      await setSettings(worker, { aiOverview: { mode } });
      const page = await context.newPage();
      await page.goto(serp('www.google.com', 'aio-en-us'));
      await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-mode', mode);
      // The saved page has an empty #tads; add an ad as Google would fill it in.
      await page.evaluate(() => {
        const ad = document.createElement('div');
        ad.id = 'fake-ad';
        ad.style.cssText = 'height:80px;background:#eee';
        ad.textContent = 'Sponsored';
        document.getElementById('tads')!.append(ad);
      });
      await expect(page.locator('#fake-ad')).toBeVisible();
      expect(
        await page.evaluate(() =>
          document
            .querySelector('[data-gemino-target="aiOverview"]')!
            .contains(document.getElementById('tads')),
        ),
      ).toBe(false);
    });
  }

  test('hide: gone, no bar', async ({ context, worker }) => {
    await setSettings(worker, { aiOverview: { mode: 'hide' } });
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));
    await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-mode', 'hide');
    await expect(page.locator(OVERVIEW)).toBeHidden();
    await expect(page.locator('[data-gemino-host]')).toHaveCount(0);
  });

  test('minimize: capped height with a Show more button', async ({ context, worker }) => {
    await setSettings(worker, {
      aiOverview: { mode: 'minimize' },
      minimize: { previewHeightPx: 120 },
      hideAiModeEntryPoints: false,
    });
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));

    const overview = page.locator(OVERVIEW);
    await expect(overview).toBeVisible();
    const collapsed = (await overview.boundingBox())!.height;
    expect(collapsed).toBeLessThanOrEqual(120);

    const button = page.locator('[data-gemino-host] >> role=button');
    await expect(button).toHaveText('Show more');
    await button.click();
    await expect(button).toHaveText('Show less');
    expect((await overview.boundingBox())!.height).toBeGreaterThan(collapsed);
  });

  test('blur on hover: blurred until the pointer is over it', async ({ context, worker }) => {
    await setSettings(worker, {
      aiOverview: { mode: 'blur' },
      blur: { strengthPx: 10, reveal: 'hover' },
      hideAiModeEntryPoints: false,
    });
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));

    const child = page.locator(`${OVERVIEW} > :not([data-gemino-host])`).first();
    await expect(child).toHaveCSS('filter', 'blur(10px)');
    await page.locator(OVERVIEW).hover();
    await expect(child).toHaveCSS('filter', 'none');
  });

  test('blur on click: overlay reveals the block', async ({ context, worker }) => {
    await setSettings(worker, {
      aiOverview: { mode: 'blur' },
      blur: { strengthPx: 8, reveal: 'click' },
      hideAiModeEntryPoints: false,
    });
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));

    const overlay = page.locator(`${OVERVIEW} > [data-gemino-host] >> role=button`);
    await expect(overlay).toHaveText('Click to reveal AI Overview');
    await overlay.click();
    await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-open', '');
    await expect(page.locator(`${OVERVIEW} > :not([data-gemino-host])`).first()).toHaveCSS(
      'filter',
      'none',
    );
  });

  test('works on other regional domains and languages (google.de)', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.de', 'aio-de'));
    await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-mode', 'collapse');
    await expect(page.locator(OVERVIEW)).toBeHidden();
  });

  test('leaves a results page without an AI Overview alone', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'no-aio-en', '&hl=en'));
    await expect(page.locator('html')).toHaveAttribute('data-gemino-ready', '');
    await expect(page.locator(OVERVIEW)).toHaveCount(0);
    await expect(page.locator('#rso')).toBeVisible();
  });

  test('keeps the organic results visible in every mode', async ({ context, worker }) => {
    for (const mode of ['hide', 'collapse', 'minimize', 'blur']) {
      await setSettings(worker, { aiOverview: { mode } });
      const page = await context.newPage();
      await page.goto(serp('www.google.com', 'aio-en-us'));
      await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-mode', mode);
      await expect(page.locator('#center_col')).toBeVisible();
      await page.close();
    }
  });
});

test.describe('live changes from the options page', () => {
  test('switching mode updates an open results page without reloading', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));
    await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-mode', 'collapse');

    await withOptions(context, extensionId, async (options) => {
      await options.getByRole('radio', { name: 'Hide', exact: true }).check({ force: true });
    });
    await expect(page.locator(OVERVIEW)).toHaveAttribute('data-gemino-mode', 'hide');
    await expect(page.locator('[data-gemino-host]')).toHaveCount(0);

    await withOptions(context, extensionId, async (options) => {
      await options.getByRole('radio', { name: 'Show', exact: true }).check({ force: true });
    });
    await expect(page.locator(OVERVIEW)).not.toHaveAttribute('data-gemino-mode', /.+/);
    await expect(page.locator(OVERVIEW)).toBeVisible();
  });

  test('the master switch turns Gemino off and back on', async ({ context, worker }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));
    await expect(page.locator(OVERVIEW)).toBeHidden();

    await setSettings(worker, { enabled: false });
    await expect(page.locator(OVERVIEW)).toBeVisible();
    await setSettings(worker, { enabled: true });
    await expect(page.locator(OVERVIEW)).toBeHidden();
  });

  test('"show everything on this page" and back', async ({ context, worker }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));
    await expect(page.locator(OVERVIEW)).toBeHidden();

    const send = (reveal: boolean) =>
      worker.evaluate(
        async ([url, r]) => {
          const [tab] = await chrome.tabs.query({ url: `${url}*` });
          return chrome.tabs.sendMessage(tab!.id!, { type: 'show-once', reveal: r });
        },
        ['https://www.google.com/search*', reveal] as const,
      );

    expect(await send(true)).toMatchObject({ revealed: true });
    await expect(page.locator(OVERVIEW)).toBeVisible();
    expect(await send(false)).toMatchObject({ revealed: false });
    await expect(page.locator(OVERVIEW)).toBeHidden();
  });
});

test.describe('AI Mode entry points', () => {
  test('hides the AI Mode tab and button, and shows them again when switched off', async ({
    context,
    worker,
  }) => {
    const page = await context.newPage();
    await page.goto(serp('www.google.com', 'aio-en-us'));
    const entries = page.locator('[data-gemino-target="aiModeEntry"]');
    await expect(entries.first()).toHaveAttribute('data-gemino-mode', 'hide');
    await expect(page.locator('a[href*="udm=50"]:not(.rmysyd)').first()).toBeHidden();

    await setSettings(worker, { hideAiModeEntryPoints: false });
    await expect(page.locator('a[href*="udm=50"]:not(.rmysyd)').first()).toBeVisible();
  });

  test('hides the AI Mode button on the homepage', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://www.google.com/?fx=home-en');
    await expect(page.locator('button[jsname="B6rgad"]')).toBeHidden();
  });
});

test.describe('Web only mode', () => {
  const outcome = (worker: import('@playwright/test').Worker, url: string) =>
    worker.evaluate(
      async (u) =>
        (
          await chrome.declarativeNetRequest.testMatchOutcome({
            url: u,
            type: 'main_frame',
            method: 'get',
          })
        ).matchedRules.map((r) => r.ruleId),
      url,
    );

  test('is off by default and switched on from settings', async ({ worker }) => {
    const enabled = () => worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
    expect(await enabled()).toEqual([]);
    await setSettings(worker, { webOnly: true });
    await expect.poll(enabled).toEqual(['web_only']);
    await setSettings(worker, { webOnly: false });
    await expect.poll(enabled).toEqual([]);
  });

  test('redirects plain searches but leaves other tabs alone', async ({ worker }) => {
    await setSettings(worker, { webOnly: true });
    await expect
      .poll(() => worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets()))
      .toEqual(['web_only']);

    expect(await outcome(worker, 'https://www.google.com/search?q=cats')).toEqual([1]);
    expect(await outcome(worker, 'https://www.google.de/search?q=katzen&hl=de')).toEqual([1]);
    // Already web-only, Images, Videos, AI Mode links: allowed through untouched.
    expect(await outcome(worker, 'https://www.google.com/search?q=cats&udm=14')).toEqual([2]);
    expect(await outcome(worker, 'https://www.google.com/search?q=cats&udm=2')).toEqual([2]);
    expect(await outcome(worker, 'https://www.google.com/search?q=cats&tbm=isch')).toEqual([3]);
    // Not a search, and not the www host.
    expect(await outcome(worker, 'https://www.google.com/maps')).toEqual([]);
    expect(await outcome(worker, 'https://news.google.com/search?q=cats')).toEqual([]);
  });

  test('a real navigation to /search ends up on udm=14, once', async ({ context, worker }) => {
    await setSettings(worker, { webOnly: true });
    await expect
      .poll(() => worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets()))
      .toEqual(['web_only']);

    const requests: string[] = [];
    const page = await context.newPage();
    page.on('request', (r) => {
      if (r.resourceType() === 'document') requests.push(r.url());
    });
    await page.goto('https://www.google.com/search?q=cats&hl=en&fx=no-aio-en');
    await expect.poll(() => new URL(page.url()).searchParams.get('udm')).toBe('14');
    expect(new URL(page.url()).searchParams.get('q')).toBe('cats');
    // One redirect, no loop.
    expect(requests.filter((u) => u.includes('udm=14')).length).toBeLessThanOrEqual(2);

    // Tabs other than Web are not redirected.
    await page.goto('https://www.google.com/search?q=cats&udm=2&fx=no-aio-en');
    expect(new URL(page.url()).searchParams.get('udm')).toBe('2');
  });

  test('the master switch also turns Web only off', async ({ worker }) => {
    await setSettings(worker, { webOnly: true, enabled: true });
    await expect
      .poll(() => worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets()))
      .toEqual(['web_only']);
    await setSettings(worker, { enabled: false });
    await expect
      .poll(() => worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets()))
      .toEqual([]);
  });
});

test.describe('extension pages', () => {
  test('options page reflects stored settings and saves changes', async ({
    context,
    extensionId,
    worker,
  }) => {
    await withOptions(context, extensionId, async (options) => {
      await expect(options.getByRole('heading', { name: 'Gemino settings' })).toBeVisible();
      await expect(options.getByRole('radio', { name: 'Collapse' })).toBeChecked();
      await options.getByRole('radio', { name: 'Minimize' }).check({ force: true });
      await expect(options.locator('#previewHeight')).toBeVisible();
      await options.locator('#hideGeminiPromos').uncheck();
    });
    const stored = await worker.evaluate(
      async () => (await chrome.storage.sync.get('settings')).settings,
    );
    expect(stored).toMatchObject({ aiOverview: { mode: 'minimize' }, hideGeminiPromos: false });
  });

  test('popup renders and writes settings', async ({ context, extensionId, worker }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await expect(popup.getByRole('radio', { name: 'Collapse' })).toBeChecked();
    await popup.getByRole('radio', { name: 'Blur' }).check({ force: true });
    await expect(popup.locator('#status')).not.toBeEmpty();
    const stored = await worker.evaluate(
      async () => (await chrome.storage.sync.get('settings')).settings,
    );
    expect(stored).toMatchObject({ aiOverview: { mode: 'blur' } });
  });
});
