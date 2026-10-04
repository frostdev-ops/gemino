import { describe, expect, it } from 'vitest';
import {
  BLOCK_MODES,
  BLUR_REVEALS,
  DEFAULT_SETTINGS,
  LIMITS,
  STORAGE_KEY,
  clampNumber,
  defaultSettings,
  loadSettings,
  migrate,
  saveSettings,
  updateSettings,
  type Settings,
  type StorageLike,
} from '../../src/shared/settings.ts';

function memoryStorage(
  initial: Record<string, unknown> = {},
): StorageLike & { data: Record<string, unknown>; writes: number } {
  const data = { ...initial };
  const storage = {
    data,
    writes: 0,
    get: async (key: string) => (key in data ? { [key]: data[key] } : {}),
    set: async (items: Record<string, unknown>) => {
      storage.writes += 1;
      Object.assign(data, items);
    },
  };
  return storage;
}

const failingStorage: StorageLike = {
  get: async () => {
    throw new Error('storage unavailable');
  },
  set: async () => {
    throw new Error('storage unavailable');
  },
};

describe('migrate(): non-object input', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['array', []],
    ['array with an object inside', [{ enabled: false }]],
    ['string', 'x'],
    ['JSON string', '{"enabled":false}'],
    ['number', 42],
    ['NaN', NaN],
    ['boolean', true],
    ['function', () => ({})],
  ])('returns the defaults for %s', (_name, raw) => {
    expect(migrate(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns an object that is not the shared defaults', () => {
    const s = migrate(undefined);
    expect(s).not.toBe(DEFAULT_SETTINGS);
    expect(s.aiOverview).not.toBe(DEFAULT_SETTINGS.aiOverview);
  });
});

describe('migrate(): valid and partial input', () => {
  const full: Settings = {
    version: 1,
    enabled: false,
    aiOverview: { mode: 'blur' },
    minimize: { previewHeightPx: 250 },
    blur: { strengthPx: 12, reveal: 'click' },
    hideAiModeEntryPoints: false,
    hideGeminiPromos: false,
    webOnly: true,
    debug: true,
  };

  it('keeps every valid value', () => {
    expect(migrate(full)).toEqual(full);
  });

  it('fills in the defaults for a partial object', () => {
    const s = migrate({ webOnly: true });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, webOnly: true });
  });

  it('keeps one nested value and defaults its siblings', () => {
    const s = migrate({ blur: { strengthPx: 10 } });
    expect(s.blur).toEqual({ strengthPx: 10, reveal: DEFAULT_SETTINGS.blur.reveal });
  });

  it('accepts every known mode and reveal value', () => {
    for (const mode of BLOCK_MODES)
      expect(migrate({ aiOverview: { mode } }).aiOverview.mode).toBe(mode);
    for (const reveal of BLUR_REVEALS)
      expect(migrate({ blur: { reveal } }).blur.reveal).toBe(reveal);
  });

  it('is idempotent', () => {
    const once = migrate({ aiOverview: { mode: 'minimize' }, minimize: { previewHeightPx: 9 } });
    expect(migrate(once)).toEqual(once);
  });
});

