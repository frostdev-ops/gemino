/**
 * Service worker: keeps the Web only ruleset in sync with settings, handles the keyboard shortcut,
 * and shows the per-tab count on the toolbar icon.
 */
import { isRuntimeMessage } from '../shared/messages.ts';
import {
  STORAGE_KEY,
  defaultSettings,
  loadSettings,
  migrate,
  saveSettings,
  updateSettings,
  type Settings,
} from '../shared/settings.ts';
import { WEB_ONLY_RULESET_ID } from '../shared/web-only-rules.ts';

const BADGE_COLOR = '#4361ee';
const OFF_COLOR = '#80868b';

/** Web only is active only while Gemino is on and the option is set. */
async function syncRuleset(settings: Settings): Promise<void> {
  const want = settings.enabled && settings.webOnly;
  try {
    const active = await chrome.declarativeNetRequest.getEnabledRulesets();
    const isOn = active.includes(WEB_ONLY_RULESET_ID);
    if (want === isOn) return;
    await chrome.declarativeNetRequest.updateEnabledRulesets(
      want
        ? { enableRulesetIds: [WEB_ONLY_RULESET_ID] }
        : { disableRulesetIds: [WEB_ONLY_RULESET_ID] },
    );
  } catch (err) {
    console.error('[Gemino] could not update the Web only ruleset', err);
  }
}

/** Global badge: "OFF" while the master switch is off. Per-tab counts override it. */
async function syncBadge(settings: Settings): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: settings.enabled ? '' : 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: OFF_COLOR });
  } catch {
    /* action API unavailable */
  }
}

async function syncAll(settings?: Settings): Promise<void> {
  const s = settings ?? (await loadSettings());
  await Promise.all([syncRuleset(s), syncBadge(s)]);
}

chrome.runtime.onInstalled.addListener(async () => {
  // Idempotent: keep what the user has (re-validated), write defaults only when nothing is stored.
  const items = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = items[STORAGE_KEY];
  await saveSettings(stored === undefined ? defaultSettings() : migrate(stored));
  await syncAll();
});

chrome.runtime.onStartup.addListener(() => void syncAll());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes[STORAGE_KEY]) return;
  void syncAll(migrate(changes[STORAGE_KEY].newValue));
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-gemino') return;
  void updateSettings((s) => {
    s.enabled = !s.enabled;
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  // Only our own content scripts report counts.
  if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return;
  if (message.type !== 'handled-count') return;
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;

  const count = Math.max(0, Math.min(99, Math.floor(message.count)));
  void (async () => {
    try {
      await chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' });
      if (count > 0) await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    } catch {
      /* the tab may already be gone */
    }
  })();
});

// Every time the worker wakes up, make sure the ruleset matches the stored settings.
void syncAll();
