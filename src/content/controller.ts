import type { BlockMode, Settings } from '../shared/settings.ts';
import type { PageStateResponse } from '../shared/messages.ts';
import { debugLog, setDebugOutline } from './debug.ts';
import { ATTR_TARGET, detect, type Detection } from './detect/detect.ts';
import type { TargetId } from './detect/targets.ts';
import { applyMode, type ModeHandle } from './modes/index.ts';

const ATTR_ID = 'data-gemino-id';

interface Tracked {
  id: string;
  target: TargetId;
  root: Element;
  handle: ModeHandle | null;
  /** Signature of what is currently applied; lets unrelated setting changes skip re-rendering. */
  signature: string;
  /** The user expanded this block through its control (kept across live setting changes). */
  open: boolean;
  /**
   * Whether the block was actually on screen when found. Google keeps hidden duplicates of some
   * blocks (e.g. follow-up chips); those are handled but not counted in the badge.
   */
  counted: boolean;
}

/**
 * Owns every block Gemino has found on the page: detects them, applies the configured mode,
 * and re-applies when settings change or the page re-renders.
 */
export class Controller {
  private readonly tracked = new Map<Element, Tracked>();
  private settings: Settings;
  private revealed = false;
  private seq = 0;
  private lastCount = -1;

  constructor(
    private readonly doc: Document,
    settings: Settings,
    private readonly onCount: (count: number) => void = () => {},
    /** Measure layout to count only blocks that were visible. Tests (no layout) turn this off. */
    private readonly measureLayout = true,
  ) {
    this.settings = settings;
    setDebugOutline(doc, this.debugOn());
  }

  // ---- public API -------------------------------------------------------------------------

  /** Scans a scope (the whole document, or an added subtree) and handles anything new. */
  scan(scope: ParentNode = this.doc): void {
    this.prune();
    const wanted = this.wantedTargets();
    if (wanted.size > 0) {
      const found = detect(scope, { enabled: wanted, requireRendered: this.measureLayout });
      // Measure everything first, then mutate: one layout pass instead of one per block.
      const visible = found.map((d) => !this.measureLayout || d.root.getClientRects().length > 0);
      found.forEach((d, i) => this.track(d, visible[i] ?? false));
    }
    this.reportCount();
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
    setDebugOutline(this.doc, this.debugOn());
    this.refresh();
    // A newly enabled target may have blocks we never looked for.
    this.scan(this.doc);
  }

  /** Temporarily show (or re-apply) everything on this page. */
  setRevealed(revealed: boolean): void {
    this.revealed = revealed;
    this.refresh();
  }

  state(): PageStateResponse {
    return { handled: this.handledCount(), revealed: this.revealed };
  }

  /** Stops managing the page and restores every block. */
  dispose(): void {
    for (const t of this.tracked.values()) this.release(t);
    this.tracked.clear();
    setDebugOutline(this.doc, false);
    this.reportCount();
  }

  // ---- internals --------------------------------------------------------------------------

  private debugOn(): boolean {
    return this.settings.enabled && this.settings.debug;
  }

  private wantedTargets(): Set<TargetId> {
    const s = this.settings;
    const wanted = new Set<TargetId>();
    if (!s.enabled) return wanted;
    if (s.debug || s.aiOverview.mode !== 'show') wanted.add('aiOverview');
    if (s.debug || s.hideAiModeEntryPoints) wanted.add('aiModeEntry');
    if (s.debug || s.hideGeminiPromos) wanted.add('geminiPromo');
    return wanted;
  }

  private effectiveMode(target: TargetId): BlockMode {
    const s = this.settings;
    // Debug shows everything so the outlines are visible.
    if (!s.enabled || this.revealed || s.debug) return 'show';
    switch (target) {
      case 'aiOverview':
        return s.aiOverview.mode;
      case 'aiModeEntry':
        return s.hideAiModeEntryPoints ? 'hide' : 'show';
      case 'geminiPromo':
        return s.hideGeminiPromos ? 'hide' : 'show';
    }
  }

  private signatureFor(target: TargetId): string {
    const mode = this.effectiveMode(target);
    const s = this.settings;
    switch (mode) {
      case 'minimize':
        return `${mode}:${s.minimize.previewHeightPx}`;
      case 'blur':
        return `${mode}:${s.blur.strengthPx}:${s.blur.reveal}`;
      default:
        return mode;
    }
  }

  private track(d: Detection, counted: boolean): void {
    const t: Tracked = {
      id: `g${++this.seq}`,
      target: d.target,
      root: d.root,
      handle: null,
      signature: '',
      open: false,
      counted,
    };
    d.root.setAttribute(ATTR_TARGET, d.target);
    d.root.setAttribute(ATTR_ID, t.id);
    this.tracked.set(d.root, t);
    debugLog(this.settings.debug, d, this.effectiveMode(d.target));
    this.render(t);
  }

  private render(t: Tracked): void {
    t.handle?.destroy();
    t.handle = null;
    const mode = this.effectiveMode(t.target);
    t.signature = this.signatureFor(t.target);
    t.handle = applyMode(mode, t.root, {
      settings: this.settings,
      open: t.open,
      onToggle: (open) => {
        t.open = open;
      },
    });
  }

  private release(t: Tracked): void {
    t.handle?.destroy();
    t.handle = null;
    t.root.removeAttribute(ATTR_TARGET);
    t.root.removeAttribute(ATTR_ID);
  }

  /** Drops blocks Google removed from the page, and repairs controls Google removed. */
  private prune(): void {
    for (const [root, t] of this.tracked) {
      if (!root.isConnected) {
        t.handle?.destroy();
        this.tracked.delete(root);
      } else if (t.handle && !t.handle.isIntact()) {
        this.render(t);
      }
    }
  }

  private refresh(): void {
    for (const t of this.tracked.values()) {
      if (!t.root.isConnected) continue;
      if (t.signature !== this.signatureFor(t.target) || (t.handle && !t.handle.isIntact())) {
        this.render(t);
      } else {
        t.handle?.refreshTheme();
      }
    }
    this.prune();
    this.reportCount();
  }

  private handledCount(): number {
    let n = 0;
    for (const t of this.tracked.values()) {
      if (t.counted && t.root.isConnected && this.effectiveMode(t.target) !== 'show') n++;
    }
    return n;
  }

  private reportCount(): void {
    const n = this.handledCount();
    if (n === this.lastCount) return;
    this.lastCount = n;
    this.onCount(n);
  }
}