describe('migrate(): invalid values', () => {
  it.each(['explode', '', 'COLLAPSE', 'Hide', ' hide', 7, null, undefined, {}, ['hide'], true])(
    'falls back to collapse for the mode %j',
    (mode) => {
      expect(migrate({ aiOverview: { mode } }).aiOverview.mode).toBe('collapse');
    },
  );

  it.each(['sometimes', 'HOVER', 1, null, {}])(
    'falls back to hover for the reveal %j',
    (reveal) => {
      expect(migrate({ blur: { reveal } }).blur.reveal).toBe('hover');
    },
  );

  it.each(['yes', 'true', 1, 0, null, {}, []])(
    'ignores the non-boolean %j for every boolean field',
    (value) => {
      const s = migrate({
        enabled: value,
        hideAiModeEntryPoints: value,
        hideGeminiPromos: value,
        webOnly: value,
        debug: value,
      });
      expect(s).toEqual(DEFAULT_SETTINGS);
    },
  );

  it('accepts false for fields whose default is true', () => {
    const s = migrate({ enabled: false, hideAiModeEntryPoints: false, hideGeminiPromos: false });
    expect(s.enabled).toBe(false);
    expect(s.hideAiModeEntryPoints).toBe(false);
    expect(s.hideGeminiPromos).toBe(false);
  });

  it.each(['tall', '200', null, undefined, {}, [], true, NaN, Infinity, -Infinity])(
    'uses the default for the non-finite or non-number %j',
    (value) => {
      expect(migrate({ minimize: { previewHeightPx: value } }).minimize.previewHeightPx).toBe(160);
      expect(migrate({ blur: { strengthPx: value } }).blur.strengthPx).toBe(8);
    },
  );

  it('survives wrongly shaped nested objects', () => {
    expect(migrate({ aiOverview: 'hide', minimize: null, blur: [] })).toEqual(DEFAULT_SETTINGS);
    expect(migrate({ aiOverview: 7, minimize: 'big', blur: true })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('migrate(): clamping', () => {
  const { previewHeightPx: h, strengthPx: b } = LIMITS;

  it('clamps the preview height to its limits', () => {
    expect(migrate({ minimize: { previewHeightPx: h.min - 1 } }).minimize.previewHeightPx).toBe(
      h.min,
    );
    expect(migrate({ minimize: { previewHeightPx: -500 } }).minimize.previewHeightPx).toBe(h.min);
    expect(migrate({ minimize: { previewHeightPx: h.max + 1 } }).minimize.previewHeightPx).toBe(
      h.max,
    );
    expect(migrate({ minimize: { previewHeightPx: 1e9 } }).minimize.previewHeightPx).toBe(h.max);
    expect(migrate({ minimize: { previewHeightPx: h.min } }).minimize.previewHeightPx).toBe(h.min);
    expect(migrate({ minimize: { previewHeightPx: h.max } }).minimize.previewHeightPx).toBe(h.max);
  });

  it('clamps the blur strength to its limits', () => {
    expect(migrate({ blur: { strengthPx: 0 } }).blur.strengthPx).toBe(b.min);
    expect(migrate({ blur: { strengthPx: -3 } }).blur.strengthPx).toBe(b.min);
    expect(migrate({ blur: { strengthPx: 1000 } }).blur.strengthPx).toBe(b.max);
    expect(migrate({ blur: { strengthPx: Number.MAX_VALUE } }).blur.strengthPx).toBe(b.max);
  });

  it('rounds fractional values', () => {
    expect(migrate({ blur: { strengthPx: 7.6 } }).blur.strengthPx).toBe(8);
    expect(migrate({ blur: { strengthPx: 7.4 } }).blur.strengthPx).toBe(7);
    expect(migrate({ minimize: { previewHeightPx: 160.5 } }).minimize.previewHeightPx).toBe(161);
  });

  it('clampNumber() applies the fallback only to non-finite or non-number input', () => {
    expect(clampNumber(NaN, 1, 5, 3)).toBe(3);
    expect(clampNumber('4', 1, 5, 3)).toBe(3);
    expect(clampNumber(4, 1, 5, 3)).toBe(4);
    expect(clampNumber(99, 1, 5, 3)).toBe(5);
    expect(clampNumber(-99, 1, 5, 3)).toBe(1);
  });
});

describe('migrate(): unknown keys and versions', () => {
  it('drops unknown keys at every level', () => {
    const s = migrate({
      evil: '<script>',
      aiOverview: { mode: 'hide', extra: 1 },
      minimize: { previewHeightPx: 200, extra: 1 },
      blur: { strengthPx: 5, reveal: 'click', extra: 1 },
    });
    expect(s).not.toHaveProperty('evil');
    expect(s.aiOverview).toEqual({ mode: 'hide' });
    expect(s.minimize).toEqual({ previewHeightPx: 200 });
    expect(s.blur).toEqual({ strengthPx: 5, reveal: 'click' });
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });

  it.each([0, 2, 99, -1, '1', null, NaN])(
    'always stamps version 1 (stored version %j)',
    (version) => {
      expect(migrate({ version, webOnly: true })).toEqual({ ...DEFAULT_SETTINGS, webOnly: true });
    },
  );

  it('keeps known fields of a future schema version', () => {
    const s = migrate({ version: 7, aiOverview: { mode: 'blur' }, futureField: { a: 1 } });
    expect(s.version).toBe(1);
    expect(s.aiOverview.mode).toBe('blur');
    expect(s).not.toHaveProperty('futureField');
  });
});

describe('migrate(): hostile JSON', () => {
  it('does not copy a literal __proto__ key or pollute prototypes', () => {
    const raw = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"webOnly":true}');
    const s = migrate(raw);
    expect(s.webOnly).toBe(true);
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
  });
});

describe('defaultSettings()', () => {
  it('returns a deep, independent copy each time', () => {
    const a = defaultSettings();
    a.aiOverview.mode = 'hide';
    a.blur.strengthPx = 20;
    a.webOnly = true;
    const b = defaultSettings();
    expect(b).toEqual(DEFAULT_SETTINGS);
    expect(b).not.toBe(a);
    expect(b.aiOverview).not.toBe(a.aiOverview);
    expect(DEFAULT_SETTINGS.aiOverview.mode).toBe('collapse');
    expect(DEFAULT_SETTINGS.webOnly).toBe(false);
  });

  it('defaults to collapse, enabled, Web only off', () => {
    const d = defaultSettings();
    expect(d.enabled).toBe(true);
    expect(d.aiOverview.mode).toBe('collapse');
    expect(d.webOnly).toBe(false);
    expect(d.version).toBe(1);
  });
});

describe('loadSettings()', () => {
  it('returns the defaults when nothing is stored', async () => {
    expect(await loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('reads the stored value under the settings key', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: { ...defaultSettings(), webOnly: true } });
    expect((await loadSettings(storage)).webOnly).toBe(true);
  });

  it('repairs a corrupted stored value without writing back', async () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: { aiOverview: { mode: 'nope' }, webOnly: true },
    });
    const s = await loadSettings(storage);
    expect(s.aiOverview.mode).toBe('collapse');
    expect(s.webOnly).toBe(true);
    expect(storage.writes).toBe(0);
  });

  it('returns the defaults if storage throws', async () => {
    expect(await loadSettings(failingStorage)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings()', () => {
  it('writes the validated settings under the settings key and returns them', async () => {
    const storage = memoryStorage();
    const next = { ...defaultSettings(), debug: true };
    const saved = await saveSettings(next, storage);
    expect(saved).toEqual(next);
    expect(storage.data[STORAGE_KEY]).toEqual(next);
  });

  it('re-validates: out-of-range, wrong types and extra keys never reach storage', async () => {
    const storage = memoryStorage();
    const bad = {
      ...defaultSettings(),
      minimize: { previewHeightPx: 10_000 },
      aiOverview: { mode: 'explode' },
      extra: 'x',
    } as unknown as Settings;
    const saved = await saveSettings(bad, storage);
    expect(saved.minimize.previewHeightPx).toBe(LIMITS.previewHeightPx.max);
    expect(saved.aiOverview.mode).toBe('collapse');
    expect(storage.data[STORAGE_KEY]).toEqual(saved);
    expect(storage.data[STORAGE_KEY]).not.toHaveProperty('extra');
  });

  it('propagates storage write errors to the caller', async () => {
    await expect(saveSettings(defaultSettings(), failingStorage)).rejects.toThrow(
      'storage unavailable',
    );
  });
});

describe('updateSettings()', () => {
  it('applies a mutating patch on top of what is stored', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: { webOnly: true } });
    const next = await updateSettings((s) => {
      s.aiOverview.mode = 'blur';
    }, storage);
    expect(next.webOnly).toBe(true);
    expect(next.aiOverview.mode).toBe('blur');
    expect(storage.data[STORAGE_KEY]).toEqual(next);
  });

  it('applies a patch that returns a new object', async () => {
    const storage = memoryStorage();
    const next = await updateSettings((s) => ({ ...s, enabled: false }), storage);
    expect(next.enabled).toBe(false);
  });

  it('validates the patch result', async () => {
    const storage = memoryStorage();
    const next = await updateSettings((s) => {
      s.blur.strengthPx = 9999;
    }, storage);
    expect(next.blur.strengthPx).toBe(LIMITS.strengthPx.max);
  });

  it('starts from the defaults if storage cannot be read, then fails on write', async () => {
    let seen: Settings | undefined;
    await expect(
      updateSettings((s) => {
        seen = structuredClone(s);
      }, failingStorage),
    ).rejects.toThrow();
    expect(seen).toEqual(DEFAULT_SETTINGS);
  });
});
