# Store listing material

Artifacts come from `npm run package` (see the README):

- `release/gemino-<version>.zip`: the extension. Upload it to the Chrome Web Store and to Opera add-ons.
- `release/gemino-<version>-source.zip`: the source for Opera's reviewers (and for Chrome, if asked).

## Listing

**Name**: Gemino

**Short description** (132 characters or fewer; identical to `extDescription` in `public/_locales/en/messages.json` and therefore to the manifest):

> Hide, collapse, minimize, or blur Google's AI Overview, AI Mode, and Gemini prompts.

**Detailed description**

> Gemino lets you decide how Google's AI shows up on Google Search.
>
> AI Overview: leave it, hide it completely, collapse it to a slim bar you can click open, shrink it to a short faded preview, or blur it until you hover or click.
>
> AI Mode: hide the AI Mode tab in the results navigation and the AI Mode button in the search box.
>
> Gemini promos: hide links that send you to Gemini from the search page.
>
> Web only: optionally send every search to Google's plain Web results (the "Web" filter), which have no AI Overview at all. Images, News and other tabs are left alone.
>
> Also: works on the regional Google domains (google.com, google.co.uk, google.de, google.co.jp and more); changes apply to open tabs immediately; the toolbar popup has a "Show everything on this page" button; Alt+Shift+G turns Gemino on or off; light and dark themes are followed.
>
> Gemino only runs on Google search pages. It collects no data and makes no network requests. It does not touch Google's ads or organic results.
>
> Limits: Gemino cannot change the browser's own AI features, such as Chrome's Gemini button or Opera's Aria, because those are part of the browser. Google changes its page markup from time to time, so a block may occasionally be missed until the extension is updated.

**Category**: Chrome Web Store, Productivity (alternative: Search Tools). Opera add-ons, Utilities or Search tools.

**Language**: English. Detection works for the locales in `src/content/detect/labels.ts`, but the interface is English only.

**Screenshots** (1280x800): collapse bar on a results page; minimized preview; blurred overview; popup; options page. `npx tsx scripts/live-smoke.ts` writes full-page-size screenshots of each mode to `/tmp/gemino-live/` that can be cropped for this.

## Single purpose

Control how Google's AI-generated content (AI Overview, AI Mode entry points and Gemini promotions) is displayed on Google search pages.

## Permissions

| Permission                                                                  | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                                                                   | Saves the user's settings (display mode, toggles, sizes) in `chrome.storage.sync`.                                                                                                                                                                                                                                                                                                                                                                                       |
| `declarativeNetRequestWithHostAccess`                                       | Used only by the optional "Web only" setting. When enabled, a static ruleset adds `udm=14` to Google search URLs so results open on Google's Web tab. It is limited to the host permissions below, and is disabled by default. The `WithHostAccess` variant is used instead of `declarativeNetRequest` so that the rule can only act on the Google search hosts the user has already granted, not on every site.                                                         |
| Host permissions: `https://www.google.<tld>/`, `/?*`, `/search*`, `/webhp*` | Needed to run the content script on Google search pages (to find and restyle the AI blocks) and for the Web only redirect to apply there. There is one entry per Google domain (187 domains, 4 paths each) because match patterns cannot express "`google.*`" or "any Google country domain". Only the `www` host over https is matched, and only the home, search and `webhp` paths. Nothing else (Gmail, Maps, YouTube, news.google.com, other subdomains) is matched. |

