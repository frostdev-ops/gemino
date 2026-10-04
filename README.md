<p align="center">
  <strong>Google search, without the AI in the way.</strong><br>
  Hide, collapse, minimize, or blur the AI Overview. Chrome, Opera GX, and Safari.
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

## Safari

Download the signed and notarized **Safari Mac app** from [GitHub Releases](https://github.com/frostdev-ops/gemino/releases/latest). It supports Intel and Apple Silicon Macs running macOS 12 or newer.

1. Unzip `gemino-0.1.0-safari-macos.zip` and move `Gemino.app` into Applications.
2. Open Gemino once, then choose **Quit and Open Safari Settings…**.
3. In Safari Settings → Extensions, turn Gemino on. Allow access to the Google search sites where you want it to run.

Safari loads Gemino from this Mac app. To build the app yourself, you need Xcode.

A generated project is already in the repo. Open it and run it:

```sh
open safari/Gemino/Gemino.xcodeproj
```

In Xcode, choose the Gemino scheme and press Run. When the app opens, choose **Quit and Open Safari Extensions Preferences**, then turn Gemino on.

Rebuild the app after the extension changes:

```sh
sh scripts/build-safari.sh
```

That builds a universal Mac app in `release/Gemino.app`, signed with the configured Developer ID, while preserving the Xcode project and native code. Override `SAFARI_SIGN_IDENTITY` and `SAFARI_TEAM_ID` to use a different identity.

For normal installation outside the App Store, Safari requires **Developer ID signing and notarization**. A valid code signature alone is insufficient. Use a saved `notarytool` Keychain profile:

```sh
NOTARY_PROFILE=your-profile sh scripts/build-safari.sh
```

Alternatively, set `ASC_KEY_PATH`, `ASC_KEY_ID`, and `ASC_ISSUER_ID` to use an existing App Store Connect API key.

The script notarizes the app, staples the ticket, and verifies Gatekeeper acceptance before producing `release/gemino-0.1.0-safari-macos.zip`. Move `Gemino.app` into Applications, open it once, then enable Gemino in Safari Settings → Extensions. Without a profile, the ZIP is explicitly marked `unnotarized` and is for development only.

`scripts/package-safari.sh` regenerates the Xcode project from scratch; it replaces native app edits. Use it only when you intend to regenerate the project.

`npm test` runs the unit tests. `npm run test:e2e` loads the built extension in Chromium against saved Google pages.

## License

[MIT](LICENSE).

## Privacy

Gemino does not collect or send any data. The [privacy policy](PRIVACY.md) is the full statement.
