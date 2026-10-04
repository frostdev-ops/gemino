import { isAiModeLabel, isAiOverviewLabel } from './labels.ts';

export type TargetId = 'aiOverview' | 'aiModeEntry' | 'geminiPromo';

export const TARGET_IDS: readonly TargetId[] = ['aiOverview', 'aiModeEntry', 'geminiPromo'];

export interface Target {
  id: TargetId;
  /** CSS selectors for candidate elements. */
  selectors: readonly string[];
  /**
   * Heading candidates: elements matching these selectors count when their text equals a
   * known localized label. Used as a fallback when Google renames the structural hooks.
   */
  headingSelectors?: readonly string[];
  headingMatches?: (text: string) => boolean;
  /** Final yes/no on a candidate. */
  accept?: (el: Element) => boolean;
  /** The element that actually gets hidden/collapsed/etc. null rejects the candidate. */
  resolveRoot: (el: Element) => Element | null;
}

/** Everything that is (or contains) the organic results column. */
export const RESULTS_SELECTOR = '#center_col, #rso, #search, #res, #botstuff';

/**
 * Containers for Google's ad slots. On result pages with ads, Google puts the top ads slot (#tads
 * inside #tvcap) in the same wrapper as the AI Overview, so a climb that swallowed the wrapper
 * would hide the ads together with the AI Overview. Gemino only handles the AI Overview.
 */
export const ADS_SELECTOR = '#tads, #tadsb, #tvcap, #taw, #bottomads';

/** Ancestors the climb must never enter or pass. */
const STOP_SELECTOR = `${RESULTS_SELECTOR}, #rcnt, #cnt, #main, #gsr, body, html`;

/** The Gemino-owned elements; never treated as candidates. */
export const HOST_ATTR = 'data-gemino-host';

const MAX_CLIMB = 60;

/**
 * Climbs from `el` to the outermost ancestor that is still "just this block": it stops below
 * any stable page container and never includes the organic results column or an ads slot.
 */
export function climbToBlock(el: Element): Element {
  let cur = el;
  for (let i = 0; i < MAX_CLIMB; i++) {
    const parent = cur.parentElement;
    if (!parent) break;
    if (parent.matches(STOP_SELECTOR)) break;
    if (parent.querySelector(RESULTS_SELECTOR)) break;
    if (parent.querySelector(ADS_SELECTOR)) break;
    cur = parent;
  }
  return cur;
}

const NO_CLIMB_PARENT =
  'form, nav, [role="search"], [role="list"], [role="navigation"], [role="tablist"], [role="toolbar"]';

/**
 * Climbs through wrappers whose only child is `el`, so an emptied wrapper doesn't leave a gap.
 * Never leaves the immediate chain by more than `maxLevels`.
 */
export function climbSingleChildWrappers(el: Element, maxLevels = 4): Element {
  let cur = el;
  for (let i = 0; i < maxLevels; i++) {
    const parent = cur.parentElement;
    if (!parent) break;
    if (parent.children.length !== 1) break;
    if (parent.matches(STOP_SELECTOR) || parent.matches(NO_CLIMB_PARENT)) break;
    cur = parent;
  }
  return cur;
}

function isOrganic(el: Element): boolean {
  return el.closest('#search, #rso') !== null;
}

/** True for URLs pointing at Google's AI Mode: /search?...&udm=50 on a Google host. */
export function isAiModeUrl(href: string | null, base: string): boolean {
  if (!href || !href.includes('udm=50')) return false;
  try {
    const u = new URL(href, base);
    return (
      /^https?:$/.test(u.protocol) &&
      /^(www\.)?google\.[a-z.]+$/.test(u.hostname) &&
      u.pathname === '/search' &&
      u.searchParams.get('udm') === '50'
    );
  } catch {
    return false;
  }
}

export function isGeminiUrl(href: string | null, base: string): boolean {
  if (!href || !href.includes('gemini.google.com')) return false;
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) && u.hostname === 'gemini.google.com';
  } catch {
    return false;
  }
}

function baseUrl(el: Element): string {
  return el.ownerDocument.location?.href ?? 'https://www.google.com/';
}

const SHORT_LABEL_MAX = 40;

/**
 * The registry. Selectors were captured from live pages (en-US, en-GB, de, fr, ja, and 25 more
 * locales for labels); see tests/fixtures. When Google changes its markup, this is the place to fix.
 */
export const TARGETS: readonly Target[] = [
  {
    // The AI Overview. `#Odp5De` is the container Google has used across every locale tested;
    // the localized heading is the fallback if that id changes.
    id: 'aiOverview',
    selectors: ['#Odp5De'],
    headingSelectors: ['[role="heading"]', 'h1', 'h2'],
    headingMatches: isAiOverviewLabel,
    accept: (el) => el.closest('a') === null,
    resolveRoot: climbToBlock,
  },
  {
    // AI Mode entry points: the "AI Mode" tab in the results nav (anchor with udm=50), follow-up
    // chips that lead into AI Mode, and the "AI Mode" button inside the search box.
    id: 'aiModeEntry',
    selectors: [
      'a[href*="udm=50"]',
      'button[jsname="B6rgad"]',
      'button, [role="button"], [role="link"], [role="tab"]',
    ],
    accept: (el) => {
      if (el.tagName === 'A') return isAiModeUrl(el.getAttribute('href'), baseUrl(el));
      if (el.matches('button[jsname="B6rgad"]')) return true;
      // Label-based fallback for the search-box button; never inside organic results.
      const text = el.textContent ?? '';
      return text.length <= SHORT_LABEL_MAX && isAiModeLabel(text) && !isOrganic(el);
    },
    resolveRoot: (el) => climbSingleChildWrappers(el),
  },
  {
    // Gemini promos. A logged-out headless session shows none, so this is deliberately
    // conservative: only links to gemini.google.com outside the organic results.
    id: 'geminiPromo',
    selectors: ['a[href*="gemini.google.com"]'],
    accept: (el) => isGeminiUrl(el.getAttribute('href'), baseUrl(el)) && !isOrganic(el),
    resolveRoot: (el) => climbSingleChildWrappers(el),
  },
];
