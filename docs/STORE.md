# Store submission notes

Use the files in `release/` after `npm run package`:

- `gemino-<version>.zip`: upload to the Chrome Web Store and to Opera add-ons.
- `gemino-<version>-source.zip`: Opera reviewers ask for source when code is built from a bundler. Upload it with the build steps below.

## Listing text

**Name**: Gemino

**Summary** (max 132 characters, matches the manifest): Hide, collapse, minimize, or blur Google's AI Overview, AI Mode, and Gemini prompts.

**Description**

Take back your Google search results. Gemino lets you decide how Google's AI shows up.

- AI Overview: show it, hide it, collapse it to a slim bar, shrink it to a short preview, or blur it until you want it.
- AI Mode: hide the AI Mode tab and the AI Mode button in the search box.
- Gemini promos: hide links and prompts that push Gemini.
- Web only: optionally send every search to Google's plain Web results, which have no AI at all.
- Works on all regional Google domains and in every language.
- Switch settings live from the toolbar popup. Press Alt+Shift+G to turn Gemino off and on.

Gemino runs only on Google search pages, collects no data, and makes no network requests. It cannot change the browser's own AI features (such as Chrome's Gemini button or Opera's Aria), because those are part of the browser.

**Category**: Productivity (Chrome Web Store); Utilities / Search (Opera add-ons)

**Screenshots to capture** (1280x800): collapsed bar; minimized preview; blurred overview; popup; options page. `scripts/live-smoke.ts` can produce page screenshots.

## Chrome Web Store: privacy tab

**Single purpose**: Control how Google's AI-generated content is displayed on Google search pages.

**Permission justifications**

- `storage`: Saves the user's display settings.
- `declarativeNetRequestWithHostAccess`: Used only by the optional "Web only" setting, which adds `udm=14` to Google search URLs so results open on Google's Web tab. It is limited to Google search hosts.
- Host permissions (`https://www.google.<domain>/`, `/search`, `/webhp`): Needed to find and restyle the AI Overview, AI Mode buttons, and Gemini promos on Google search pages. Each regional domain is listed because match patterns cannot use `google.*`.

**Remote code**: No. All code ships in the package.

**Data usage**: Check none of the data collection boxes. Certify the three limited-use statements. Privacy policy: link to the hosted copy of `PRIVACY.md`.

## Opera add-ons

- Category: Search tools or Utilities.
- Opera GX installs from the Opera add-ons store or from the Chrome Web Store (with the "Install Chrome Extensions" add-on). Test both before announcing.
- Smoke-test in Opera GX before submitting (see `docs/QA.md`).
- Source code upload: `gemino-<version>-source.zip`. Reviewer build steps:

```sh
# Node 22 or newer
npm ci
npm run build      # output in dist/, identical to the submitted package
```

`npm run build` generates `public/rules/web_only.json` from `src/shared/google-domains.json` before bundling. The build is unminified.

## Version bump

1. Change `version` in `package.json` (the manifest reads it).
2. `npm run lint && npm test && npm run test:e2e`.
3. `npm run package`.
4. Upload the new zips.
