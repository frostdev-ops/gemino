import { HOST_ATTR, TARGETS, type Target, type TargetId } from './targets.ts';

export const ATTR_TARGET = 'data-gemino-target';

export interface Detection {
  target: TargetId;
  /** The element that matched (a container, a heading, an anchor...). */
  trigger: Element;
  /** The block that gets hidden / collapsed / minimized / blurred. */
  root: Element;
}

export interface DetectOptions {
  /** Targets to look for. Default: all. */
  enabled?: ReadonlySet<TargetId>;
  /**
   * Ignore label-based (fallback) matches that are not rendered. Google keeps a hidden duplicate of
   * the AI Overview heading in the results column; it must not get its own collapse bar. Needs a
   * real layout engine, so it is off by default (unit tests) and on in the extension.
   */
  requireRendered?: boolean;
}

/** Matching elements within `scope`, including `scope` itself when it is an element. */
function queryAll(scope: ParentNode, selector: string): Element[] {
  const out: Element[] = [];
  if (scope.nodeType === 1 && (scope as Element).matches(selector)) out.push(scope as Element);
  out.push(...scope.querySelectorAll(selector));
  return out;
}

function documentOf(scope: ParentNode): ParentNode {
  return (scope as Node).ownerDocument ?? scope;
}

function candidatesFor(scope: ParentNode, target: Target, opts: DetectOptions): Element[] {
  const found = new Set<Element>();
  for (const sel of target.selectors) {
    for (const el of queryAll(scope, sel)) found.add(el);
  }

  // Heading labels are a fallback for when the structural hooks stop matching. While the
  // structural hook exists anywhere on the page, headings are ignored (this also avoids hidden
  // duplicates of the heading).
  if (target.headingSelectors && target.headingMatches) {
    const doc = documentOf(scope);
    const structuralPresent = target.selectors.some((sel) => doc.querySelector(sel) !== null);
    if (!structuralPresent) {
      for (const el of queryAll(scope, target.headingSelectors.join(','))) {
        if (!target.headingMatches(el.textContent ?? '')) continue;
        if (opts.requireRendered && el.getClientRects().length === 0) continue;
        found.add(el);
      }
    }
  }
  return [...found];
}

/**
 * Finds blocks to treat inside `scope` (a Document for a full scan, or a newly added subtree).
 * Results are deduplicated: one entry per root, nothing nested inside an already marked block or
 * another result, and nothing that Gemino itself inserted. Targets are processed in registry
 * order, so the large AI Overview block claims its descendants before the small ones do.
 */
export function detect(scope: ParentNode, opts: DetectOptions = {}): Detection[] {
  const results: Detection[] = [];
  const claimed = new Set<Element>();

  for (const target of TARGETS) {
    if (opts.enabled && !opts.enabled.has(target.id)) continue;
    for (const trigger of candidatesFor(scope, target, opts)) {
      if (trigger.closest(`[${HOST_ATTR}]`)) continue;
      if (target.accept && !target.accept(trigger)) continue;
      const root = target.resolveRoot(trigger);
      if (!root || claimed.has(root)) continue;
      if (root.hasAttribute(ATTR_TARGET)) continue;
      if (root.parentElement?.closest(`[${ATTR_TARGET}]`)) continue;
      if (results.some((r) => r.root.contains(root))) continue;
      claimed.add(root);
      results.push({ target: target.id, trigger, root });
    }
  }
  return results;
}
