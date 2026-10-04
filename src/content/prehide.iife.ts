/**
 * Runs at document_start. Decides whether the pre-hide stylesheet (prehide.css) should stay in
 * effect until the main script has processed the page, or be lifted right away.
 */
import { isSupportedPath } from '../shared/match-patterns.ts';
import { loadSettings } from '../shared/settings.ts';

const READY = 'data-gemino-ready';
const SETTINGS_TIMEOUT_MS = 500;
const FAILSAFE_MS = 3000;

const root = document.documentElement;
const ready = () => root.setAttribute(READY, '');

if (!isSupportedPath(location.pathname)) {
  ready();
} else {
  // Whatever happens, never keep the page hidden for long.
  setTimeout(ready, FAILSAFE_MS);

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), SETTINGS_TIMEOUT_MS),
  );
  void Promise.race([loadSettings(), timeout]).then((settings) => {
    // Settings too slow: stop hiding; the main script still applies the mode once it has them.
    if (!settings) return ready();
    // Nothing to hide: lift the pre-hide immediately.
    if (!settings.enabled || settings.aiOverview.mode === 'show' || settings.debug) ready();
    // Otherwise the main script sets data-gemino-ready after its first scan.
  });
}
