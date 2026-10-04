# QA

Gemino has three layers of checks. This file says what each one covers, gives the exact commands, and lists what still needs a person, especially in Opera GX, which could not be tested in the build environment.

## Automated checks

| Layer              | Command                         | What it covers                                                                                                                                                                                                         |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint and format    | `npm run lint`                  | ESLint and Prettier.                                                                                                                                                                                                   |
| Types              | `npm run typecheck`             | `tsc --noEmit` over `src`, `scripts`, `tests`.                                                                                                                                                                         |
| Unit               | `npm test`                      | Settings validation, match patterns, Web only rules (and that `public/rules/web_only.json` is up to date), message validation, i18n catalog, manifest invariants, theme detection, observer, detection on saved pages. |
| End to end         | `npm run test:e2e`              | The built extension loaded in Chromium; Google pages are answered from `tests/fixtures`. Modes, live switching, AI Mode hiding, Web only redirect, popup and options.                                                  |
| Live smoke         | `npx tsx scripts/live-smoke.ts` | The same extension against real Google result pages. Needs network. Not part of CI.                                                                                                                                    |
| Packaging          | `npm run package`               | Build, then `release/gemino-<version>.zip` and `release/gemino-<version>-source.zip`.                                                                                                                                  |
| Reproducible build | see below                       | Source zip rebuilt from scratch gives a byte-identical `dist/`.                                                                                                                                                        |

Run the whole suite:

```sh
npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run package
```

`npm run test:e2e` launches `/usr/bin/chromium` (or `CHROME_PATH`) with the extension loaded from `dist/`, so it needs a real browser and a sandbox that allows that.

### Live smoke test

```sh
npm run build
npx tsx scripts/live-smoke.ts                   # light run on 4 results pages + homepage, dark run on en-us
npx tsx scripts/live-smoke.ts --sites=en-us     # one site
npx tsx scripts/live-smoke.ts --dark            # dark theme only
npx tsx scripts/live-smoke.ts --fresh           # reload the page for every mode
npx tsx scripts/live-smoke.ts --headed          # real window instead of --headless=new
```

For each site it records a baseline (with Debug on, so the unmodified size of the AI Overview is known), then switches through show, hide, collapse, minimize, blur on hover and blur on click, and checks: the AI Overview was detected, it is hidden / collapsed / capped as expected, the bar and its expand/collapse (mouse and keyboard) work, the organic results column is still visible, the ads slot is unchanged, the AI Mode tab and search-box button are hidden, `html[data-gemino-ready]` is set, and the extension logged no console errors. It also re-inserts a copy of the block into the live page (late-load) and does a fresh load while counting animation frames in which the AI Overview was visible (flash check). Screenshots and `report.json` go to `/tmp/gemino-live/`.

Notes:

- AI Overviews are not served for every query or load. When none is served, the mode checks are reported as inconclusive rather than passed.
- A full run is about 30 page loads. Repeating it within a few minutes makes Google answer with its captcha page (`/sorry/`); the script reports that as `BLOCKED`. Wait and retry, or use `--headed`.
- In `--headed` mode a real mouse cursor over the window can keep reporting `:hover` on the block; the two blur-on-hover checks that depend on the pointer being away are then marked inconclusive.

### Reproducibility check (for Opera's reviewers)

```sh
npm run package
rm -rf /tmp/gemino-src && mkdir /tmp/gemino-src && cd /tmp/gemino-src
unzip -q <repo>/release/gemino-<version>-source.zip
npm ci && npm run build
diff -r dist <repo>/dist && echo identical
```

## Verification status

"Chromium" is the distribution's Chromium (`/usr/bin/chromium`, headless or headed under Linux), not Google Chrome and not Opera GX.

| Area                                                                       | Unit | E2E (Chromium, fixtures) | Live smoke (Chromium) | Needs a human in Chrome | Needs a human in Opera GX |
| -------------------------------------------------------------------------- | :--: | :----------------------: | :-------------------: | :---------------------: | :-----------------------: |
| Settings migration and validation                                          | yes  |           yes            |           -           |            -            |             -             |
| Match patterns, host permissions, manifest invariants                      | yes  |            -             |           -           |            -            |            yes            |
| Detection of AI Overview, AI Mode, Gemini links on saved pages (5 locales) | yes  |           yes            |           -           |            -            |             -             |
| Detection on live pages (en-US, de, fr, ja, dark theme)                    |  -   |            -             |          yes          |           yes           |            yes            |
| Modes: hide, collapse, minimize, blur hover, blur click                    | yes  |           yes            |          yes          |           yes           |            yes            |
| No flash of the AI Overview on load                                        |  -   |            -             |          yes          |           yes           |            yes            |
| Late-arriving block handled before paint                                   | yes  |            -             |          yes          |            -            |             -             |
| Collapse bar placement (click); keyboard use (Enter on the focused bar)    |  -   |        click only        |          yes          |           yes           |            yes            |
| Organic results and ads untouched                                          | yes  |           yes            |          yes          |           yes           |            yes            |
| AI Mode tab and search-box button hidden (results and homepage)            | yes  |           yes            |          yes          |           yes           |            yes            |
| Gemini promos hidden                                                       | yes  |            -             |    no promo served    |     yes (signed in)     |      yes (signed in)      |
| Live switching of settings, master switch, "show everything on this page"  |  -   |           yes            |    switching only     |           yes           |            yes            |
| Web only redirect (`udm=14`, Images/News untouched, no loop)               | yes  |           yes            |           -           |           yes           |            yes            |
| Popup, options page                                                        |  -   |           yes            |           -           |           yes           |            yes            |
| `Alt+Shift+G` shortcut, OFF badge, count badge                             |  -   |            -             |           -           |           yes           |            yes            |
| Install from `dist/` and from the store zip                                |  -   |    `dist/` (unpacked)    |           -           |           yes           |            yes            |
| Reproducible build from the source zip                                     |  -   |            -             |           -           |            -            |       reviewer step       |

