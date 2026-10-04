<p align="center">
  <strong>Google search, without the AI in the way.</strong><br>
  Hide, collapse, minimize, or blur the AI Overview. One extension for Chrome and Opera GX.
</p>

<p align="center">
  <a href="#load-it">Load it</a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="https://github.com/frostdev-ops/gemino/issues">Report an issue</a>
</p>

Gemino is part of [Frostdev](https://frostdev.io), alongside [Rimeward](https://github.com/frostdev-ops/rimeward) and [Crosspane](https://github.com/frostdev-ops/crosspane).

It finds the AI Overview, the AI Mode tab and buttons, and Gemini promos on Google search, and lets you choose how each one looks. It runs on every regional Google domain. It does not collect or send any data.

## What you can do

|                                      | In Gemino                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Choose how the AI Overview looks** | Show it, hide it, fold it into a bar, keep a short preview, or blur it until you reveal it. Collapse is the default. |
| **Quiet the rest of the AI**         | Hide the AI Mode tab, the button in the search box, and Gemini promos.                                               |
| **Search the web only**              | Send a search to Google's plain Web results, which have no AI Overview. Images, News, and Videos stay as they are.   |
| **Turn it off for a moment**         | `Alt+Shift+G` toggles Gemino. The popup can show everything on the current page.                                     |

## Load it

Node 22 or newer.

```sh
npm install
npm run build
```

In Chrome, open `chrome://extensions`, turn on Developer mode, and load the `dist/` folder. In Opera GX, do the same from `opera://extensions`.

`npm test` runs the unit tests. `npm run test:e2e` loads the built extension in Chromium against saved Google pages.
