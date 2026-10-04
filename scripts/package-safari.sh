#!/bin/sh
# Wraps dist/ in a macOS Safari app. Run this on a Mac with Xcode.
# Chrome and Opera keep using release/gemino-*.zip; this does not change that package.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"

if [ "$(uname)" != Darwin ]; then
  echo "package-safari: this needs macOS and Xcode (xcrun safari-web-extension-packager)." >&2
  exit 1
fi

npm run build

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -R dist/. "$stage/"

# Safari on this Xcode rejects background.type and options_ui.open_in_tab.
# The background is an extension page so the module service worker still loads.
python3 - "$stage" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
manifest = json.loads((root / "manifest.json").read_text())
manifest["background"] = {"page": "background.html"}
options = manifest.get("options_ui")
if isinstance(options, dict):
    options.pop("open_in_tab", None)
(root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(root / "background.html").write_text(
    '<!doctype html>\n<meta charset="utf-8">\n'
    '<script type="module" src="service-worker-loader.js"></script>\n'
)
PY

rm -rf safari
xcrun safari-web-extension-packager "$stage" \
  --project-location "$root/safari" \
  --app-name Gemino \
  --bundle-identifier io.frostdev.Gemino \
  --swift \
  --macos-only \
  --copy-resources \
  --no-open \
  --no-prompt \
  --force

echo
echo "Open safari/Gemino/Gemino.xcodeproj, run the Gemino scheme, then enable Gemino in Safari settings."
