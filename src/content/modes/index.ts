import type { BlockMode } from '../../shared/settings.ts';
import { applyBlur } from './blur.ts';
import { applyCollapse } from './collapse.ts';
import { applyHide } from './hide.ts';
import { applyMinimize } from './minimize.ts';
import type { ModeApply, ModeContext, ModeHandle } from './types.ts';

const RENDERERS: Record<Exclude<BlockMode, 'show'>, ModeApply> = {
  hide: applyHide,
  collapse: applyCollapse,
  minimize: applyMinimize,
  blur: applyBlur,
};

/** 'show' leaves the block untouched and returns null. */
export function applyMode(mode: BlockMode, root: Element, ctx: ModeContext): ModeHandle | null {
  if (mode === 'show') return null;
  return RENDERERS[mode](root, ctx);
}

export type { ModeContext, ModeHandle } from './types.ts';
