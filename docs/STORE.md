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

**Screenshots**: Opera wants 612×408 (800×600 at most), on a white background, with no other extensions visible. `npx tsx scripts/opera-screenshots.ts` writes those to `release/opera/` from the built extension and a saved search page. Chrome Web Store shots can be larger; crop the same captures.

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

Upload at [addons.opera.com](https://addons.opera.com/developer/). The form fields below follow [Opera's publishing guidelines](https://help.opera.com/en/extensions/publishing-guidelines/).

| Field          | Value                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| Package        | `release/gemino-<version>.zip` (manifest at the zip root)                            |
| Source         | `release/gemino-<version>-source.zip` (bundled code; the build is unminified)        |
| Name           | Gemino                                                                               |
| Version        | `0.1.0` (from `package.json`; one to four dot-separated integers, no leading zeros)  |
| Summary        | Hide, collapse, minimize, or blur Google's AI Overview, AI Mode, and Gemini prompts. |
| Category       | Productivity                                                                         |
| Support page   | https://github.com/frostdev-ops/gemino                                               |
| Privacy policy | https://github.com/frostdev-ops/gemino/blob/main/PRIVACY.md                          |
| Screenshots    | `release/opera/*.png`, each 612×408                                                  |
| Icon           | `public/icons/icon-128.png`, also packed in the zip                                  |

**License.** [MIT](../LICENSE). https://github.com/frostdev-ops/gemino/blob/main/LICENSE

**Description** (paste into the long description):

> Gemino lets you decide how Google's AI shows up on Google Search.
>
> The AI Overview can stay as it is, disappear, fold into a slim bar you click open, shrink to a short faded preview, or stay blurred until you hover or click. Collapse is the default.
>
> It can also hide the AI Mode tab and the AI Mode button in the search box, and hide links that send you to Gemini.
>
> An optional Web only setting sends searches to Google's plain Web results, which have no AI Overview. Images, News, and Videos are left alone.
>
> It runs on the regional Google domains. Changes apply to open tabs immediately. The toolbar popup can show everything on the current page, and Alt+Shift+G turns Gemino on or off.
>
> Gemino only runs on Google search pages. It collects no data and makes no network requests. It does not change Google's ads or organic results, and it cannot change Opera's own Aria button, because that is part of the browser.

- Opera and Opera GX run this Manifest V3 package with no browser-specific code.
- **Tested status**: built and checked in Chromium. Opera was not available where this was packaged. Do not claim an Opera test in the listing until `docs/QA.md` has been run there.

### How to produce the build

Paste this into Opera's "instructions to produce the build" field.

**Environment**

- OS: Arch Linux, kernel `7.2.5-3-omarchy`, `x86_64`. Any current Linux, macOS, or Windows machine is fine. The build does not use OS libraries.
- Node.js `v26.8.2`
- npm `11.19.1` (ships with that Node.js)
- Yarn is not used. Grunt is not used. There is no global install step.
- `npm ci` installs the locked toolchain: TypeScript `6.0.3`, Vite `8.3.2`, tsx `4.23.15`, `@crxjs/vite-plugin` `3.0.0`.
- Info-ZIP `3.0` is used only by `npm run package`, to zip `dist/`. It is not required to produce `dist/` itself.
- Node.js 22 or newer also works. The package was built with the versions above.

**Commands**

```sh
# From the directory that contains gemino-0.1.0-source.zip
unzip gemino-0.1.0-source.zip -d gemino-src
cd gemino-src
npm ci
npm run build
```

`npm run build` does three things, in order:

1. `tsx scripts/build-rules.ts` writes `public/rules/web_only.json` from `src/shared/google-domains.json`.
2. `tsc --noEmit` type-checks.
3. `vite build` bundles the extension with CRXJS. Output is unminified. `modulePreload` polyfill is off, so the bundle contains no `fetch`.

The result is `dist/`. `gemino-0.1.0.zip` is that directory, with `manifest.json` at the archive root. To recreate the zip: `npm run package` (needs the `zip` command). Load `dist/` from `opera://extensions` with Developer mode on.

- The Web only ruleset (`rules/web_only.json`) is 16 KB; the reviewer may regenerate it with `npm run rules`.
- Keyboard shortcut: the manifest suggests `Alt+Shift+G`. Opera may handle shortcuts differently; confirm in `opera://extensions/shortcuts`.
- Opera's Aria and the sidebar AI features are browser UI and cannot be changed by extensions. Say so in the listing.

## Releasing a new version

1. Change `version` in `package.json` (the manifest reads it).
2. `npm run lint && npm run typecheck && npm test && npm run test:e2e`
3. `npm run package`
4. Upload both zips; add release notes.
