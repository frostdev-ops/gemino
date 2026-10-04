import { c as migrate, i as STORAGE_KEY, l as saveSettings, o as defaultSettings, s as loadSettings, u as updateSettings } from "./settings-BB2iTyYc.js";
//#region src/shared/messages.ts
function isRuntimeMessage(v) {
	if (typeof v !== "object" || v === null) return false;
	const m = v;
	switch (m.type) {
		case "handled-count": return typeof m.count === "number" && Number.isFinite(m.count);
		case "show-once": return typeof m.reveal === "boolean";
		case "page-state": return true;
		default: return false;
	}
}
//#endregion
//#region src/shared/web-only-rules.ts
var WEB_ONLY_RULESET_ID = "web_only";
//#endregion
//#region src/background/index.ts
/**
* Service worker: keeps the Web only ruleset in sync with settings, handles the keyboard shortcut,
* and shows the per-tab count on the toolbar icon.
*/
var BADGE_COLOR = "#4361ee";
var OFF_COLOR = "#80868b";
/** Web only is active only while Gemino is on and the option is set. */
async function syncRuleset(settings) {
	const want = settings.enabled && settings.webOnly;
	try {
		if (want === (await chrome.declarativeNetRequest.getEnabledRulesets()).includes("web_only")) return;
		await chrome.declarativeNetRequest.updateEnabledRulesets(want ? { enableRulesetIds: [WEB_ONLY_RULESET_ID] } : { disableRulesetIds: [WEB_ONLY_RULESET_ID] });
	} catch (err) {
		console.error("[Gemino] could not update the Web only ruleset", err);
	}
}
/** Global badge: "OFF" while the master switch is off. Per-tab counts override it. */
async function syncBadge(settings) {
	try {
		await chrome.action.setBadgeText({ text: settings.enabled ? "" : "OFF" });
		await chrome.action.setBadgeBackgroundColor({ color: OFF_COLOR });
	} catch {}
}
async function syncAll(settings) {
	const s = settings ?? await loadSettings();
	await Promise.all([syncRuleset(s), syncBadge(s)]);
}
chrome.runtime.onInstalled.addListener(async () => {
	const stored = (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY];
	await saveSettings(stored === void 0 ? defaultSettings() : migrate(stored));
	await syncAll();
});
chrome.runtime.onStartup.addListener(() => void syncAll());
chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "sync" || !changes["settings"]) return;
	syncAll(migrate(changes[STORAGE_KEY].newValue));
});
chrome.commands.onCommand.addListener((command) => {
	if (command !== "toggle-gemino") return;
	updateSettings((s) => {
		s.enabled = !s.enabled;
	});
});
chrome.runtime.onMessage.addListener((message, sender) => {
	if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return;
	if (message.type !== "handled-count") return;
	const tabId = sender.tab?.id;
	if (tabId === void 0) return;
	const count = Math.max(0, Math.min(99, Math.floor(message.count)));
	(async () => {
		try {
			await chrome.action.setBadgeText({
				tabId,
				text: count > 0 ? String(count) : ""
			});
			if (count > 0) await chrome.action.setBadgeBackgroundColor({
				tabId,
				color: BADGE_COLOR
			});
		} catch {}
	})();
});
syncAll();
//#endregion
