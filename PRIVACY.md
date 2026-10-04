# Gemino privacy statement

Gemino does not collect, store, transmit, or share any personal data. It makes no network requests of its own and contains no analytics, tracking, advertising, or remote code.

## What is stored

Only your Gemino settings (for example "Collapse" for the AI Overview, and a few on/off switches). They are saved with the browser's extension storage (`chrome.storage.sync`). If you have browser sync turned on, your browser may sync them between your devices through your own browser account. Gemino itself never sees or transmits them.

## What Gemino reads

On Google search pages (the Google domains listed in the extension's permissions), Gemino reads the page structure to find the AI Overview, AI Mode buttons, and Gemini promos, and changes how they look. It does not read, record, or send your search queries, results, or browsing history.

## Permissions

| Permission                                            | Why                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access to `https://www.google.<domain>/` search pages | To find and restyle AI blocks on Google search pages. Only the search and home pages are matched.                                                   |
| `storage`                                             | To save your settings.                                                                                                                              |
| `declarativeNetRequestWithHostAccess`                 | For the optional Web only mode, which adds `udm=14` to Google search addresses. The rule runs inside the browser; Gemino does not see the requests. |

## Contact

Questions about this statement: open an issue in the project repository.
