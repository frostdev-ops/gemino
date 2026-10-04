export type Theme = 'light' | 'dark';

function parseRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = value.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/,
  );
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
}

function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Light or dark, judged from the page's actual background so the control matches Google's own
 * theme (which can differ from the OS setting). Falls back to prefers-color-scheme.
 */
export function detectTheme(doc: Document = document): Theme {
  const view = doc.defaultView;
  if (view) {
    for (const el of [doc.body, doc.documentElement]) {
      if (!el) continue;
      const rgb = parseRgb(view.getComputedStyle(el).backgroundColor);
      if (rgb && rgb.a > 0.5) return luminance(rgb.r, rgb.g, rgb.b) < 0.4 ? 'dark' : 'light';
    }
    if (view.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'light';
}
