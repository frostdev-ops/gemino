import '../shared/ui.css';
import './options.css';
import { byId } from '../shared/dom.ts';
import { localizeDocument, t } from '../shared/i18n.ts';
import {
  BLOCK_MODES,
  BLUR_REVEALS,
  LIMITS,
  clampNumber,
  defaultSettings,
  loadSettings,
  saveSettings,
  updateSettings,
  watchSettings,
  type BlockMode,
  type BlurReveal,
  type Settings,
} from '../shared/settings.ts';

const enabled = byId<HTMLInputElement>('enabled');
const hideAiMode = byId<HTMLInputElement>('hideAiModeEntryPoints');
const hideGemini = byId<HTMLInputElement>('hideGeminiPromos');
const webOnly = byId<HTMLInputElement>('webOnly');
const debug = byId<HTMLInputElement>('debug');
const previewHeight = byId<HTMLInputElement>('previewHeight');
const previewHeightValue = byId<HTMLOutputElement>('previewHeightValue');
const blurStrength = byId<HTMLInputElement>('blurStrength');
const blurStrengthValue = byId<HTMLOutputElement>('blurStrengthValue');
const blurReveal = byId<HTMLSelectElement>('blurReveal');
const shortcuts = byId<HTMLAnchorElement>('shortcuts');
const reset = byId<HTMLButtonElement>('reset');
const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="mode"]')];
const modeOnly = [...document.querySelectorAll<HTMLElement>('[data-for]')];

previewHeight.min = String(LIMITS.previewHeightPx.min);
previewHeight.max = String(LIMITS.previewHeightPx.max);
blurStrength.min = String(LIMITS.strengthPx.min);
blurStrength.max = String(LIMITS.strengthPx.max);

localizeDocument();

function render(s: Settings): void {
  enabled.checked = s.enabled;
  hideAiMode.checked = s.hideAiModeEntryPoints;
  hideGemini.checked = s.hideGeminiPromos;
  webOnly.checked = s.webOnly;
  debug.checked = s.debug;
  previewHeight.value = String(s.minimize.previewHeightPx);
  previewHeightValue.textContent = t('pxUnit', String(s.minimize.previewHeightPx));
  blurStrength.value = String(s.blur.strengthPx);
  blurStrengthValue.textContent = t('pxUnit', String(s.blur.strengthPx));
  blurReveal.value = s.blur.reveal;
  for (const r of radios) r.checked = r.value === s.aiOverview.mode;
  // Sliders only matter for their own mode.
  for (const row of modeOnly) row.hidden = row.dataset.for !== s.aiOverview.mode;
}

const checkbox = (el: HTMLInputElement, apply: (s: Settings, v: boolean) => void) =>
  el.addEventListener('change', () => void updateSettings((s) => apply(s, el.checked)));

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

for (const r of radios) {
  r.addEventListener('change', () => {
    const mode = r.value as BlockMode;
    if (r.checked && (BLOCK_MODES as readonly string[]).includes(mode)) {
      void updateSettings((s) => {
        s.aiOverview.mode = mode;
      });
    }
  });
}

previewHeight.addEventListener('input', () => {
  const v = clampNumber(
    Number(previewHeight.value),
    LIMITS.previewHeightPx.min,
    LIMITS.previewHeightPx.max,
    160,
  );
  previewHeightValue.textContent = t('pxUnit', String(v));
  void updateSettings((s) => {
    s.minimize.previewHeightPx = v;
  });
});
blurStrength.addEventListener('input', () => {
  const v = clampNumber(
    Number(blurStrength.value),
    LIMITS.strengthPx.min,
    LIMITS.strengthPx.max,
    8,
  );
  blurStrengthValue.textContent = t('pxUnit', String(v));
  void updateSettings((s) => {
    s.blur.strengthPx = v;
  });
});
blurReveal.addEventListener('change', () => {
  const v = blurReveal.value as BlurReveal;
  if ((BLUR_REVEALS as readonly string[]).includes(v))
    void updateSettings((s) => {
      s.blur.reveal = v;
    });
});

// Extension shortcut pages are browser-specific internal URLs, so a plain link can't open them.
shortcuts.addEventListener('click', (e) => {
  e.preventDefault();
  const url = navigator.userAgent.includes('OPR/')
    ? 'opera://extensions/shortcuts'
    : 'chrome://extensions/shortcuts';
  void chrome.tabs.create({ url });
});

reset.addEventListener('click', () => void saveSettings(defaultSettings()));

void loadSettings().then((s) => {
  render(s);
  watchSettings(render);
});
