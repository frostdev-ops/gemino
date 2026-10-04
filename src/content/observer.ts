import { HOST_ATTR } from './detect/targets.ts';

const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);

/** If more nodes than this arrive in one batch, rescan from the body instead of per node. */
const MAX_NODES_PER_BATCH = 300;

function isRelevant(node: Node): node is Element {
  if (node.nodeType !== 1) return false;
  const el = node as Element;
  if (IGNORED_TAGS.has(el.tagName)) return false;
  // Gemino's own controls are never candidates.
  return !el.hasAttribute(HOST_ATTR) && !el.closest(`[${HOST_ATTR}]`);
}

/**
 * Watches for added elements (late-streaming AI Overviews, in-page navigation). The callback runs
 * as a microtask right after the DOM change, i.e. before the browser paints, so a block that
 * appears late is handled without a visible flash. Only added subtrees are handed back.
 */
export function observeAdditions(doc: Document, callback: (scopes: Element[]) => void): () => void {
  const observer = new MutationObserver((records) => {
    const added: Element[] = [];
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (isRelevant(node)) added.push(node);
        if (added.length > MAX_NODES_PER_BATCH) break;
      }
      if (added.length > MAX_NODES_PER_BATCH) break;
    }
    if (added.length === 0) return;
    if (added.length > MAX_NODES_PER_BATCH) {
      callback([doc.body ?? doc.documentElement]);
      return;
    }
    // Drop nodes already covered by another added node.
    const set = new Set(added);
    callback(added.filter((el) => !hasAncestorIn(el, set)));
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function hasAncestorIn(el: Element, set: ReadonlySet<Element>): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (set.has(p)) return true;
  }
  return false;
}
