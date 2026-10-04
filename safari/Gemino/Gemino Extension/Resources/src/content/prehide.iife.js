(function() {
	//#region src/shared/match-patterns.ts
	/** Whether a page path is one Gemino should act on (defence in depth for the content script). */
	function isSupportedPath(pathname) {
		return pathname === "/" || pathname.startsWith("/search") || pathname.startsWith("/webhp");
	}
	//#endregion
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
	//#endregion
	//#region src/content/prehide.iife.ts
	/**
	* Runs at document_start. Decides whether the pre-hide stylesheet (prehide.css) should stay in
	* effect until the main script has processed the page, or be lifted right away.
	*/
	var READY = "data-gemino-ready";
	var SETTINGS_TIMEOUT_MS = 500;
	var FAILSAFE_MS = 3e3;
	var root = document.documentElement;
	var ready = () => root.setAttribute(READY, "");
	if (!isSupportedPath(location.pathname)) ready();
	else {
		setTimeout(ready, FAILSAFE_MS);
		const timeout = new Promise((resolve) => setTimeout(() => resolve(null), SETTINGS_TIMEOUT_MS));
		Promise.race([loadSettings(), timeout]).then((settings) => {
			if (!settings) return ready();
			if (!settings.enabled || settings.aiOverview.mode === "show" || settings.debug) ready();
		});
	}
	//#endregion
})();
