(function() {
	//#region src/shared/match-patterns.ts
	/** Whether a page path is one Gemino should act on (defence in depth for the content script). */
	function isSupportedPath(pathname) {
		return pathname === "/" || pathname.startsWith("/search") || pathname.startsWith("/webhp");
	}
	//#endregion
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
	//#region src/content/debug.ts
	var ATTR_DEBUG = "data-gemino-debug";
	/** Toggles the outline stylesheet rules in content.css. */
	function setDebugOutline(doc, on) {
		doc.documentElement.toggleAttribute(ATTR_DEBUG, on);
	}
	function debugLog(enabled, d, mode) {
		if (!enabled) return;
		console.debug("[Gemino]", d.target, `mode=${mode}`, d.root, "matched by", d.trigger);
	}
	//#endregion
	//#region src/content/detect/labels.ts
	/**
	* Localized labels, each confirmed on a live Google result page (see tests/fixtures/labels-live.json).
	* Add a string here only after seeing it on a live page.
	*/
	/** Text of the heading that opens an AI Overview block. */
	var AI_OVERVIEW_LABELS = [
		"AI Overview",
		"Übersicht mit KI",
		"Aperçu IA",
		"AI による概要",
		"نبذة باستخدام الذكاء الاصطناعي",
		"Přehled od AI",
		"AI-oversigt",
		"AI-oversikt",
		"Επισκόπηση AI",
		"Visión general creada por IA",
		"AI-yhteenveto",
		"תקציר מ-AI",
		"AI जवाब",
		"AI-alapú áttekintés",
		"Ringkasan AI",
		"Overview dell'AI",
		"AI 개요",
		"AI-overzicht",
		"Przegląd od AI",
		"Visão geral criada por IA",
		"Rezumat generat de AI",
		"Обзор от ИИ",
		"AI-översikt",
		"ข้อมูลภาพรวมโดย AI",
		"AI Bakışı",
		"Огляд від ШІ",
		"Thông tin tổng quan do AI tạo",
		"AI 概览",
		"AI 摘要"
	];
	/** Text of the AI Mode tab / search-box button. */
	var AI_MODE_LABELS = [
		"AI Mode",
		"KI‑Modus",
		"Mode IA",
		"AI モード",
		"وضع AI",
		"Režim AI",
		"AI-tilstand",
		"Modo IA",
		"Tekoälytila",
		"מצב AI",
		"एआई मोड",
		"AI-mód",
		"Mode AI",
		"AI 모드",
		"AI-modus",
		"Tryb AI",
		"Modul AI",
		"Режим ИИ",
		"AI-läge",
		"โหมด AI",
		"AI Modu",
		"Режим ШІ",
		"Chế độ AI",
		"AI 模式"
	];
	/** Case-, width- and whitespace-insensitive form used for comparisons. */
	function normalizeLabel(text) {
		return text.normalize("NFKC").replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase();
	}
	function toSet(labels) {
		return new Set(labels.map(normalizeLabel));
	}
	var OVERVIEW_SET = toSet(AI_OVERVIEW_LABELS);
	var AI_MODE_SET = toSet(AI_MODE_LABELS);
	function isAiOverviewLabel(text) {
		return !!text && OVERVIEW_SET.has(normalizeLabel(text));
	}
	function isAiModeLabel(text) {
		return !!text && AI_MODE_SET.has(normalizeLabel(text));
	}
	/** Ancestors the climb must never enter or pass. */
	var STOP_SELECTOR = `#center_col, #rso, #search, #res, #botstuff, #rcnt, #cnt, #main, #gsr, body, html`;
	/** The Gemino-owned elements; never treated as candidates. */
	var HOST_ATTR = "data-gemino-host";
	var MAX_CLIMB = 60;
	/**
	* Climbs from `el` to the outermost ancestor that is still "just this block": it stops below
	* any stable page container and never includes the organic results column or an ads slot.
	*/
	function climbToBlock(el) {
		let cur = el;
		for (let i = 0; i < MAX_CLIMB; i++) {
			const parent = cur.parentElement;
			if (!parent) break;
			if (parent.matches(STOP_SELECTOR)) break;
			if (parent.querySelector("#center_col, #rso, #search, #res, #botstuff")) break;
			if (parent.querySelector("#tads, #tadsb, #tvcap, #taw, #bottomads")) break;
			cur = parent;
		}
		return cur;
	}
	var NO_CLIMB_PARENT = "form, nav, [role=\"search\"], [role=\"list\"], [role=\"navigation\"], [role=\"tablist\"], [role=\"toolbar\"]";
	/**
	* Climbs through wrappers whose only child is `el`, so an emptied wrapper doesn't leave a gap.
	* Never leaves the immediate chain by more than `maxLevels`.
	*/
	function climbSingleChildWrappers(el, maxLevels = 4) {
		let cur = el;
		for (let i = 0; i < maxLevels; i++) {
			const parent = cur.parentElement;
			if (!parent) break;
			if (parent.children.length !== 1) break;
			if (parent.matches(STOP_SELECTOR) || parent.matches(NO_CLIMB_PARENT)) break;
			cur = parent;
		}
		return cur;
	}
	function isOrganic(el) {
		return el.closest("#search, #rso") !== null;
	}
	/** True for URLs pointing at Google's AI Mode: /search?...&udm=50 on a Google host. */
	function isAiModeUrl(href, base) {
		if (!href || !href.includes("udm=50")) return false;
		try {
			const u = new URL(href, base);
			return /^https?:$/.test(u.protocol) && /^(www\.)?google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/search" && u.searchParams.get("udm") === "50";
		} catch {
			return false;
		}
	}
	function isGeminiUrl(href, base) {
		if (!href || !href.includes("gemini.google.com")) return false;
		try {
			const u = new URL(href, base);
			return /^https?:$/.test(u.protocol) && u.hostname === "gemini.google.com";
		} catch {
			return false;
		}
	}
	function baseUrl(el) {
		return el.ownerDocument.location?.href ?? "https://www.google.com/";
	}
	var SHORT_LABEL_MAX = 40;
	/**
	* The registry. Selectors were captured from live pages (en-US, en-GB, de, fr, ja, and 25 more
	* locales for labels); see tests/fixtures. When Google changes its markup, this is the place to fix.
	*/
	var TARGETS = [
		{
			id: "aiOverview",
			selectors: ["#Odp5De"],
			headingSelectors: [
				"[role=\"heading\"]",
				"h1",
				"h2"
			],
			headingMatches: isAiOverviewLabel,
			accept: (el) => el.closest("a") === null,
			resolveRoot: climbToBlock
		},
		{
			id: "aiModeEntry",
			selectors: [
				"a[href*=\"udm=50\"]",
				"button[jsname=\"B6rgad\"]",
				"button, [role=\"button\"], [role=\"link\"], [role=\"tab\"]"
			],
			accept: (el) => {
				if (el.tagName === "A") return isAiModeUrl(el.getAttribute("href"), baseUrl(el));
				if (el.matches("button[jsname=\"B6rgad\"]")) return true;
				const text = el.textContent ?? "";
				return text.length <= SHORT_LABEL_MAX && isAiModeLabel(text) && !isOrganic(el);
			},
			resolveRoot: (el) => climbSingleChildWrappers(el)
		},
		{
			id: "geminiPromo",
			selectors: ["a[href*=\"gemini.google.com\"]"],
			accept: (el) => isGeminiUrl(el.getAttribute("href"), baseUrl(el)) && !isOrganic(el),
			resolveRoot: (el) => climbSingleChildWrappers(el)
		}
	];
	//#endregion
	//#region src/content/detect/detect.ts
	var ATTR_TARGET = "data-gemino-target";
	/** Matching elements within `scope`, including `scope` itself when it is an element. */
	function queryAll(scope, selector) {
		const out = [];
		if (scope.nodeType === 1 && scope.matches(selector)) out.push(scope);
		out.push(...scope.querySelectorAll(selector));
		return out;
	}
	function documentOf(scope) {
		return scope.ownerDocument ?? scope;
	}
	function candidatesFor(scope, target, opts) {
		const found = /* @__PURE__ */ new Set();
		for (const sel of target.selectors) for (const el of queryAll(scope, sel)) found.add(el);
		if (target.headingSelectors && target.headingMatches) {
			const doc = documentOf(scope);
			if (!target.selectors.some((sel) => doc.querySelector(sel) !== null)) for (const el of queryAll(scope, target.headingSelectors.join(","))) {
				if (!target.headingMatches(el.textContent ?? "")) continue;
				if (opts.requireRendered && el.getClientRects().length === 0) continue;
				found.add(el);
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
	function detect(scope, opts = {}) {
		const results = [];
		const claimed = /* @__PURE__ */ new Set();
		for (const target of TARGETS) {
			if (opts.enabled && !opts.enabled.has(target.id)) continue;
			for (const trigger of candidatesFor(scope, target, opts)) {
				if (trigger.closest(`[data-gemino-host]`)) continue;
				if (target.accept && !target.accept(trigger)) continue;
				const root = target.resolveRoot(trigger);
				if (!root || claimed.has(root)) continue;
				if (root.hasAttribute("data-gemino-target")) continue;
				if (root.parentElement?.closest(`[data-gemino-target]`)) continue;
				if (results.some((r) => r.root.contains(root))) continue;
				claimed.add(root);
				results.push({
					target: target.id,
					trigger,
					root
				});
			}
		}
		return results;
	}
	//#endregion
	//#region src/shared/i18n.ts
	var fallback = {
		extName: {
			"message": "Gemino",
			"description": "Extension name."
		},
		extDescription: {
			"message": "Hide, collapse, minimize, or blur Google's AI Overview, AI Mode, and Gemini prompts.",
			"description": "Extension description shown in the store and on the extensions page (max 132 characters)."
		},
		cmdToggle: {
			"message": "Turn Gemino on or off",
			"description": "Keyboard shortcut description."
		},
		barCollapsed: {
			"message": "AI Overview hidden. Click to expand.",
			"description": "Collapsed bar label."
		},
		barExpanded: {
			"message": "AI Overview shown. Click to collapse.",
			"description": "Collapsed bar label while the block is expanded."
		},
		showMore: {
			"message": "Show more",
			"description": "Button under a minimized AI Overview."
		},
		showLess: {
			"message": "Show less",
			"description": "Button under an expanded, previously minimized AI Overview."
		},
		revealBlurred: {
			"message": "Click to reveal AI Overview",
			"description": "Overlay button on a blurred AI Overview."
		},
		popupTitle: {
			"message": "Gemino",
			"description": "Popup heading."
		},
		optEnabled: {
			"message": "Enabled",
			"description": "Master switch label."
		},
		optOverviewMode: {
			"message": "AI Overview",
			"description": "Label of the AI Overview mode picker."
		},
		modeShow: {
			"message": "Show",
			"description": "AI Overview mode: leave as is."
		},
		modeHide: {
			"message": "Hide",
			"description": "AI Overview mode: remove completely."
		},
		modeCollapse: {
			"message": "Collapse",
			"description": "AI Overview mode: slim bar that expands on click."
		},
		modeMinimize: {
			"message": "Minimize",
			"description": "AI Overview mode: short preview with a Show more button."
		},
		modeBlur: {
			"message": "Blur",
			"description": "AI Overview mode: blurred until revealed."
		},
		optHideAiMode: {
			"message": "Hide AI Mode buttons and tabs",
			"description": "Toggle label."
		},
		optHideGemini: {
			"message": "Hide Gemini promos",
			"description": "Toggle label."
		},
		optWebOnly: {
			"message": "Web only results (no AI at all)",
			"description": "Toggle label for the udm=14 redirect."
		},
		optWebOnlyHelp: {
			"message": "Redirects searches to Google's plain Web results, which have no AI Overview. Images, News and other tabs are left alone.",
			"description": "Help text under the Web only toggle."
		},
		btnRevealPage: {
			"message": "Show everything on this page",
			"description": "Popup button that temporarily reveals blocks in the current tab."
		},
		btnRehidePage: {
			"message": "Hide again",
			"description": "Popup button that re-applies the configured modes in the current tab."
		},
		statusHandled: {
			"message": "Handled on this page: $COUNT$",
			"description": "Popup status line.",
			"placeholders": { "count": {
				"content": "$1",
				"example": "2"
			} }
		},
		statusNotGoogle: {
			"message": "Open a Google search page to see Gemino at work.",
			"description": "Popup status line when the active tab is not a supported page."
		},
		linkOptions: {
			"message": "All settings",
			"description": "Popup link to the options page."
		},
		optionsTitle: {
			"message": "Gemino settings",
			"description": "Options page heading."
		},
		optMinimizeHeight: {
			"message": "Minimized preview height",
			"description": "Slider label (pixels)."
		},
		optBlurStrength: {
			"message": "Blur strength",
			"description": "Slider label (pixels)."
		},
		optBlurReveal: {
			"message": "Reveal blurred AI Overview",
			"description": "Select label."
		},
		revealHover: {
			"message": "On hover",
			"description": "Blur reveal option."
		},
		revealClick: {
			"message": "On click",
			"description": "Blur reveal option."
		},
		optDebug: {
			"message": "Debug: outline detected blocks (and show them)",
			"description": "Toggle label."
		},
		optShortcut: {
			"message": "Change the keyboard shortcut",
			"description": "Link to chrome://extensions/shortcuts."
		},
		optShortcutHelp: {
			"message": "Default: Alt+Shift+G turns Gemino on or off. Open your browser's extension shortcuts page to change it.",
			"description": "Help text next to the shortcut link."
		},
		btnReset: {
			"message": "Reset to defaults",
			"description": "Options button."
		},
		scopeNote: {
			"message": "Gemino cannot change the browser's own Gemini or AI buttons (such as Chrome's Gemini button or Opera's Aria); those are part of the browser itself.",
			"description": "Scope disclaimer on the options page."
		},
		pxUnit: {
			"message": "$VALUE$ px",
			"description": "Pixel value display.",
			"placeholders": { "value": {
				"content": "$1",
				"example": "160"
			} }
		}
	};
	/**
	* Localized string. Uses chrome.i18n when running in the extension; falls back to the bundled
	* English catalog (tests, or a missing key in another locale). Substitution values replace $1.
	*/
	function t(key, ...subs) {
		let msg = "";
		try {
			msg = chrome.i18n.getMessage(key, subs);
		} catch {}
		if (!msg) {
			msg = fallback[key]?.message ?? key;
			subs.forEach((s) => {
				msg = msg.replace(/\$[A-Z_]+\$/, s);
			});
		}
		return msg;
	}
	//#endregion
	//#region src/content/ui/theme.ts
	function parseRgb(value) {
		const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
		if (!m) return null;
		const a = m[4] === void 0 ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
		return {
			r: Number(m[1]),
			g: Number(m[2]),
			b: Number(m[3]),
			a
		};
	}
	function luminance(r, g, b) {
		const lin = (c) => {
			const s = c / 255;
			return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
		};
		return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
	}
	/**
	* Light or dark, judged from the page's actual background so the control matches Google's own
	* theme (which can differ from the OS setting). Falls back to prefers-color-scheme.
	*/
	function detectTheme(doc = document) {
		const view = doc.defaultView;
		if (view) {
			for (const el of [doc.body, doc.documentElement]) {
				if (!el) continue;
				const rgb = parseRgb(view.getComputedStyle(el).backgroundColor);
				if (rgb && rgb.a > .5) return luminance(rgb.r, rgb.g, rgb.b) < .4 ? "dark" : "light";
			}
			if (view.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
		}
		return "light";
	}
	//#endregion
	//#region src/content/ui/control-bar.ts
	var CSS = `
:host { all: initial; display: block; }
:host([data-variant="overlay"]) { position: absolute; inset: 0; z-index: 2; }
* { box-sizing: border-box; }
button {
  font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  color: var(--fg); background: var(--bg);
  border: 1px solid var(--border); border-radius: 12px;
  padding: 8px 12px; min-height: 32px; width: fit-content; max-width: 100%; text-align: start;
}
button:hover { background: var(--bg-hover); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chev { display: inline-block; width: 8px; height: 8px; flex: none;
  border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
  transform: rotate(-45deg); transition: transform .15s ease; }
:host([data-open="true"]) .chev { transform: rotate(45deg); }
:host([data-variant="overlay"]) button {
  position: absolute; inset: 0; width: 100%; height: 100%;
  justify-content: center; background: transparent; border: 0; border-radius: 0;
  color: var(--fg);
}
:host([data-variant="overlay"]) button:hover { background: var(--overlay-hover); }
:host([data-variant="overlay"]) .chev { display: none; }
:host([data-theme="light"]) {
  --fg: #202124; --bg: #f1f3f4; --bg-hover: #e8eaed; --border: #dadce0;
  --accent: #1a73e8; --overlay-hover: rgba(255,255,255,.35);
}
:host([data-theme="dark"]) {
  --fg: #e8eaed; --bg: #303134; --bg-hover: #3c4043; --border: #5f6368;
  --accent: #8ab4f8; --overlay-hover: rgba(0,0,0,.25);
}
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
`;
	function applyStyles(shadow) {
		try {
			const view = shadow.ownerDocument.defaultView;
			if (view && "adoptedStyleSheets" in shadow && typeof view.CSSStyleSheet === "function") {
				const sheet = new view.CSSStyleSheet();
				sheet.replaceSync(CSS);
				shadow.adoptedStyleSheets = [sheet];
				return;
			}
		} catch {}
		const style = shadow.ownerDocument.createElement("style");
		style.textContent = CSS;
		shadow.append(style);
	}
	/**
	* A button inside a Shadow DOM, so neither Google's CSS nor ours can leak across.
	* All text goes through textContent; nothing from the page is ever written as HTML.
	*/
	function createControl(opts) {
		const doc = document;
		const host = doc.createElement("div");
		host.setAttribute(HOST_ATTR, "");
		host.dataset.variant = opts.variant;
		const shadow = host.attachShadow({ mode: "open" });
		applyStyles(shadow);
		const button = doc.createElement("button");
		button.type = "button";
		const chev = doc.createElement("span");
		chev.className = "chev";
		chev.setAttribute("aria-hidden", "true");
		const text = doc.createElement("span");
		button.append(chev, text);
		shadow.append(button);
		let open = opts.open;
		const render = () => {
			host.dataset.open = String(open);
			text.textContent = opts.label(open);
			button.setAttribute("aria-expanded", String(open));
		};
		const refreshTheme = () => {
			host.dataset.theme = detectTheme(doc);
		};
		button.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			open = !open;
			render();
			opts.onToggle(open);
		});
		refreshTheme();
		render();
		return {
			host,
			setOpen(next) {
				open = next;
				render();
			},
			refreshTheme,
			destroy() {
				host.remove();
			}
		};
	}
	//#endregion
	//#region src/content/modes/types.ts
	var ATTR_MODE = "data-gemino-mode";
	var ATTR_OPEN = "data-gemino-open";
	var ATTR_REVEAL = "data-gemino-reveal";
	var VAR_PREVIEW = "--gemino-preview";
	var VAR_BLUR = "--gemino-blur";
	function setOpenAttr(root, open) {
		if (open) root.setAttribute(ATTR_OPEN, "");
		else root.removeAttribute(ATTR_OPEN);
	}
	//#endregion
	//#region src/content/modes/blur.ts
	/**
	* The block's content is blurred (content.css blurs the block's children, so the reveal overlay,
	* which lives inside the block, stays sharp). Reveal on hover/focus, or with a click overlay.
	*/
	var applyBlur = (root, ctx) => {
		const { strengthPx, reveal } = ctx.settings.blur;
		root.setAttribute(ATTR_MODE, "blur");
		root.setAttribute(ATTR_REVEAL, reveal);
		setOpenAttr(root, ctx.open);
		root.style.setProperty(VAR_BLUR, `${strengthPx}px`);
		let control = null;
		if (reveal === "click") {
			control = createControl({
				variant: "overlay",
				open: ctx.open,
				label: () => t("revealBlurred"),
				onToggle: (open) => {
					setOpenAttr(root, open);
					if (control) control.host.style.display = open ? "none" : "";
					ctx.onToggle(open);
				}
			});
			control.host.style.display = ctx.open ? "none" : "";
			root.append(control.host);
		}
		return {
			refreshTheme: () => control?.refreshTheme(),
			isIntact: () => !control || control.host.isConnected,
			destroy() {
				control?.destroy();
				root.removeAttribute(ATTR_MODE);
				root.removeAttribute(ATTR_OPEN);
				root.removeAttribute(ATTR_REVEAL);
				root.style.removeProperty(VAR_BLUR);
			}
		};
	};
	//#endregion
	//#region src/content/ui/layout.ts
	/**
	* Google's results container is a CSS grid (`#rcnt`) in which the AI Overview spans every column
	* (`grid-column: 1 / -1`). A control inserted next to it would otherwise be auto-placed into the
	* first, narrow column. This gives the control the same placement as the block it belongs to.
	*
	* Must be called before the block is hidden: it reads the block's computed style.
	*/
	function mirrorPlacement(host, reference) {
		const parent = reference.parentElement;
		const view = reference.ownerDocument.defaultView;
		if (!parent || !view) return;
		const parentDisplay = view.getComputedStyle(parent).display;
		const ref = view.getComputedStyle(reference);
		if (parentDisplay.includes("grid")) {
			if (ref.gridColumn) host.style.gridColumn = ref.gridColumn;
			if (ref.gridRow && ref.gridRow !== "auto") host.style.gridRow = ref.gridRow;
		} else if (parentDisplay.includes("flex")) {
			host.style.flex = "1 1 100%";
			host.style.minWidth = "0";
		}
	}
	/** Largest correction we are willing to apply; anything bigger means we measured the wrong thing. */
	var MAX_SHIFT_PX = 600;
	/** The first organic result's title that is actually laid out, ignoring Gemino's own nodes. */
	function firstResultTitle(doc, exclude) {
		for (const h3 of doc.querySelectorAll("#rso h3, #search h3")) {
			if (exclude.contains(h3) || h3.closest("[data-gemino-host]")) continue;
			const box = h3.getBoundingClientRect();
			if (box.width > 0 && box.height > 0) return h3;
		}
		return null;
	}
	/**
	* Lines the control's start edge up with the start edge of the first search result, so the bar
	* reads as sitting directly on top of the results. Google's AI Overview and its results do not
	* always share the same left edge (the grid area the block spans can start further in or out than
	* the result column), and that depends on the viewport, so it is measured rather than hard-coded.
	*
	* Only the control's own inline-start margin is touched; Google's nodes are never modified.
	*/
	function alignWithResults(host, block) {
		const doc = host.ownerDocument;
		const view = doc.defaultView;
		const apply = () => {
			if (!view || !host.isConnected) return;
			host.style.removeProperty("margin-inline-start");
			const title = firstResultTitle(doc, block);
			if (!title) return;
			const style = view.getComputedStyle(host);
			const rtl = style.direction === "rtl";
			const own = Number.parseFloat(style.marginInlineStart) || 0;
			const hostBox = host.getBoundingClientRect();
			const titleBox = title.getBoundingClientRect();
			if (hostBox.width === 0 && hostBox.height === 0) return;
			const shift = rtl ? titleBox.right - hostBox.right : titleBox.left - hostBox.left;
			const margin = own + (rtl ? -shift : shift);
			if (Math.abs(margin - own) < 1 || Math.abs(margin - own) > MAX_SHIFT_PX) return;
			host.style.setProperty("margin-inline-start", `${Math.round(margin)}px`);
		};
		let timer;
		const onResize = () => {
			clearTimeout(timer);
			timer = setTimeout(apply, 120);
		};
		view?.addEventListener("resize", onResize);
		apply();
		const raf = view?.requestAnimationFrame?.(() => apply());
		const later = [400, 1500].map((ms) => setTimeout(apply, ms));
		return {
			refresh: apply,
			destroy() {
				clearTimeout(timer);
				later.forEach(clearTimeout);
				if (raf !== void 0) view?.cancelAnimationFrame?.(raf);
				view?.removeEventListener("resize", onResize);
				host.style.removeProperty("margin-inline-start");
			}
		};
	}
	//#endregion
	//#region src/content/modes/collapse.ts
	/** The block is hidden; a slim bar above it expands it on click. */
	var applyCollapse = (root, ctx) => {
		const control = createControl({
			variant: "bar",
			open: ctx.open,
			label: (open) => t(open ? "barExpanded" : "barCollapsed"),
			onToggle: (open) => {
				setOpenAttr(root, open);
				ctx.onToggle(open);
			}
		});
		mirrorPlacement(control.host, root);
		root.before(control.host);
		const alignment = alignWithResults(control.host, root);
		root.setAttribute(ATTR_MODE, "collapse");
		setOpenAttr(root, ctx.open);
		return {
			refreshTheme: control.refreshTheme,
			isIntact: () => control.host.isConnected,
			destroy() {
				alignment.destroy();
				control.destroy();
				root.removeAttribute(ATTR_MODE);
				root.removeAttribute(ATTR_OPEN);
			}
		};
	};
	//#endregion
	//#region src/content/modes/hide.ts
	/** display: none, applied by content.css. Nothing is moved or deleted. */
	var applyHide = (root) => {
		root.setAttribute(ATTR_MODE, "hide");
		return {
			refreshTheme() {},
			isIntact: () => true,
			destroy() {
				root.removeAttribute(ATTR_MODE);
			}
		};
	};
	//#endregion
	//#region src/content/modes/minimize.ts
	/** A short faded preview of the block with a Show more / Show less button underneath. */
	var applyMinimize = (root, ctx) => {
		const control = createControl({
			variant: "bar",
			open: ctx.open,
			label: (open) => t(open ? "showLess" : "showMore"),
			onToggle: (open) => {
				setOpenAttr(root, open);
				ctx.onToggle(open);
			}
		});
		mirrorPlacement(control.host, root);
		root.after(control.host);
		const alignment = alignWithResults(control.host, root);
		root.setAttribute(ATTR_MODE, "minimize");
		setOpenAttr(root, ctx.open);
		root.style.setProperty(VAR_PREVIEW, `${ctx.settings.minimize.previewHeightPx}px`);
		return {
			refreshTheme: control.refreshTheme,
			isIntact: () => control.host.isConnected,
			destroy() {
				alignment.destroy();
				control.destroy();
				root.removeAttribute(ATTR_MODE);
				root.removeAttribute(ATTR_OPEN);
				root.style.removeProperty(VAR_PREVIEW);
			}
		};
	};
	//#endregion
	//#region src/content/modes/index.ts
	var RENDERERS = {
		hide: applyHide,
		collapse: applyCollapse,
		minimize: applyMinimize,
		blur: applyBlur
	};
	/** 'show' leaves the block untouched and returns null. */
	function applyMode(mode, root, ctx) {
		if (mode === "show") return null;
		return RENDERERS[mode](root, ctx);
	}
	//#endregion
	//#region src/content/controller.ts
	var ATTR_ID = "data-gemino-id";
	/**
	* Owns every block Gemino has found on the page: detects them, applies the configured mode,
	* and re-applies when settings change or the page re-renders.
	*/
	var Controller = class {
		doc;
		onCount;
		measureLayout;
		tracked = /* @__PURE__ */ new Map();
		settings;
		revealed = false;
		seq = 0;
		lastCount = -1;
		constructor(doc, settings, onCount = () => {}, measureLayout = true) {
			this.doc = doc;
			this.onCount = onCount;
			this.measureLayout = measureLayout;
			this.settings = settings;
			setDebugOutline(doc, this.debugOn());
		}
		/** Scans a scope (the whole document, or an added subtree) and handles anything new. */
		scan(scope = this.doc) {
			this.prune();
			const wanted = this.wantedTargets();
			if (wanted.size > 0) {
				const found = detect(scope, {
					enabled: wanted,
					requireRendered: this.measureLayout
				});
				const visible = found.map((d) => !this.measureLayout || d.root.getClientRects().length > 0);
				found.forEach((d, i) => this.track(d, visible[i] ?? false));
			}
			this.reportCount();
		}
		setSettings(settings) {
			this.settings = settings;
			setDebugOutline(this.doc, this.debugOn());
			this.refresh();
			this.scan(this.doc);
		}
		/** Temporarily show (or re-apply) everything on this page. */
		setRevealed(revealed) {
			this.revealed = revealed;
			this.refresh();
		}
		state() {
			return {
				handled: this.handledCount(),
				revealed: this.revealed
			};
		}
		/** Stops managing the page and restores every block. */
		dispose() {
			for (const t of this.tracked.values()) this.release(t);
			this.tracked.clear();
			setDebugOutline(this.doc, false);
			this.reportCount();
		}
		debugOn() {
			return this.settings.enabled && this.settings.debug;
		}
		wantedTargets() {
			const s = this.settings;
			const wanted = /* @__PURE__ */ new Set();
			if (!s.enabled) return wanted;
			if (s.debug || s.aiOverview.mode !== "show") wanted.add("aiOverview");
			if (s.debug || s.hideAiModeEntryPoints) wanted.add("aiModeEntry");
			if (s.debug || s.hideGeminiPromos) wanted.add("geminiPromo");
			return wanted;
		}
		effectiveMode(target) {
			const s = this.settings;
			if (!s.enabled || this.revealed || s.debug) return "show";
			switch (target) {
				case "aiOverview": return s.aiOverview.mode;
				case "aiModeEntry": return s.hideAiModeEntryPoints ? "hide" : "show";
				case "geminiPromo": return s.hideGeminiPromos ? "hide" : "show";
			}
		}
		signatureFor(target) {
			const mode = this.effectiveMode(target);
			const s = this.settings;
			switch (mode) {
				case "minimize": return `${mode}:${s.minimize.previewHeightPx}`;
				case "blur": return `${mode}:${s.blur.strengthPx}:${s.blur.reveal}`;
				default: return mode;
			}
		}
		track(d, counted) {
			const t = {
				id: `g${++this.seq}`,
				target: d.target,
				root: d.root,
				handle: null,
				signature: "",
				open: false,
				counted
			};
			d.root.setAttribute(ATTR_TARGET, d.target);
			d.root.setAttribute(ATTR_ID, t.id);
			this.tracked.set(d.root, t);
			debugLog(this.settings.debug, d, this.effectiveMode(d.target));
			this.render(t);
		}
		render(t) {
			t.handle?.destroy();
			t.handle = null;
			const mode = this.effectiveMode(t.target);
			t.signature = this.signatureFor(t.target);
			t.handle = applyMode(mode, t.root, {
				settings: this.settings,
				open: t.open,
				onToggle: (open) => {
					t.open = open;
				}
			});
		}
		release(t) {
			t.handle?.destroy();
			t.handle = null;
			t.root.removeAttribute(ATTR_TARGET);
			t.root.removeAttribute(ATTR_ID);
		}
		/** Drops blocks Google removed from the page, and repairs controls Google removed. */
		prune() {
			for (const [root, t] of this.tracked) if (!root.isConnected) {
				t.handle?.destroy();
				this.tracked.delete(root);
			} else if (t.handle && !t.handle.isIntact()) this.render(t);
		}
		refresh() {
			for (const t of this.tracked.values()) {
				if (!t.root.isConnected) continue;
				if (t.signature !== this.signatureFor(t.target) || t.handle && !t.handle.isIntact()) this.render(t);
				else t.handle?.refreshTheme();
			}
			this.prune();
			this.reportCount();
		}
		handledCount() {
			let n = 0;
			for (const t of this.tracked.values()) if (t.counted && t.root.isConnected && this.effectiveMode(t.target) !== "show") n++;
			return n;
		}
		reportCount() {
			const n = this.handledCount();
			if (n === this.lastCount) return;
			this.lastCount = n;
			this.onCount(n);
		}
	};
	//#endregion
	//#region src/content/observer.ts
	var IGNORED_TAGS = /* @__PURE__ */ new Set([
		"SCRIPT",
		"STYLE",
		"LINK",
		"META",
		"NOSCRIPT",
		"TEMPLATE"
	]);
	/** If more nodes than this arrive in one batch, rescan from the body instead of per node. */
	var MAX_NODES_PER_BATCH = 300;
	function isRelevant(node) {
		if (node.nodeType !== 1) return false;
		const el = node;
		if (IGNORED_TAGS.has(el.tagName)) return false;
		return !el.hasAttribute("data-gemino-host") && !el.closest(`[data-gemino-host]`);
	}
	/**
	* Watches for added elements (late-streaming AI Overviews, in-page navigation). The callback runs
	* as a microtask right after the DOM change, i.e. before the browser paints, so a block that
	* appears late is handled without a visible flash. Only added subtrees are handed back.
	*/
	function observeAdditions(doc, callback) {
		const observer = new MutationObserver((records) => {
			const added = [];
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
			const set = new Set(added);
			callback(added.filter((el) => !hasAncestorIn(el, set)));
		});
		observer.observe(doc.documentElement, {
			childList: true,
			subtree: true
		});
		return () => observer.disconnect();
	}
	function hasAncestorIn(el, set) {
		for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true;
		return false;
	}
	//#endregion
	//#region src/content/index.iife.ts
	/**
	* Main content script (document_idle). Loads settings, handles the blocks Google rendered, then
	* keeps watching for late-arriving ones and for settings / popup messages.
	*/
	var READY = "data-gemino-ready";
	async function main() {
		const root = document.documentElement;
		try {
			const settings = await loadSettings();
			const controller = new Controller(document, settings, (count) => {
				const msg = {
					type: "handled-count",
					count
				};
				try {
					chrome.runtime.sendMessage(msg).catch(() => {});
				} catch {}
			});
			controller.scan(document);
			root.setAttribute(READY, "");
			observeAdditions(document, (scopes) => {
				for (const scope of scopes) controller.scan(scope);
			});
			watchSettings((next) => controller.setSettings(next));
			window.addEventListener("popstate", () => controller.scan(document));
			window.addEventListener("pageshow", (e) => {
				if (e.persisted) controller.scan(document);
			});
			chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
				if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return;
				switch (message.type) {
					case "show-once":
						controller.setRevealed(message.reveal);
						sendResponse(controller.state());
						break;
					case "page-state": sendResponse(controller.state());
				}
			});
		} finally {
			root.setAttribute(READY, "");
		}
	}
	if (isSupportedPath(location.pathname)) main().catch((err) => console.error("[Gemino]", err));
	//#endregion
})();
