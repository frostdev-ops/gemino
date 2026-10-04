import type { Detection } from './detect/detect.ts';

const ATTR_DEBUG = 'data-gemino-debug';

/** Toggles the outline stylesheet rules in content.css. */
export function setDebugOutline(doc: Document, on: boolean): void {
  doc.documentElement.toggleAttribute(ATTR_DEBUG, on);
}

export function debugLog(enabled: boolean, d: Detection, mode: string): void {
  if (!enabled) return;
  console.debug('[Gemino]', d.target, `mode=${mode}`, d.root, 'matched by', d.trigger);
}
