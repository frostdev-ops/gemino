import { describe, expect, it } from 'vitest';
import { detect } from '../../src/content/detect/detect.ts';
import { isAiModeLabel, isAiOverviewLabel } from '../../src/content/detect/labels.ts';
import { isAiModeUrl, isGeminiUrl } from '../../src/content/detect/targets.ts';
import labels from '../fixtures/labels-live.json' with { type: 'json' };
import { loadFixtureDocument, parseHtml } from './helpers.ts';

const AIO_FIXTURES = ['aio-en-us', 'aio-en-gb', 'aio-de', 'aio-fr', 'aio-ja'] as const;

describe('AI Overview detection on live captures', () => {
  it.each(AIO_FIXTURES)('%s: finds exactly one block, outside the organic results', (name) => {
    const doc = loadFixtureDocument(name);
    const found = detect(doc).filter((d) => d.target === 'aiOverview');
    expect(found).toHaveLength(1);

    const root = found[0]!.root;
    expect(root.querySelector('#Odp5De') ?? (root.id === 'Odp5De' ? root : null)).not.toBeNull();
    // The whole block, never the results column.
    expect(root.querySelector('#center_col, #rso, #search')).toBeNull();
    expect(root.closest('#center_col, #rso, #search')).toBeNull();
    // Ads share a wrapper with the AI Overview; they must stay outside the block.
    expect(root.querySelector('#tads, #tadsb, #tvcap, #taw')).toBeNull();
    expect(root.closest('#tads, #tadsb, #tvcap, #taw')).toBeNull();
    expect(root.closest('#rcnt')).not.toBeNull();
    expect(doc.querySelector('#center_col')).not.toBeNull();
  });

  it('aio-en-us: the ads slot is a sibling-side neighbour of the block, not part of it', () => {
    const doc = loadFixtureDocument('aio-en-us');
    const ads = doc.querySelector('#tads');
    expect(ads).not.toBeNull();
    const root = detect(doc).find((d) => d.target === 'aiOverview')!.root;
    // Same wrapper (that is why a naive climb would swallow it), but outside the block.
    expect(root.parentElement?.contains(ads)).toBe(true);
    expect(root.contains(ads)).toBe(false);
  });

  it('does not climb into a wrapper that also holds an ads slot', () => {
    const doc = parseHtml(`
      <div id="rcnt">
        <div class="wrapper">
          <div id="tvcap"><div id="tads">Sponsored Ad</div></div>
          <div class="slot"><div class="inner"><div id="Odp5De">AI Overview text</div></div></div>
        </div>
        <div id="center_col"><div id="rso">result</div></div>
      </div>`);
    const root = detect(doc).find((d) => d.target === 'aiOverview')!.root;
    expect(root.className).toBe('slot');
    expect(root.textContent).not.toMatch(/Sponsored/);
  });

  it('still takes the whole wrapper when there is no ads slot', () => {
    const doc = parseHtml(`
      <div id="rcnt">
        <div class="wrapper">
          <div class="slot"><div id="Odp5De">AI Overview text</div></div>
        </div>
        <div id="center_col"><div id="rso">result</div></div>
      </div>`);
    const root = detect(doc).find((d) => d.target === 'aiOverview')!.root;
    expect(root.className).toBe('wrapper');
  });

  it('finds nothing on a results page without an AI Overview', () => {
    const doc = loadFixtureDocument('no-aio-en');
    expect(detect(doc).filter((d) => d.target === 'aiOverview')).toHaveLength(0);
  });

  it('finds nothing on the homepage', () => {
    const doc = loadFixtureDocument('home-en', 'https://www.google.com/');
    expect(detect(doc).filter((d) => d.target === 'aiOverview')).toHaveLength(0);
  });

  it.each(AIO_FIXTURES)(
    '%s: falls back to the localized heading when the container id disappears',
    (name) => {
      const doc = loadFixtureDocument(name);
      const before = detect(doc).find((d) => d.target === 'aiOverview')!;
      doc.getElementById('Odp5De')!.removeAttribute('id');

      // Google keeps a hidden duplicate of the heading in the results column (en pages); with a
      // layout engine it has no boxes. Emulate that here: only the real heading is rendered.
      for (const h of doc.querySelectorAll('[role="heading"]')) {
        const real = before.root.contains(h);
        h.getClientRects = (() => (real ? [{}] : [])) as unknown as Element['getClientRects'];
      }
      const after = detect(doc, { requireRendered: true }).filter((d) => d.target === 'aiOverview');
      expect(after).toHaveLength(1);
      expect(after[0]!.root).toBe(before.root);
    },
  );

  it('ignores the hidden duplicate heading while the structural hook exists', () => {
    const doc = loadFixtureDocument('aio-en-us');
    // Two headings carry the label (visible one in #Odp5De, hidden duplicate in #rso)...
    const labelled = [...doc.querySelectorAll('[role="heading"]')].filter(
      (h) => h.textContent?.trim() === 'AI Overview',
    );
    expect(labelled.length).toBeGreaterThan(1);
    // ...but only the structural container produces a detection.
    expect(detect(doc).filter((d) => d.target === 'aiOverview')).toHaveLength(1);
  });

  it('is idempotent: marked blocks are not reported twice', () => {
    const doc = loadFixtureDocument('aio-en-us');
    const first = detect(doc);
    for (const d of first) d.root.setAttribute('data-gemino-target', d.target);
    expect(detect(doc)).toHaveLength(0);
  });

  it('catches an AI Overview that streams in after the first scan', () => {
    const doc = loadFixtureDocument('aio-de');
    const root = detect(doc).find((d) => d.target === 'aiOverview')!.root;
    const parent = root.parentElement!;
    const next = root.nextSibling;
    root.remove();
    expect(detect(doc).filter((d) => d.target === 'aiOverview')).toHaveLength(0);

    // The observer hands the added subtree to detect(); the block is found from that scope alone.
    parent.insertBefore(root, next);
    const found = detect(root).filter((d) => d.target === 'aiOverview');
    expect(found).toHaveLength(1);
    expect(found[0]!.root).toBe(root);
  });

  it('catches the heading arriving inside an already existing container', () => {
    const doc = loadFixtureDocument('aio-de');
    const container = doc.getElementById('Odp5De')!;
    const heading = doc.querySelector<HTMLElement>('#Odp5De [role="heading"]')!;
    expect(heading).not.toBeNull();
    const parent = heading.parentElement!;
    heading.remove();
    container.removeAttribute('id');
    expect(detect(doc).filter((d) => d.target === 'aiOverview')).toHaveLength(0);
    parent.prepend(heading);
    expect(detect(heading).filter((d) => d.target === 'aiOverview')).toHaveLength(1);
  });
});

