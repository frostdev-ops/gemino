//#region src/shared/settings.ts
var BLOCK_MODES = [
	"show",
	"hide",
	"collapse",
	"minimize",
	"blur"
];
var BLUR_REVEALS = ["hover", "click"];
var LIMITS = {
	previewHeightPx: {
		min: 80,
		max: 400
	},
	strengthPx: {
		min: 2,
		max: 20
	}
};
/** Read-only view of the defaults. Use defaultSettings() when you need a mutable copy. */
var DEFAULT_SETTINGS = {
	version: 1,
	enabled: true,
	aiOverview: { mode: "collapse" },
	minimize: { previewHeightPx: 160 },
	blur: {
		strengthPx: 8,
		reveal: "hover"
	},
	hideAiModeEntryPoints: true,
	hideGeminiPromos: true,
	webOnly: false,
	debug: false
};
var STORAGE_KEY = "settings";
function defaultSettings() {
	return structuredClone(DEFAULT_SETTINGS);
}
function isRecord(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}
function bool(v, fallback) {
	return typeof v === "boolean" ? v : fallback;
}
function oneOf(v, allowed, fallback) {
	return typeof v === "string" && allowed.includes(v) ? v : fallback;
}
function clampNumber(v, min, max, fallback) {
	if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, Math.round(v)));
}
/**
* Turns any stored value (missing, corrupted, hand-edited, older schema) into a valid Settings
* object. Never throws. Every field is validated and numeric fields are clamped.
*/
function migrate(raw) {
	const d = DEFAULT_SETTINGS;
	if (!isRecord(raw)) return defaultSettings();
	const aiOverview = isRecord(raw.aiOverview) ? raw.aiOverview : {};
	const minimize = isRecord(raw.minimize) ? raw.minimize : {};
	const blur = isRecord(raw.blur) ? raw.blur : {};
	return {
		version: 1,
		enabled: bool(raw.enabled, d.enabled),
		aiOverview: { mode: oneOf(aiOverview.mode, BLOCK_MODES, d.aiOverview.mode) },
		minimize: { previewHeightPx: clampNumber(minimize.previewHeightPx, LIMITS.previewHeightPx.min, LIMITS.previewHeightPx.max, d.minimize.previewHeightPx) },
		blur: {
			strengthPx: clampNumber(blur.strengthPx, LIMITS.strengthPx.min, LIMITS.strengthPx.max, d.blur.strengthPx),
			reveal: oneOf(blur.reveal, BLUR_REVEALS, d.blur.reveal)
		},
		hideAiModeEntryPoints: bool(raw.hideAiModeEntryPoints, d.hideAiModeEntryPoints),
		hideGeminiPromos: bool(raw.hideGeminiPromos, d.hideGeminiPromos),
		webOnly: bool(raw.webOnly, d.webOnly),
		debug: bool(raw.debug, d.debug)
	};
}
function area() {
	return chrome.storage.sync;
}
async function loadSettings(storage = area()) {
	try {
		return migrate((await storage.get(STORAGE_KEY))[STORAGE_KEY]);
	} catch {
		return defaultSettings();
	}
}
async function saveSettings(settings, storage = area()) {
	const clean = migrate(settings);
	await storage.set({ [STORAGE_KEY]: clean });
	return clean;
}
/** Applies a partial change on top of the stored settings and persists the result. */
async function updateSettings(patch, storage = area()) {
	const current = await loadSettings(storage);
	return saveSettings(patch(current) ?? current, storage);
}
/** Subscribes to settings changes from any extension context. Returns an unsubscribe function. */
function watchSettings(cb) {
	const listener = (changes, areaName) => {
		if (areaName !== "sync") return;
		const change = changes[STORAGE_KEY];
		if (change) cb(migrate(change.newValue));
	};
	chrome.storage.onChanged.addListener(listener);
	return () => chrome.storage.onChanged.removeListener(listener);
}
//#endregion
export { clampNumber as a, migrate as c, watchSettings as d, STORAGE_KEY as i, saveSettings as l, BLUR_REVEALS as n, defaultSettings as o, LIMITS as r, loadSettings as s, BLOCK_MODES as t, updateSettings as u };
