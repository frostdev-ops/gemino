import { t } from '../../shared/i18n.ts';
import { createControl } from '../ui/control-bar.ts';
import { alignWithResults, mirrorPlacement } from '../ui/layout.ts';
import { ATTR_MODE, ATTR_OPEN, VAR_PREVIEW, setOpenAttr, type ModeApply } from './types.ts';

/** A short faded preview of the block with a Show more / Show less button underneath. */
export const applyMinimize: ModeApply = (root, ctx) => {
  const control = createControl({
    variant: 'bar',
    open: ctx.open,
    label: (open) => t(open ? 'showLess' : 'showMore'),
    onToggle: (open) => {
      setOpenAttr(root, open);
      ctx.onToggle(open);
    },
  });
  mirrorPlacement(control.host, root);
  root.after(control.host);
  const alignment = alignWithResults(control.host, root);
  root.setAttribute(ATTR_MODE, 'minimize');
  setOpenAttr(root, ctx.open);
  (root as HTMLElement).style.setProperty(
    VAR_PREVIEW,
    `${ctx.settings.minimize.previewHeightPx}px`,
  );

  return {
    refreshTheme: control.refreshTheme,
    isIntact: () => control.host.isConnected,
    destroy() {
      alignment.destroy();
      control.destroy();
      root.removeAttribute(ATTR_MODE);
      root.removeAttribute(ATTR_OPEN);
      (root as HTMLElement).style.removeProperty(VAR_PREVIEW);
    },
  };
};