describe('AI Mode entry points', () => {
  it('finds the nav tab, the search-box button and the follow-up chips (en-US)', () => {
    const doc = loadFixtureDocument('aio-en-us');
    const entries = detect(doc).filter((d) => d.target === 'aiModeEntry');

    const tab = entries.find(
      (d) =>
        d.trigger.tagName === 'A' &&
        d.root.closest('[role="list"]') &&
        !d.trigger.classList.contains('rmysyd'),
    );
    expect(tab).toBeDefined();
    // The whole list item goes, not just the link, so no empty gap remains.
    expect(tab!.root.getAttribute('role')).toBe('listitem');

    const button = entries.find((d) => d.trigger.matches('button[jsname="B6rgad"]'));
    expect(button).toBeDefined();
    expect(button!.root.closest('form')).not.toBeNull();
  });

  it('treats chips inside an AI Overview as part of that block', () => {
    const doc = loadFixtureDocument('aio-en-us');
    const found = detect(doc);
    const overview = found.find((d) => d.target === 'aiOverview')!;
    const chips = found.filter((d) => d.target === 'aiModeEntry' && overview.root.contains(d.root));
    expect(chips).toHaveLength(0);
  });

  it('finds the search-box button on the homepage', () => {
    const doc = loadFixtureDocument('home-en', 'https://www.google.com/');
    const entries = detect(doc).filter((d) => d.target === 'aiModeEntry');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.trigger.tagName).toBe('BUTTON');
  });

  it('finds the button by its localized label when Google changes the hook', () => {
    const doc = loadFixtureDocument('home-de', 'https://www.google.com/');
    doc.querySelector('button[jsname="B6rgad"]')!.removeAttribute('jsname');
    const entries = detect(doc).filter((d) => d.target === 'aiModeEntry');
    expect(entries).toHaveLength(1);
  });

  it('does not touch an organic result that merely mentions AI Mode', () => {
    const doc = parseHtml(`
      <div id="center_col"><div id="rso"><div class="g">
        <a href="https://example.com/post"><button>AI Mode</button></a>
      </div></div></div>`);
    expect(detect(doc).filter((d) => d.target === 'aiModeEntry')).toHaveLength(0);
  });
});