The Opera GX column is entirely manual. Opera GX was not installed where this was built, so nothing has been run in it; compatibility is expected (Opera GX is Chromium-based and runs Chrome MV3 extensions) but unverified.

## Manual checklist

Run in Chrome and in Opera GX, before each store submission. Record browser, version and date in the table at the end.

### Setup

- [ ] `npm ci && npm run build`, then load `dist/` unpacked (`chrome://extensions` or `opera://extensions`, Developer mode, Load unpacked).
- [ ] The extension loads with no errors on the extensions page.
- [ ] Opera GX: the toolbar icon and popup are reachable (pin the extension if needed).
- [ ] Also install the store zip (`release/gemino-<version>.zip`, unzipped) once to confirm it matches `dist/`.

### AI Overview

Use queries that trigger an AI Overview, for example "how long to boil an egg" or "why is the sky blue".

- [ ] **Collapse** (default): a slim bar replaces the overview, the organic results move up, clicking the bar expands it, clicking again collapses it.
- [ ] **Collapse, keyboard**: Tab to the bar, Enter or Space toggles it, a focus ring is visible, and the label changes between "hidden. Click to expand." and "shown. Click to collapse.".
- [ ] **Hide**: no overview, no bar, no gap.
- [ ] **Minimize**: a short faded preview; Show more / Show less works; the fade is smooth.
- [ ] **Blur, hover**: blurred; hover or keyboard focus reveals it; moving away blurs it again.
- [ ] **Blur, click**: overlay with "Click to reveal AI Overview"; a click reveals it.
- [ ] **Show**: untouched.
- [ ] Sponsored results at the top of the page are still there in every mode.
- [ ] Switching mode in the popup or options page updates an already open results tab without reloading.
- [ ] Reload several times: the overview never flashes before being hidden or collapsed.
- [ ] A query without an overview (for example "youtube") looks normal and has no bars.
- [ ] A follow-up search typed into the results page is handled.
- [ ] Reduced motion (OS setting "reduce motion"): the chevron and blur transitions do not animate.

### Pages and locales

- [ ] google.com, google.co.uk, google.de, google.fr, google.co.jp, plus one other regional domain.
- [ ] Interface language other than English (`&hl=de`, `&hl=ja`, `&hl=fr`): the overview is still found.
- [ ] Signed in and signed out.
- [ ] Light and dark theme (Google's Settings, Appearance, not only the OS): the bar matches the page.
- [ ] Zoom 50% and 200%: the bar stays one slim row and the text stays readable.
- [ ] Images, News, Videos, Shopping tabs: no errors, nothing hidden.
- [ ] Homepage (`google.com`, also with `?hl=de`): the AI Mode button in the search box is hidden when the option is on.

### AI Mode and Gemini

- [ ] "Hide AI Mode buttons and tabs" on: the AI Mode tab and the search-box button are gone, with no gap in the tab row.
- [ ] Turn it off: they come back immediately.
- [ ] "Hide Gemini promos" on, signed in: any Gemini promo card or link is gone. If one stays, capture it (see the README) and add it to `targets.ts`.
- [ ] The browser's own Gemini button (Chrome) or Aria (Opera GX) is still there; that is expected.

### Web only

- [ ] Turn on Web only and search from the address bar: the result URL contains `udm=14` and there is no AI Overview.
- [ ] Search from the Google homepage box: same result.
- [ ] Images, News and Videos tabs still work and are not redirected.
- [ ] The Back button does not trap you in a redirect loop.
- [ ] Turn Web only off: normal results again.
- [ ] Master switch off also stops the redirect.

### Extension UI

- [ ] Popup: master switch, mode picker, toggles, status line, "Show everything on this page" and "Hide again".
- [ ] Options page: all settings, sliders only for their mode, Reset to defaults.
- [ ] `Alt+Shift+G` toggles Gemino; the toolbar badge shows `OFF` while disabled and the handled count on results pages.
- [ ] The "Change the keyboard shortcut" link opens the browser's shortcuts page (Chrome: `chrome://extensions/shortcuts`; Opera GX: check that the link works and what it opens).
- [ ] Settings persist after restarting the browser.

### Safety

- [ ] No console errors from Gemino on results pages (DevTools, Console).
- [ ] Scrolling and typing on a results page feel normal.
- [ ] Debug on: outlines appear around each detected block and the blocks are visible.

### Result

| Browser | Version | Date | Tester | Notes |
| ------- | ------- | ---- | ------ | ----- |
|         |         |      |        |       |
