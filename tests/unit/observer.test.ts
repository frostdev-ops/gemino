import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { observeAdditions } from '../../src/content/observer.ts';

let stop: (() => void) | undefined;
let calls: Element[][];

/** MutationObserver callbacks run as a microtask; two ticks is plenty and still deterministic. */
async function tick(): Promise<void> {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function start(): void {
  calls = [];
  stop = observeAdditions(document, (scopes) => calls.push(scopes));
}

function el(tag: string, attrs: Record<string, string> = {}, text = ''): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.textContent = text;
  return e;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe('observeAdditions()', () => {
  it('delivers an added element', async () => {
    start();
    const added = el('div', { id: 'a' });
    document.getElementById('root')!.append(added);
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([added]);
  });

  it('delivers before the next macrotask (microtask timing, i.e. before paint)', async () => {
    start();
    document.getElementById('root')!.append(el('div'));
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toHaveLength(1);
  });

  it('batches several additions made in one task into one callback', async () => {
    start();
    const root = document.getElementById('root')!;
    const a = el('div');
    const b = el('section');
    root.append(a);
    root.append(b);
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([a, b]);
  });

  it('ignores text nodes and comments', async () => {
    start();
    const root = document.getElementById('root')!;
    root.append(document.createTextNode('hello'), document.createComment('c'));
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('ignores script, style, link, meta, noscript and template elements', async () => {
    start();
    const root = document.getElementById('root')!;
    for (const tag of ['script', 'style', 'link', 'meta', 'noscript', 'template']) {
      root.append(el(tag));
    }
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('ignores Gemino hosts and anything added inside them', async () => {
    start();
    const root = document.getElementById('root')!;
    const host = el('div', { 'data-gemino-host': '' });
    root.append(host);
    await tick();
    expect(calls).toHaveLength(0);

    host.append(el('span'));
    await tick();
    expect(calls).toHaveLength(0);

    // A normal sibling is still delivered afterwards.
    const normal = el('div');
    root.append(normal);
    await tick();
    expect(calls).toEqual([[normal]]);
  });

  it('collapses nested added nodes to the outermost one', async () => {
    start();
    const outer = el('div', { id: 'outer' });
    const inner = el('div', { id: 'inner' });
    const root = document.getElementById('root')!;
    root.append(outer);
    outer.append(inner); // both added in the same task; the observer sees two records
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([outer]);
  });

  it('keeps unrelated added subtrees separate', async () => {
    start();
    const root = document.getElementById('root')!;
    const a = el('div');
    const b = el('div');
    root.append(a, b);
    a.append(el('p'));
    await tick();
    expect(calls[0]).toEqual([a, b]);
  });

  it('falls back to a rescan of the body when more than 300 nodes arrive at once', async () => {
    start();
    const root = document.getElementById('root')!;
    for (let i = 0; i < 301; i++) root.append(el('i'));
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([document.body]);
  });

  it('does not use the fallback for exactly 300 nodes', async () => {
    start();
    const root = document.getElementById('root')!;
    for (let i = 0; i < 300; i++) root.append(el('i'));
    await tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(300);
  });

  it('observes the whole document, not only the body', async () => {
    start();
    const lateHead = el('div', { id: 'late' });
    document.documentElement.append(lateHead);
    await tick();
    expect(calls[0]).toEqual([lateHead]);
    lateHead.remove();
  });

  it('stops delivering callbacks after disconnect', async () => {
    start();
    document.getElementById('root')!.append(el('div'));
    await tick();
    expect(calls).toHaveLength(1);

    stop!();
    document.getElementById('root')!.append(el('div'));
    await tick();
    expect(calls).toHaveLength(1);
  });

  it('drops pending records when disconnected before they are delivered', async () => {
    start();
    document.getElementById('root')!.append(el('div'));
    stop!();
    await tick();
    expect(calls).toHaveLength(0);
  });
});
