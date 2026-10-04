# Gemino privacy policy

**Effective date:** 3 October 2026

**Extension:** Gemino

**Publisher:** James (Frostdev), https://frostdev.io

**Contact:** james@frostdev.io, or an issue at https://github.com/frostdev-ops/gemino/issues

This policy describes what the Gemino browser extension does with information. It covers the extension distributed for Chrome, Opera, Opera GX, and Safari. It does not cover Google Search, the browser's own account, or the browser's own AI features.

## Summary

Gemino does not collect, transmit, sell, or share personal data. It has no accounts, no analytics, no telemetry, and no advertising. The extension makes no network requests of its own.

## Information the extension collects

None. Gemino does not collect:

- name, email address, or other identity information
- search queries, search results, or browsing history
- location
- financial, health, or authentication information
- the contents of pages, beyond reading the page structure in memory as described below

Nothing the extension reads is stored, logged, or sent to Frostdev or to anyone else.

## Information stored on your device

Gemino stores only the settings you choose. Those are:

- whether the extension is enabled
- how the AI Overview is shown (show, hide, collapse, minimize, or blur)
- the minimized preview height and the blur strength
- whether blurred content reveals on hover or on click
- whether AI Mode buttons, Gemini promos, Web only mode, and debug outlines are on

The browser saves these in its extension storage (`chrome.storage.sync` on Chrome and Opera, the equivalent extension storage on Safari). If you have turned on browser sync, the browser may copy these settings to your other devices through your own browser account. The browser does that. Gemino never sees or transmits the synced copy.

Uninstalling the extension removes these settings from that browser profile.

## What Gemino reads on a page

On Google search pages only (https://www.google.com and the other regional `www.google` domains listed in the extension's permissions), the content script reads the structure of the page to find the AI Overview, AI Mode buttons and tabs, and Gemini promos, and changes how they are displayed. It does not read those blocks in order to record them. It does not read your search query, the organic results, or ads in order to store or send them.

The extension does not run on Gmail, Maps, YouTube, Drive, or other Google products. It matches the home page, `/search`, and `/webhp` on the `www` host, over HTTPS.

## Web only mode

Web only is off unless you turn it on. When it is on, the browser itself adds `udm=14` to Google search addresses, using a declarative rule packaged with the extension. That opens Google's plain Web results. The rule runs inside the browser. Gemino does not see the request, the address, or the response.

## Permissions

| Permission                                     | Why                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Access to `https://www.google.<domain>/` pages | To find and restyle AI blocks. Only the home, search, and `webhp` pages on the `www` host. |
| `storage`                                      | To save your settings on the device.                                                       |
| `declarativeNetRequestWithHostAccess`          | For optional Web only mode. Limited to the Google hosts above, and off by default.         |

Gemino does not request permission to read your tabs, history, cookies, or every website.

## Network requests and remote code

Gemino does not contact Frostdev, a developer server, or any analytics service. All of its code is in the package you install. It does not download or run remote code.

## Third parties

No data is sold. No data is shared with third parties for advertising, credit, or any other purpose. No data is shared at all, because none is collected.

Google receives your searches because you are using Google Search. That is between you and Google, under Google's own policies. Gemino is not a party to that.

## Children

Gemino is a general-purpose search tool. It does not collect personal information from anyone, including children under 13.

## Changes

If this policy changes, the new text will be published in this file, at the link below, with the extension update that changes it. The effective date at the top will change.

https://github.com/frostdev-ops/gemino/blob/main/PRIVACY.md

## Contact

Questions about this policy: james@frostdev.io, or https://github.com/frostdev-ops/gemino/issues.
