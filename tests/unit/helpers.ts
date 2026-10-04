import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');

export function fixtureHtml(name: string): string {
  return readFileSync(resolve(FIXTURES, `${name}.html`), 'utf8');
}

/** Parses a saved Google page into its own happy-dom window with a realistic location. */
export function loadFixtureDocument(
  name: string,
  url = 'https://www.google.com/search?q=test',
): Document {
  const window = new Window({ url });
  window.document.write(fixtureHtml(name));
  return window.document as unknown as Document;
}

/** A tiny synthetic page for cases no live capture could provide. */
export function parseHtml(html: string, url = 'https://www.google.com/search?q=test'): Document {
  const window = new Window({ url });
  window.document.write(`<!DOCTYPE html><html><body>${html}</body></html>`);
  return window.document as unknown as Document;
}
