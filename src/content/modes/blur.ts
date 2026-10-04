import { t } from '../../shared/i18n.ts';
import { createControl, type Control } from '../ui/control-bar.ts';
import {
  ATTR_MODE,
  ATTR_OPEN,
  ATTR_REVEAL,
  VAR_BLUR,
  setOpenAttr,
  type ModeApply,
} from './types.ts';

/**
 * The block's content is blurred (content.css blurs the block's children, so the reveal overlay,
 * which lives inside the block, stays sharp). Reveal on hover/focus, or with a click overlay.
 */
export const applyBlur: ModeApply = (root, ctx) => {
  const { strengthPx, reveal } = ctx.settings.blur;
  root.setAttribute(ATTR_MODE, 'blur');
  root.setAttribute(ATTR_REVEAL, reveal);
  setOpenAttr(root, ctx.open);
  (root as HTMLElement).style.setProperty(VAR_BLUR, `${strengthPx}px`);

  let control: Control | null = null;
  if (reveal === 'click') {
    control = createControl({
      variant: 'overlay',
      open: ctx.open,
      label: () => t('revealBlurred'),
      onToggle: (open) => {
        setOpenAttr(root, open);
        if (control) control.host.style.display = open ? 'none' : '';
        ctx.onToggle(open);
      },
    });
    control.host.style.display = ctx.open ? 'none' : '';
    root.append(control.host);
  }

  return {
    refreshTheme: () => control?.refreshTheme(),
    isIntact: () => !control || control.host.isConnected,
    destroy() {
      control?.destroy();
      root.removeAttribute(ATTR_MODE);
      root.removeAttribute(ATTR_OPEN);
      root.removeAttribute(ATTR_REVEAL);
      (root as HTMLElement).style.removeProperty(VAR_BLUR);
    },
  };
};
