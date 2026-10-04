import { ATTR_MODE, type ModeApply } from './types.ts';

/** display: none, applied by content.css. Nothing is moved or deleted. */
export const applyHide: ModeApply = (root) => {
  root.setAttribute(ATTR_MODE, 'hide');
  return {
    refreshTheme() {},
    isIntact: () => true,
    destroy() {
      root.removeAttribute(ATTR_MODE);
    },
  };
};
