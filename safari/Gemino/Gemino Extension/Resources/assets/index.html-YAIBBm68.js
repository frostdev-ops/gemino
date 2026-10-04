import { a as clampNumber, d as watchSettings, l as saveSettings, n as BLUR_REVEALS, o as defaultSettings, r as LIMITS, s as loadSettings, t as BLOCK_MODES, u as updateSettings } from "./settings-BB2iTyYc.js";
import { n as t, r as byId, t as localizeDocument } from "./i18n-CyiXuKcD.js";
//#region src/options/main.ts
var enabled = byId("enabled");
var hideAiMode = byId("hideAiModeEntryPoints");
var hideGemini = byId("hideGeminiPromos");
var webOnly = byId("webOnly");
var debug = byId("debug");
var previewHeight = byId("previewHeight");
var previewHeightValue = byId("previewHeightValue");
var blurStrength = byId("blurStrength");
var blurStrengthValue = byId("blurStrengthValue");
var blurReveal = byId("blurReveal");
var shortcuts = byId("shortcuts");
var reset = byId("reset");
var radios = [...document.querySelectorAll("input[name=\"mode\"]")];
var modeOnly = [...document.querySelectorAll("[data-for]")];
previewHeight.min = String(LIMITS.previewHeightPx.min);
previewHeight.max = String(LIMITS.previewHeightPx.max);
blurStrength.min = String(LIMITS.strengthPx.min);
blurStrength.max = String(LIMITS.strengthPx.max);
localizeDocument();
function render(s) {
	enabled.checked = s.enabled;
	hideAiMode.checked = s.hideAiModeEntryPoints;
	hideGemini.checked = s.hideGeminiPromos;
	webOnly.checked = s.webOnly;
	debug.checked = s.debug;
	previewHeight.value = String(s.minimize.previewHeightPx);
	previewHeightValue.textContent = t("pxUnit", String(s.minimize.previewHeightPx));
	blurStrength.value = String(s.blur.strengthPx);
	blurStrengthValue.textContent = t("pxUnit", String(s.blur.strengthPx));
	blurReveal.value = s.blur.reveal;
	for (const r of radios) r.checked = r.value === s.aiOverview.mode;
	for (const row of modeOnly) row.hidden = row.dataset.for !== s.aiOverview.mode;
}
var checkbox = (el, apply) => el.addEventListener("change", () => void updateSettings((s) => apply(s, el.checked)));
checkbox(enabled, (s, v) => {
	s.enabled = v;
});
checkbox(hideAiMode, (s, v) => {
	s.hideAiModeEntryPoints = v;
});
checkbox(hideGemini, (s, v) => {
	s.hideGeminiPromos = v;
});
checkbox(webOnly, (s, v) => {
	s.webOnly = v;
});
checkbox(debug, (s, v) => {
	s.debug = v;
});
for (const r of radios) r.addEventListener("change", () => {
	const mode = r.value;
	if (r.checked && BLOCK_MODES.includes(mode)) updateSettings((s) => {
		s.aiOverview.mode = mode;
	});
});
previewHeight.addEventListener("input", () => {
	const v = clampNumber(Number(previewHeight.value), LIMITS.previewHeightPx.min, LIMITS.previewHeightPx.max, 160);
	previewHeightValue.textContent = t("pxUnit", String(v));
	updateSettings((s) => {
		s.minimize.previewHeightPx = v;
	});
});
blurStrength.addEventListener("input", () => {
	const v = clampNumber(Number(blurStrength.value), LIMITS.strengthPx.min, LIMITS.strengthPx.max, 8);
	blurStrengthValue.textContent = t("pxUnit", String(v));
	updateSettings((s) => {
		s.blur.strengthPx = v;
	});
});
blurReveal.addEventListener("change", () => {
	const v = blurReveal.value;
	if (BLUR_REVEALS.includes(v)) updateSettings((s) => {
		s.blur.reveal = v;
	});
});
shortcuts.addEventListener("click", (e) => {
	e.preventDefault();
	const url = navigator.userAgent.includes("OPR/") ? "opera://extensions/shortcuts" : "chrome://extensions/shortcuts";
	chrome.tabs.create({ url });
});
reset.addEventListener("click", () => void saveSettings(defaultSettings()));
loadSettings().then((s) => {
	render(s);
	watchSettings(render);
});
//#endregion
