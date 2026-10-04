import '../shared/ui.css';
import './popup.css';
import { byId } from '../shared/dom.ts';
import { localizeDocument, t } from '../shared/i18n.ts';
import type { PageStateResponse, ShowOnceMessage } from '../shared/messages.ts';
import {
  BLOCK_MODES,
  loadSettings,
  updateSettings,
  watchSettings,
  type BlockMode,
  type Settings,
} from '../shared/settings.ts';

const enabled = byId<HTMLInputElement>('enabled');
const hideAiMode = byId<HTMLInputElement>('hideAiModeEntryPoints');
const hideGemini = byId<HTMLInputElement>('hideGeminiPromos');
const webOnly = byId<HTMLInputElement>('webOnly');
const modeGroup = byId<HTMLFieldSetElement>('modeGroup');
const status = byId<HTMLParagraphElement>('status');
const reveal = byId<HTMLButtonElement>('reveal');
const openOptions = byId<HTMLAnchorElement>('openOptions');
const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="mode"]')];

localizeDocument();

function render(s: Settings): void {
  enabled.checked = s.enabled;
  hideAiMode.checked = s.hideAiModeEntryPoints;
  hideGemini.checked = s.hideGeminiPromos;
  webOnly.checked = s.webOnly;
  for (const r of radios) r.checked = r.value === s.aiOverview.mode;
  // Everything but the master switch is inert while Gemino is off.
  for (const el of [hideAiMode, hideGemini, webOnly, ...radios]) el.disabled = !s.enabled;
  modeGroup.disabled = !s.enabled;
}

enabled.addEventListener(
  'change',
  () =>
    void updateSettings((s) => {
      s.enabled = enabled.checked;
    }),
);
hideAiMode.addEventListener(
  'change',
  () =>
    void updateSettings((s) => {
      s.hideAiModeEntryPoints = hideAiMode.checked;
    }),
);
hideGemini.addEventListener(
  'change',
  () =>
    void updateSettings((s) => {
      s.hideGeminiPromos = hideGemini.checked;
    }),
);
webOnly.addEventListener(
  'change',
  () =>
    void updateSettings((s) => {
      s.webOnly = webOnly.checked;
    }),
);
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

openOptions.addEventListener('click', (e) => {
  e.preventDefault();
  void chrome.runtime.openOptionsPage();
  window.close();
});

// ---- the current tab ---------------------------------------------------------------------

let tabId: number | undefined;
let revealed = false;

function renderPage(state: PageStateResponse | null): void {
  reveal.disabled = state === null;
  if (state === null) {
    status.textContent = t('statusNotGoogle');
    reveal.textContent = t('btnRevealPage');
    return;
  }
  revealed = state.revealed;
  status.textContent = t('statusHandled', String(state.handled));
  reveal.textContent = t(revealed ? 'btnRehidePage' : 'btnRevealPage');
}

async function askPage(
  message: { type: 'page-state' } | ShowOnceMessage,
): Promise<PageStateResponse | null> {
  if (tabId === undefined) return null;
  try {
    const res: unknown = await chrome.tabs.sendMessage(tabId, message);
    if (res && typeof res === 'object' && 'handled' in res && 'revealed' in res) {
      return res as PageStateResponse;
    }
  } catch {
    /* no content script on this tab (not a Google search page) */
  }
  return null;
}

reveal.addEventListener('click', async () => {
  renderPage(await askPage({ type: 'show-once', reveal: !revealed }));
});

async function init(): Promise<void> {
  render(await loadSettings());
  watchSettings(render);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  renderPage(await askPage({ type: 'page-state' }));
}

void init();
