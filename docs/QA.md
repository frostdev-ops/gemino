# Manual QA checklist

Automated coverage (run on every change): `npm test` (unit tests against saved Google pages) and `npm run test:e2e` (the built extension in Chromium, pages served from fixtures). `npx tsx scripts/live-smoke.ts` exercises real Google pages in Chromium.

This checklist covers what automation cannot: real browsers, real accounts, and real Google variation. Run it in **Chrome** and in **Opera GX** before every store submission. Mark each line with the browser and date.

## Setup

- [ ] `npm run build`, then load `dist/` unpacked (`chrome://extensions` / `opera://extensions`, Developer mode).
- [ ] The extension loads with no errors on the extensions page.
- [ ] Opera GX only: the toolbar icon and popup are reachable (pin the extension if needed).

## AI Overview

Use queries that trigger an AI Overview, e.g. "why is the sky blue", "how long to boil an egg".

- [ ] **Collapse** (default): a slim bar replaces the overview; the organic results move up; clicking the bar expands it; clicking again collapses it; Tab + Enter works.
- [ ] **Hide**: no overview, no bar, no gap.
- [ ] **Minimize**: short faded preview, Show more / Show less works.
- [ ] **Blur, hover**: blurred; hover or keyboard focus reveals it.
- [ ] **Blur, click**: overlay appears; clicking reveals it.
- [ ] **Show**: untouched.
- [ ] Switching modes in the popup or options page updates an already open results tab without reloading.
- [ ] No flash of the overview before it is hidden or collapsed (reload a few times).
- [ ] A query without an overview (e.g. "youtube") looks normal and has no bars.
- [ ] Follow-up search from the results page (type a new query in the box) is handled.

## Pages and locales

- [ ] google.com, google.co.uk, google.de, google.fr, google.co.jp, and one more regional domain.
- [ ] Interface language other than English (`&hl=de`, `&hl=ja`): the overview is still found.
- [ ] Signed in and signed out.
- [ ] Light theme and dark theme (Google's Settings > Appearance, not just the OS): the bar matches.
- [ ] Zoom 50% and 200%: the bar stays one slim row, text readable.
- [ ] Images, News, Videos, Shopping tabs: no errors, nothing hidden.
- [ ] Homepage (`google.com`, including `?hl=...`): the AI Mode button in the search box is hidden when the option is on.

## AI Mode and Gemini

- [ ] With "Hide AI Mode buttons and tabs" on: the AI Mode tab and the search-box button are gone, with no gap in the tab row.
- [ ] Turn it off: they come back immediately.
- [ ] With "Hide Gemini promos" on, while signed in: any Gemini promo card is gone. If one stays, capture it (see README) and add it to `targets.ts`.

## Web only

- [ ] Turn on Web only, search from the address bar: the result URL contains `udm=14` and shows no AI Overview.
- [ ] Images / News / Videos tabs still work (not redirected).
- [ ] Back button does not trap you in a redirect loop.
- [ ] Turn it off: normal results again.
- [ ] Master switch off also stops the redirect.

## Extension UI

- [ ] Popup: master switch, mode picker, toggles, status line, "Show everything on this page" and "Hide again".
- [ ] Options page: all settings; sliders only appear for their mode; Reset to defaults works.
- [ ] The keyboard shortcut (`Alt+Shift+G`) toggles Gemino; toolbar badge shows OFF while disabled and the handled count on results pages.
- [ ] "Change the keyboard shortcut" link opens the browser's shortcuts page (Chrome: `chrome://extensions/shortcuts`; Opera GX: `opera://extensions/shortcuts`, verify).
- [ ] Settings persist after restarting the browser.

## Performance and safety

- [ ] No console errors from Gemino on results pages (DevTools, Console).
- [ ] Scrolling and typing on a results page feel normal.
- [ ] With Debug on, outlines appear around each detected block and the blocks are visible.

## Result

| Browser | Version | Date | Tester | Notes |
| ------- | ------- | ---- | ------ | ----- |
|         |         |      |        |       |