The extension does not request `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `history`, or `<all_urls>`.

## Remote code

None. All JavaScript is in the package. There is no `eval`, `new Function`, remotely hosted script, or dynamic import from a URL. The build is unminified so it can be read.

## Data usage disclosure (Chrome Web Store, Privacy practices tab)

- Personally identifiable information: not collected.
- Health, financial, authentication, personal communications, location, web history, user activity, website content: not collected, not transmitted.
- All three certifications can be ticked: data is not sold to third parties, not used or transferred for purposes unrelated to the single purpose, and not used or transferred to determine creditworthiness or for lending.
- Privacy policy URL: host `PRIVACY.md` (text below) on a public page and link it.

Statement for reviewers: the content script reads the page's DOM only to find the AI blocks and set attributes on them. Nothing it reads is stored, logged or sent anywhere.

## Privacy policy

(Same text as `PRIVACY.md`.)

> **Gemino privacy policy**
>
> Gemino does not collect, transmit, sell or share any data. It has no analytics, no telemetry, no advertising and no accounts. The extension makes no network requests of its own.
>
> **What is stored.** Only your Gemino settings: which mode to use for the AI Overview, a few on/off switches, and two slider values. They are saved with the browser's extension storage (`chrome.storage.sync`). If sync is turned on in your browser, the browser may copy these settings to your other devices through your own browser account; that is done by the browser, and Gemino never sees or transmits them.
>
> **What Gemino reads.** On Google search pages (https://www.google.com and the other regional Google domains listed in the extension's permissions) the content script reads the structure of the page to find the AI Overview, AI Mode buttons and Gemini promos, and changes how they are displayed. It does not read, record, store or send your search queries, search results or browsing history.
>
> **The Web only option.** If you turn it on, the browser itself adds `udm=14` to Google search addresses using a declarative rule. The rule runs inside the browser; Gemino does not see the requests.
>
> **Third parties.** None. No data is shared with anyone because none is collected.
>
> **Changes.** If this ever changes, the new policy will be published with the update that changes it.
>
> **Contact.** Open an issue in the project repository.

### Verification of the "no network, no remote code" claim

Searched `src/` (TypeScript and HTML) and the built `dist/` bundles for `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `eval(`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` and `importScripts`: no matches. The only URLs in the code are the `https://www.google.<tld>` match patterns and a fallback base URL (`https://www.google.com/`) used to parse relative links. The extension uses these browser APIs: `storage`, `runtime` (messages), `action` (badge), `commands`, `tabs` (query, create and message the active tab from the popup), `declarativeNetRequest` (enable or disable the bundled ruleset). All text inserted into the page is set with `textContent`. (The default Vite build includes a `modulepreload` polyfill containing a `fetch` call; it is disabled in `vite.config.ts` so the bundle has none.)

Re-run the check:

```sh
rg -n "fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval\(|new Function|innerHTML|outerHTML|insertAdjacentHTML|document\.write|importScripts" src dist -g '*.ts' -g '*.js' -g '*.html'
```

## Opera add-ons

- Opera GX runs Chrome Manifest V3 extensions. Gemino is one build for both stores, with no browser-specific code.
- **Tested status**: not tested in Opera GX or Opera. Opera was not available where this was built. Unit tests, Playwright end-to-end tests and a live smoke test were run in Chromium only. Do not state in the listing that it has been tested in Opera until `docs/QA.md` has been run there.
- Opera's reviewers need the source for bundled code. Upload `gemino-<version>-source.zip` and give them these steps:

  ```sh
  # Node 22 or newer, npm 10 or newer
  unzip gemino-<version>-source.zip -d gemino-src && cd gemino-src
  npm ci
  npm run build      # writes dist/, identical to the submitted package
  ```

  `npm run build` first generates `public/rules/web_only.json` from `src/shared/google-domains.json`, type-checks, then bundles with Vite and CRXJS. It is unminified. The result was checked to be identical (`diff -r`) to the `dist/` of the repository it was packaged from.

- The Web only ruleset (`rules/web_only.json`) is 16 KB; the reviewer may regenerate it with `npm run rules`.
- Keyboard shortcut: the manifest suggests `Alt+Shift+G`. Opera may handle shortcuts differently; confirm in `opera://extensions/shortcuts`.
- Opera's Aria and the sidebar AI features are browser UI and cannot be changed by extensions. Say so in the listing.

## Releasing a new version

1. Change `version` in `package.json` (the manifest reads it).
2. `npm run lint && npm run typecheck && npm test && npm run test:e2e`
3. `npm run package`
4. Upload both zips; add release notes.
