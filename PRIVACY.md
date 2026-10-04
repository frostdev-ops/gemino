# Gemino privacy policy

Gemino does not collect, transmit, sell or share any data. It has no analytics, no telemetry, no advertising and no accounts. The extension makes no network requests of its own.

## What is stored

Only your Gemino settings: which mode to use for the AI Overview, a few on/off switches, and two slider values. They are saved with the browser's extension storage (`chrome.storage.sync`). If sync is turned on in your browser, the browser may copy these settings to your other devices through your own browser account. That is done by the browser; Gemino never sees or transmits them.

## What Gemino reads

On Google search pages (https://www.google.com and the other regional Google domains listed in the extension's permissions) the content script reads the structure of the page to find the AI Overview, AI Mode buttons and Gemini promos, and changes how they are displayed. It does not read, record, store or send your search queries, search results or browsing history.

## The Web only option

If you turn it on, the browser itself adds `udm=14` to Google search addresses using a declarative rule. The rule runs inside the browser; Gemino does not see the requests.

## Permissions

| Permission                                     | Why                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Access to `https://www.google.<domain>/` pages | To find and restyle AI blocks. Only the home, search and `webhp` pages on the `www` host. |
| `storage`                                      | To save your settings.                                                                    |
| `declarativeNetRequestWithHostAccess`          | For the optional Web only mode. Limited to the Google hosts above and off by default.     |

## Third parties

None. No data is shared with anyone because none is collected.

## Changes

If this ever changes, the new policy will be published with the update that changes it.

## Contact

Open an issue in the project repository.