describe('Gemino URL helpers', () => {
  const base = 'https://www.google.com/search?q=x';
  it('recognizes AI Mode URLs only on Google /search with udm=50', () => {
    expect(isAiModeUrl('/search?q=x&udm=50', base)).toBe(true);
    expect(isAiModeUrl('https://www.google.de/search?udm=50&q=x', base)).toBe(true);
    expect(isAiModeUrl('/search?q=x&udm=14', base)).toBe(false);
    expect(isAiModeUrl('/search?q=x&udm=500', base)).toBe(false);
    expect(isAiModeUrl('https://evil.example/search?udm=50', base)).toBe(false);
    expect(isAiModeUrl('javascript:udm=50', base)).toBe(false);
    expect(isAiModeUrl(null, base)).toBe(false);
  });
  it('recognizes Gemini links by exact host', () => {
    expect(isGeminiUrl('https://gemini.google.com/app', base)).toBe(true);
    expect(isGeminiUrl('https://gemini.google.com.evil.example/', base)).toBe(false);
    expect(isGeminiUrl('https://example.com/?u=gemini.google.com', base)).toBe(false);
  });
});

describe('Gemini promos (synthetic markup: logged-out captures contain none)', () => {
  it('detects a promo link outside the results and removes its single-child wrappers', () => {
    const doc = parseHtml(`
      <div id="top"><div class="outer"><div class="inner">
        <a href="https://gemini.google.com/app?utm_source=google">Try Gemini</a>
      </div></div><span>keep me</span></div>
      <div id="center_col"><div id="rso"></div></div>`);
    const promos = detect(doc).filter((d) => d.target === 'geminiPromo');
    expect(promos).toHaveLength(1);
    expect(promos[0]!.root.className).toBe('outer');
  });

  it('leaves organic results that link to Gemini alone', () => {
    const doc = parseHtml(`
      <div id="center_col"><div id="rso"><div class="g">
        <a href="https://gemini.google.com/">Gemini - chat to supercharge your ideas</a>
      </div></div></div>`);
    expect(detect(doc).filter((d) => d.target === 'geminiPromo')).toHaveLength(0);
  });
});

describe('localized labels confirmed on live pages', () => {
  const entries = Object.entries(labels.locales) as [
    string,
    { overview: string; aiMode: string | null },
  ][];
  it.each(entries)('%s', (_locale, l) => {
    expect(isAiOverviewLabel(l.overview)).toBe(true);
    if (l.aiMode) expect(isAiModeLabel(l.aiMode)).toBe(true);
  });
  it('does not match arbitrary text', () => {
    expect(isAiOverviewLabel('Web results')).toBe(false);
    expect(isAiOverviewLabel('')).toBe(false);
    expect(isAiModeLabel('AI Mode and more words that make this a sentence')).toBe(false);
  });
  it('ignores case, spacing and non-breaking hyphens', () => {
    expect(isAiOverviewLabel('  ai   overview ')).toBe(true);
    expect(isAiModeLabel('KI-Modus')).toBe(true); // ASCII hyphen vs Google's U+2011
  });
});
