export const BLOCK_MODES = ['show', 'hide', 'collapse', 'minimize', 'blur'] as const;
export type BlockMode = (typeof BLOCK_MODES)[number];

export const BLUR_REVEALS = ['hover', 'click'] as const;
export type BlurReveal = (typeof BLUR_REVEALS)[number];

export interface Settings {
  version: 1;
  /** Master switch. When false Gemino does nothing (and Web only is also suspended). */
  enabled: boolean;
  aiOverview: { mode: BlockMode };
  minimize: { previewHeightPx: number };
  blur: { strengthPx: number; reveal: BlurReveal };
  hideAiModeEntryPoints: boolean;
  hideGeminiPromos: boolean;
  /** Redirect /search navigations to udm=14 ("Web" results, no AI Overview). */
  webOnly: boolean;
  /** Outline detected blocks on the page. */
  debug: boolean;
}

export const LIMITS = {
  previewHeightPx: { min: 80, max: 400 },
  strengthPx: { min: 2, max: 20 },
} as const;

const DEFAULTS: Settings = {
  version: 1,
  enabled: true,
  aiOverview: { mode: 'collapse' },
  minimize: { previewHeightPx: 160 },
  blur: { strengthPx: 8, reveal: 'hover' },
  hideAiModeEntryPoints: true,
  hideGeminiPromos: true,
  webOnly: false,
  debug: false,
};

/** Read-only view of the defaults. Use defaultSettings() when you need a mutable copy. */
export const DEFAULT_SETTINGS: Readonly<Settings> = DEFAULTS;

export const STORAGE_KEY = 'settings';

export function defaultSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS) as Settings;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * Turns any stored value (missing, corrupted, hand-edited, older schema) into a valid Settings
 * object. Never throws. Every field is validated and numeric fields are clamped.
 */
export function migrate(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isRecord(raw)) return defaultSettings();

  const aiOverview = isRecord(raw.aiOverview) ? raw.aiOverview : {};
  const minimize = isRecord(raw.minimize) ? raw.minimize : {};
  const blur = isRecord(raw.blur) ? raw.blur : {};

  return {
    version: 1,
    enabled: bool(raw.enabled, d.enabled),
    aiOverview: { mode: oneOf(aiOverview.mode, BLOCK_MODES, d.aiOverview.mode) },
    minimize: {
      previewHeightPx: clampNumber(
        minimize.previewHeightPx,
        LIMITS.previewHeightPx.min,
        LIMITS.previewHeightPx.max,
        d.minimize.previewHeightPx,
      ),
    },
    blur: {
      strengthPx: clampNumber(
        blur.strengthPx,
        LIMITS.strengthPx.min,
        LIMITS.strengthPx.max,
        d.blur.strengthPx,
      ),
      reveal: oneOf(blur.reveal, BLUR_REVEALS, d.blur.reveal),
    },
    hideAiModeEntryPoints: bool(raw.hideAiModeEntryPoints, d.hideAiModeEntryPoints),
    hideGeminiPromos: bool(raw.hideGeminiPromos, d.hideGeminiPromos),
    webOnly: bool(raw.webOnly, d.webOnly),
    debug: bool(raw.debug, d.debug),
  };
}

/** Minimal slice of chrome.storage.StorageArea so tests can inject a fake. */
export interface StorageLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function area(): StorageLike {
  return chrome.storage.sync as unknown as StorageLike;
}

export async function loadSettings(storage: StorageLike = area()): Promise<Settings> {
  try {
    const items = await storage.get(STORAGE_KEY);
    return migrate(items[STORAGE_KEY]);
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(
  settings: Settings,
  storage: StorageLike = area(),
): Promise<Settings> {
  const clean = migrate(settings);
  await storage.set({ [STORAGE_KEY]: clean });
  return clean;
}

/** Applies a partial change on top of the stored settings and persists the result. */
export async function updateSettings(
  patch: (current: Settings) => Settings | void,
  storage: StorageLike = area(),
): Promise<Settings> {
  const current = await loadSettings(storage);
  const next = patch(current) ?? current;
  return saveSettings(next, storage);
}

/** Subscribes to settings changes from any extension context. Returns an unsubscribe function. */
export function watchSettings(cb: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (change) cb(migrate(change.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
