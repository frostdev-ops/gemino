import { d as watchSettings, s as loadSettings, t as BLOCK_MODES, u as updateSettings } from "./settings-BB2iTyYc.js";
import { n as t, r as byId, t as localizeDocument } from "./i18n-CyiXuKcD.js";
//#region src/popup/main.ts
var enabled = byId("enabled");
var hideAiMode = byId("hideAiModeEntryPoints");
var hideGemini = byId("hideGeminiPromos");
var webOnly = byId("webOnly");
var modeGroup = byId("modeGroup");
var status = byId("status");
var reveal = byId("reveal");
var openOptions = byId("openOptions");
var radios = [...document.querySelectorAll("input[name=\"mode\"]")];
localizeDocument();
function render(s) {
	enabled.checked = s.enabled;
	hideAiMode.checked = s.hideAiModeEntryPoints;
	hideGemini.checked = s.hideGeminiPromos;
	webOnly.checked = s.webOnly;
	for (const r of radios) r.checked = r.value === s.aiOverview.mode;
	for (const el of [
		hideAiMode,
		hideGemini,
		webOnly,
		...radios
	]) el.disabled = !s.enabled;
	modeGroup.disabled = !s.enabled;
}
enabled.addEventListener("change", () => void updateSettings((s) => {
	s.enabled = enabled.checked;
}));
hideAiMode.addEventListener("change", () => void updateSettings((s) => {
	s.hideAiModeEntryPoints = hideAiMode.checked;
}));
hideGemini.addEventListener("change", () => void updateSettings((s) => {
	s.hideGeminiPromos = hideGemini.checked;
}));
webOnly.addEventListener("change", () => void updateSettings((s) => {
	s.webOnly = webOnly.checked;
}));
for (const r of radios) r.addEventListener("change", () => {
	const mode = r.value;
	if (r.checked && BLOCK_MODES.includes(mode)) updateSettings((s) => {
		s.aiOverview.mode = mode;
	});
});
openOptions.addEventListener("click", (e) => {
	e.preventDefault();
	chrome.runtime.openOptionsPage();
	window.close();
});
var tabId;
var revealed = false;
function renderPage(state) {
	reveal.disabled = state === null;
	if (state === null) {
		status.textContent = t("statusNotGoogle");
		reveal.textContent = t("btnRevealPage");
		return;
	}
	revealed = state.revealed;
	status.textContent = t("statusHandled", String(state.handled));
	reveal.textContent = t(revealed ? "btnRehidePage" : "btnRevealPage");
}
async function askPage(message) {
	if (tabId === void 0) return null;
	try {
		const res = await chrome.tabs.sendMessage(tabId, message);
		if (res && typeof res === "object" && "handled" in res && "revealed" in res) return res;
	} catch {}
	return null;
}
reveal.addEventListener("click", async () => {
	renderPage(await askPage({
		type: "show-once",
		reveal: !revealed
	}));
});
async function init() {
	render(await loadSettings());
	watchSettings(render);
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true
	});
	tabId = tab?.id;
	renderPage(await askPage({ type: "page-state" }));
}
init();
//#endregion
