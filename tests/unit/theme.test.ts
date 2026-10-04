import { afterEach, describe, expect, it } from 'vitest';
import { detectTheme } from '../../src/content/ui/theme.ts';

afterEach(() => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
});

describe('detectTheme()', () => {
  it('reads a dark page background', () => {
    document.body.style.backgroundColor = 'rgb(32, 33, 36)';
    expect(detectTheme(document)).toBe('dark');
  });
  it('reads a light page background', () => {
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    expect(detectTheme(document)).toBe('light');
  });
  it('looks past a transparent body to the root element', () => {
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    document.documentElement.style.backgroundColor = 'rgb(18, 18, 18)';
    expect(detectTheme(document)).toBe('dark');
  });
  it('defaults to light when nothing says otherwise', () => {
    expect(detectTheme(document)).toBe('light');
  });
});

describe('detectTheme(): more backgrounds', () => {
  it('treats a mid-dark grey as dark and a light grey as light', () => {
    document.body.style.backgroundColor = 'rgb(48, 49, 52)';
    expect(detectTheme(document)).toBe('dark');
    document.body.style.backgroundColor = 'rgb(241, 243, 244)';
    expect(detectTheme(document)).toBe('light');
  });
  it('uses a translucent but mostly opaque background', () => {
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    expect(detectTheme(document)).toBe('dark');
  });
  it('ignores a nearly transparent background and falls through', () => {
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    expect(detectTheme(document)).toBe('light');
  });
  it('lets the body win over the root element', () => {
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    document.documentElement.style.backgroundColor = 'rgb(0, 0, 0)';
    expect(detectTheme(document)).toBe('light');
  });
  it('falls back to prefers-color-scheme when everything is transparent', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('dark'),
    })) as typeof window.matchMedia;
    try {
      expect(detectTheme(document)).toBe('dark');
    } finally {
      window.matchMedia = original;
    }
    expect(detectTheme(document)).toBe('light');
  });
  it('returns light for a document without a window', () => {
    const detached = document.implementation.createHTMLDocument('x');
    expect(detectTheme(detached)).toBe('light');
  });
});
