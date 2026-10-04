import en from '../../public/_locales/en/messages.json';

type Catalog = Record<string, { message: string }>;
const fallback = en as Catalog;

/**
 * Localized string. Uses chrome.i18n when running in the extension; falls back to the bundled
 * English catalog (tests, or a missing key in another locale). Substitution values replace $1.
 */
export function t(key: string, ...subs: string[]): string {
  let msg = '';
  try {
    msg = chrome.i18n.getMessage(key, subs);
  } catch {
    /* not running as an extension */
  }
  if (!msg) {
    msg = fallback[key]?.message ?? key;
    // The catalog uses $NAME$ placeholders; map them to the positional values.
    subs.forEach((s) => {
      msg = msg.replace(/\$[A-Z_]+\$/, s);
    });
  }
  return msg;
}

/** Fills text and attributes for elements marked with data-i18n / data-i18n-aria-label. */
export function localizeDocument(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n ?? '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel ?? ''));
  });
}
