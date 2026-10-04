import { HOST_ATTR } from '../detect/targets.ts';
import { detectTheme } from './theme.ts';

export type ControlVariant = 'bar' | 'overlay';

export interface ControlOptions {
  variant: ControlVariant;
  /** Text for the current state. Called again whenever the state changes. */
  label: (open: boolean) => string;
  open: boolean;
  onToggle: (open: boolean) => void;
}

export interface Control {
  host: HTMLElement;
  setOpen(open: boolean): void;
  /** Re-reads the page theme. */
  refreshTheme(): void;
  destroy(): void;
}

const CSS = `
:host { all: initial; display: block; }
:host([data-variant="overlay"]) { position: absolute; inset: 0; z-index: 2; }
* { box-sizing: border-box; }
button {
  font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  color: var(--fg); background: var(--bg);
  border: 1px solid var(--border); border-radius: 12px;
  padding: 8px 12px; min-height: 32px; width: fit-content; max-width: 100%; text-align: start;
}
button:hover { background: var(--bg-hover); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chev { display: inline-block; width: 8px; height: 8px; flex: none;
  border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
  transform: rotate(-45deg); transition: transform .15s ease; }
:host([data-open="true"]) .chev { transform: rotate(45deg); }
:host([data-variant="overlay"]) button {
  position: absolute; inset: 0; width: 100%; height: 100%;
  justify-content: center; background: transparent; border: 0; border-radius: 0;
  color: var(--fg);
}
:host([data-variant="overlay"]) button:hover { background: var(--overlay-hover); }
:host([data-variant="overlay"]) .chev { display: none; }
:host([data-theme="light"]) {
  --fg: #202124; --bg: #f1f3f4; --bg-hover: #e8eaed; --border: #dadce0;
  --accent: #1a73e8; --overlay-hover: rgba(255,255,255,.35);
}
:host([data-theme="dark"]) {
  --fg: #e8eaed; --bg: #303134; --bg-hover: #3c4043; --border: #5f6368;
  --accent: #8ab4f8; --overlay-hover: rgba(0,0,0,.25);
}
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
`;

function applyStyles(shadow: ShadowRoot): void {
  // A constructed stylesheet is not subject to the page's style-src CSP; <style> is the fallback.
  try {
    const view = shadow.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    if (view && 'adoptedStyleSheets' in shadow && typeof view.CSSStyleSheet === 'function') {
      const sheet = new view.CSSStyleSheet();
      sheet.replaceSync(CSS);
      shadow.adoptedStyleSheets = [sheet];
      return;
    }
  } catch {
    /* fall through */
  }
  const style = shadow.ownerDocument.createElement('style');
  style.textContent = CSS;
  shadow.append(style);
}

/**
 * A button inside a Shadow DOM, so neither Google's CSS nor ours can leak across.
 * All text goes through textContent; nothing from the page is ever written as HTML.
 */
export function createControl(opts: ControlOptions): Control {
  const doc = document;
  const host = doc.createElement('div');
  host.setAttribute(HOST_ATTR, '');
  host.dataset.variant = opts.variant;
  const shadow = host.attachShadow({ mode: 'open' });
  applyStyles(shadow);

  const button = doc.createElement('button');
  button.type = 'button';
  const chev = doc.createElement('span');
  chev.className = 'chev';
  chev.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('span');
  button.append(chev, text);
  shadow.append(button);

  let open = opts.open;
  const render = () => {
    host.dataset.open = String(open);
    text.textContent = opts.label(open);
    button.setAttribute('aria-expanded', String(open));
  };
  const refreshTheme = () => {
    host.dataset.theme = detectTheme(doc);
  };

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    open = !open;
    render();
    opts.onToggle(open);
  });

  refreshTheme();
  render();

  return {
    host,
    setOpen(next) {
      open = next;
      render();
    },
    refreshTheme,
    destroy() {
      host.remove();
    },
  };
}
