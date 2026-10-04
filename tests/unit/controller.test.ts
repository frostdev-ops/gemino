import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../../src/content/controller.ts';
import { defaultSettings, type Settings } from '../../src/shared/settings.ts';
import { fixtureHtml } from './helpers.ts';

function settings(patch: (s: Settings) => void = () => {}): Settings {
  const s = defaultSettings();
  patch(s);
  return s;
}

function loadPage(name = 'aio-de'): void {
  document.documentElement.innerHTML = fixtureHtml(name);
}

const overview = () => document.querySelector<HTMLElement>('[data-gemino-target="aiOverview"]');
const hosts = () => [...document.querySelectorAll<HTMLElement>('[data-gemino-host]')];
const barButton = (host: HTMLElement) => host.shadowRoot!.querySelector('button')!;

function start(s: Settings, onCount?: (n: number) => void): Controller {
  const c = new Controller(document, s, onCount, false);
  c.scan(document);
  return c;
}

beforeEach(() => {
  loadPage();
});

describe('Controller: modes', () => {
  it('show leaves the block untouched but still marks nothing visible', () => {
    start(
      settings((s) => {
        s.aiOverview.mode = 'show';
        s.hideAiModeEntryPoints = false;
        s.hideGeminiPromos = false;
      }),
    );
    expect(overview()).toBeNull();
    expect(hosts()).toHaveLength(0);
  });

  it('hide sets the attribute and inserts nothing', () => {
    start(
      settings((s) => {
        s.aiOverview.mode = 'hide';
      }),
    );
    expect(overview()!.getAttribute('data-gemino-mode')).toBe('hide');
    expect(overview()!.parentElement!.querySelector('[data-gemino-host]')).toBeNull();
  });

  it('collapse puts a bar before the block and expands on click', () => {
    start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
    );
    const root = overview()!;
    expect(root.getAttribute('data-gemino-mode')).toBe('collapse');
    expect(root.hasAttribute('data-gemino-open')).toBe(false);

    const host = root.previousElementSibling as HTMLElement;
    expect(host.hasAttribute('data-gemino-host')).toBe(true);
    const button = barButton(host);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('Click to expand');

    button.click();
    expect(root.hasAttribute('data-gemino-open')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toContain('collapse');

    button.click();
    expect(root.hasAttribute('data-gemino-open')).toBe(false);
  });

  it('minimize sets the preview height and puts the button after the block', () => {
    start(
      settings((s) => {
        s.aiOverview.mode = 'minimize';
        s.minimize.previewHeightPx = 222;
        s.hideAiModeEntryPoints = false;
      }),
    );
    const root = overview()!;
    expect(root.style.getPropertyValue('--gemino-preview')).toBe('222px');
    const host = root.nextElementSibling as HTMLElement;
    expect(host.hasAttribute('data-gemino-host')).toBe(true);
    const button = barButton(host);
    expect(button.textContent).toBe('Show more');
    button.click();
    expect(button.textContent).toBe('Show less');
    expect(root.hasAttribute('data-gemino-open')).toBe(true);
  });

  it('blur on hover needs no control', () => {
    start(
      settings((s) => {
        s.aiOverview.mode = 'blur';
        s.blur.reveal = 'hover';
        s.blur.strengthPx = 12;
        s.hideAiModeEntryPoints = false;
      }),
    );
    const root = overview()!;
    expect(root.getAttribute('data-gemino-reveal')).toBe('hover');
    expect(root.style.getPropertyValue('--gemino-blur')).toBe('12px');
    expect(hosts()).toHaveLength(0);
  });

  it('blur on click adds an overlay inside the block that reveals it', () => {
    start(
      settings((s) => {
        s.aiOverview.mode = 'blur';
        s.blur.reveal = 'click';
        s.hideAiModeEntryPoints = false;
      }),
    );
    const root = overview()!;
    const host = root.querySelector<HTMLElement>(':scope > [data-gemino-host]')!;
    expect(host).not.toBeNull();
    expect(host.dataset.variant).toBe('overlay');
    barButton(host).click();
    expect(root.hasAttribute('data-gemino-open')).toBe(true);
    expect(host.style.display).toBe('none');
  });
});

