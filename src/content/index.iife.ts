/**
 * Main content script (document_idle). Loads settings, handles the blocks Google rendered, then
 * keeps watching for late-arriving ones and for settings / popup messages.
 */
import { isSupportedPath } from '../shared/match-patterns.ts';
import { isRuntimeMessage, type HandledCountMessage } from '../shared/messages.ts';
import { loadSettings, watchSettings } from '../shared/settings.ts';
import { Controller } from './controller.ts';
import { observeAdditions } from './observer.ts';

const READY = 'data-gemino-ready';

async function main(): Promise<void> {
  const root = document.documentElement;
  try {
    const settings = await loadSettings();
    const controller = new Controller(document, settings, (count) => {
      const msg: HandledCountMessage = { type: 'handled-count', count };
      // The service worker may be asleep or the extension reloaded; neither matters here.
      try {
        chrome.runtime.sendMessage(msg).catch(() => {});
      } catch {
        /* extension context invalidated */
      }
    });

    controller.scan(document);
    // Lifts the pre-hide stylesheet (prehide.css).
    root.setAttribute(READY, '');

    // Handled in the observer's microtask, i.e. before paint: no flash for late blocks.
    observeAdditions(document, (scopes) => {
      for (const scope of scopes) controller.scan(scope);
    });

    watchSettings((next) => controller.setSettings(next));

    // In-page navigation and back/forward cache restores.
    window.addEventListener('popstate', () => controller.scan(document));
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) controller.scan(document);
    });

    chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      // Only our own extension may talk to the page script.
      if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return;
      switch (message.type) {
        case 'show-once':
          controller.setRevealed(message.reveal);
          sendResponse(controller.state());
          break;
        case 'page-state':
          sendResponse(controller.state());
          break;
        default:
          break;
      }
    });
  } finally {
    // Whatever went wrong, never leave the page hidden.
    root.setAttribute(READY, '');
  }
}

if (isSupportedPath(location.pathname)) {
  main().catch((err) => console.error('[Gemino]', err));
}
