import { t } from '../../shared/i18n.ts';
import { createControl } from '../ui/control-bar.ts';
import { alignWithResults, mirrorPlacement } from '../ui/layout.ts';
import { ATTR_MODE, ATTR_OPEN, setOpenAttr, type ModeApply } from './types.ts';

/** The block is hidden; a slim bar above it expands it on click. */
export const applyCollapse: ModeApply = (root, ctx) => {
  const control = createControl({
    variant: 'bar',
    open: ctx.open,
    label: (open) => t(open ? 'barExpanded' : 'barCollapsed'),
    onToggle: (open) => {
      setOpenAttr(root, open);
      ctx.onToggle(open);
    },
  });
  // Mirror the block's grid placement while it still has its normal layout, then hide it.
  mirrorPlacement(control.host, root);
  root.before(control.host);
  const alignment = alignWithResults(control.host, root);
  root.setAttribute(ATTR_MODE, 'collapse');
  setOpenAttr(root, ctx.open);

  return {
    refreshTheme: control.refreshTheme,
    isIntact: () => control.host.isConnected,
    destroy() {
      alignment.destroy();
      control.destroy();
      root.removeAttribute(ATTR_MODE);
      root.removeAttribute(ATTR_OPEN);
    },
  };
};
