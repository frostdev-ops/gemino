/**
 * Google's results container is a CSS grid (`#rcnt`) in which the AI Overview spans every column
 * (`grid-column: 1 / -1`). A control inserted next to it would otherwise be auto-placed into the
 * first, narrow column. This gives the control the same placement as the block it belongs to.
 *
 * Must be called before the block is hidden: it reads the block's computed style.
 */
export function mirrorPlacement(host: HTMLElement, reference: Element): void {
  const parent = reference.parentElement;
  const view = reference.ownerDocument.defaultView;
  if (!parent || !view) return;

  const parentDisplay = view.getComputedStyle(parent).display;
  const ref = view.getComputedStyle(reference);

  if (parentDisplay.includes('grid')) {
    if (ref.gridColumn) host.style.gridColumn = ref.gridColumn;
    if (ref.gridRow && ref.gridRow !== 'auto') host.style.gridRow = ref.gridRow;
  } else if (parentDisplay.includes('flex')) {
    // Take a full line of its own in a (wrapping) flex row; harmless in a column.
    host.style.flex = '1 1 100%';
    host.style.minWidth = '0';
  }
}

export interface Alignment {
  /** Re-measures and re-applies the offset (layout can shift after fonts, images, resizes). */
  refresh(): void;
  destroy(): void;
}

/** Largest correction we are willing to apply; anything bigger means we measured the wrong thing. */
const MAX_SHIFT_PX = 600;

/** The first organic result's title that is actually laid out, ignoring Gemino's own nodes. */
function firstResultTitle(doc: Document, exclude: Element): Element | null {
  for (const h3 of doc.querySelectorAll('#rso h3, #search h3')) {
    if (exclude.contains(h3) || h3.closest('[data-gemino-host]')) continue;
    const box = h3.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return h3;
  }
  return null;
}

/**
 * Lines the control's start edge up with the start edge of the first search result, so the bar
 * reads as sitting directly on top of the results. Google's AI Overview and its results do not
 * always share the same left edge (the grid area the block spans can start further in or out than
 * the result column), and that depends on the viewport, so it is measured rather than hard-coded.
 *
 * Only the control's own inline-start margin is touched; Google's nodes are never modified.
 */
export function alignWithResults(host: HTMLElement, block: Element): Alignment {
  const doc = host.ownerDocument;
  const view = doc.defaultView;

  const apply = (): void => {
    if (!view || !host.isConnected) return;
    host.style.removeProperty('margin-inline-start');
    const title = firstResultTitle(doc, block);
    if (!title) return;
    // The page's own stylesheet may already give the host a margin; ours has to replace it.
    const style = view.getComputedStyle(host);
    const rtl = style.direction === 'rtl';
    const own = Number.parseFloat(style.marginInlineStart) || 0;
    const hostBox = host.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    if (hostBox.width === 0 && hostBox.height === 0) return;
    // How far the host's start edge sits past the results' start edge (negative: before it).
    const shift = rtl ? titleBox.right - hostBox.right : titleBox.left - hostBox.left;
    const margin = own + (rtl ? -shift : shift);
    if (Math.abs(margin - own) < 1 || Math.abs(margin - own) > MAX_SHIFT_PX) return;
    host.style.setProperty('margin-inline-start', `${Math.round(margin)}px`);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const onResize = (): void => {
    clearTimeout(timer);
    timer = setTimeout(apply, 120);
  };
  view?.addEventListener('resize', onResize);
  apply();
  // Late layout shifts (webfonts, lazy sections) are caught by one more pass.
  const raf = view?.requestAnimationFrame?.(() => apply());
  const later = [400, 1500].map((ms) => setTimeout(apply, ms));

  return {
    refresh: apply,
    destroy() {
      clearTimeout(timer);
      later.forEach(clearTimeout);
      if (raf !== undefined) view?.cancelAnimationFrame?.(raf);
      view?.removeEventListener('resize', onResize);
      host.style.removeProperty('margin-inline-start');
    },
  };
}
