import type { Settings } from '../../shared/settings.ts';

export const ATTR_MODE = 'data-gemino-mode';
export const ATTR_OPEN = 'data-gemino-open';
export const ATTR_REVEAL = 'data-gemino-reveal';
export const VAR_PREVIEW = '--gemino-preview';
export const VAR_BLUR = '--gemino-blur';

export interface ModeContext {
  settings: Settings;
  /** Whether the user already expanded this block (kept across live setting changes). */
  open: boolean;
  /** Called when the user expands or collapses the block through the control. */
  onToggle: (open: boolean) => void;
}

export interface ModeHandle {
  /** Re-read the page theme (the control follows Google's light/dark theme). */
  refreshTheme(): void;
  /** Whether the control Gemino inserted is still attached to the page. */
  isIntact(): boolean;
  /** Undo everything this mode did. */
  destroy(): void;
}

export type ModeApply = (root: Element, ctx: ModeContext) => ModeHandle;

export function setOpenAttr(root: Element, open: boolean): void {
  if (open) root.setAttribute(ATTR_OPEN, '');
  else root.removeAttribute(ATTR_OPEN);
}