describe('Controller: live changes', () => {
  it('switches mode without a reload and cleans up after itself', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(hosts()).toHaveLength(1);

    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'minimize';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(hosts()).toHaveLength(1);
    expect(overview()!.getAttribute('data-gemino-mode')).toBe('minimize');
    expect(overview()!.nextElementSibling).toBe(hosts()[0]);

    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'hide';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(hosts()).toHaveLength(0);
    expect(overview()!.getAttribute('data-gemino-mode')).toBe('hide');
    expect(overview()!.style.getPropertyValue('--gemino-preview')).toBe('');

    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'show';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(overview()!.hasAttribute('data-gemino-mode')).toBe(false);
  });

  it('finds blocks for a target that was switched on later', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'show';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(overview()).toBeNull();
    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'hide';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(overview()!.getAttribute('data-gemino-mode')).toBe('hide');
  });

  it('keeps a block the user expanded open when only an unrelated setting changes', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
    );
    barButton(hosts()[0]!).click();
    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
        s.webOnly = true;
      }),
    );
    expect(overview()!.hasAttribute('data-gemino-open')).toBe(true);
  });

  it('master switch off restores everything', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
      }),
    );
    expect(hosts().length).toBeGreaterThan(0);
    c.setSettings(
      settings((s) => {
        s.enabled = false;
      }),
    );
    expect(hosts()).toHaveLength(0);
    expect(document.querySelectorAll('[data-gemino-mode]')).toHaveLength(0);
  });

  it('reveal / re-hide for the current page', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'hide';
      }),
    );
    c.setRevealed(true);
    expect(document.querySelectorAll('[data-gemino-mode]')).toHaveLength(0);
    expect(c.state().revealed).toBe(true);
    c.setRevealed(false);
    expect(overview()!.getAttribute('data-gemino-mode')).toBe('hide');
  });

  it('debug shows blocks and turns on outlines', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'hide';
        s.debug = true;
      }),
    );
    expect(document.documentElement.hasAttribute('data-gemino-debug')).toBe(true);
    expect(overview()).not.toBeNull();
    expect(document.querySelectorAll('[data-gemino-mode]')).toHaveLength(0);
    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'hide';
      }),
    );
    expect(document.documentElement.hasAttribute('data-gemino-debug')).toBe(false);
    expect(overview()!.getAttribute('data-gemino-mode')).toBe('hide');
  });
});

describe('Controller: AI Mode entry points', () => {
  it('hides the nav tab and the search-box button, and restores them', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'show';
        s.hideAiModeEntryPoints = true;
      }),
    );
    const entries = document.querySelectorAll('[data-gemino-target="aiModeEntry"]');
    expect(entries.length).toBeGreaterThanOrEqual(2);
    entries.forEach((e) => expect(e.getAttribute('data-gemino-mode')).toBe('hide'));

    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'show';
        s.hideAiModeEntryPoints = false;
      }),
    );
    document.querySelectorAll('[data-gemino-target="aiModeEntry"]').forEach((e) => {
      expect(e.hasAttribute('data-gemino-mode')).toBe(false);
    });
  });
});

describe('Controller: page changes', () => {
  it('handles an AI Overview that appears after the first scan', () => {
    const root = overview;
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
    );
    const block = root()!;
    const parent = block.parentElement!;
    const next = block.nextSibling;

    // Google re-renders: the block disappears (bar removed with it), then a fresh one streams in.
    block.remove();
    c.scan(document);
    expect(hosts()).toHaveLength(0);

    parent.insertBefore(block, next);
    block.removeAttribute('data-gemino-target');
    block.removeAttribute('data-gemino-mode');
    c.scan(block);
    expect(block.getAttribute('data-gemino-mode')).toBe('collapse');
    expect(hosts()).toHaveLength(1);
  });

  it('recreates a control that Google removed from the page', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
    );
    hosts()[0]!.remove();
    expect(hosts()).toHaveLength(0);
    c.scan(document);
    expect(hosts()).toHaveLength(1);
  });

  it('never treats its own controls as candidates (no feedback loop)', () => {
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
    );
    const before = document.querySelectorAll('[data-gemino-target]').length;
    c.scan(document);
    c.scan(hosts()[0]!);
    expect(document.querySelectorAll('[data-gemino-target]').length).toBe(before);
    expect(hosts()).toHaveLength(1);
  });
});

describe('Controller: handled count', () => {
  it('reports how many blocks are being handled and updates on change', () => {
    const onCount = vi.fn();
    const c = start(
      settings((s) => {
        s.aiOverview.mode = 'collapse';
        s.hideAiModeEntryPoints = false;
      }),
      onCount,
    );
    expect(onCount).toHaveBeenLastCalledWith(1);
    expect(c.state().handled).toBe(1);

    c.setSettings(
      settings((s) => {
        s.aiOverview.mode = 'show';
        s.hideAiModeEntryPoints = false;
      }),
    );
    expect(onCount).toHaveBeenLastCalledWith(0);

    const calls = onCount.mock.calls.length;
    c.scan(document); // nothing changed: no new report
    expect(onCount.mock.calls.length).toBe(calls);
  });
});
