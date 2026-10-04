#!/bin/sh
# Build a universal Developer ID release. Use NOTARY_PROFILE or ASC_KEY_* to notarize.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"
if [ "$(uname)" != Darwin ]; then
  echo "build-safari: macOS and Xcode are required." >&2
  exit 1
fi

identity=${SAFARI_SIGN_IDENTITY:-Developer ID Application: James Kueller (22AAZFMTV8)}
team=${SAFARI_TEAM_ID:-22AAZFMTV8}
version=$(node -p 'JSON.parse(require("fs").readFileSync("package.json", "utf8")).version')
npm run build

# Preserve the checked-in project's native code and any local Xcode edits.
stage=$(mktemp -d)
cleanup() {
  # Xcode registers build products; remove the temporary copy from Safari's list.
  if [ -n "${app:-}" ] && [ -d "$app" ]; then
    pluginkit -r "$app/Contents/PlugIns/Gemino Extension.appex" >/dev/null 2>&1 || true
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
      -u "$app" >/dev/null 2>&1 || true
  fi
  rm -rf "$stage"
}
trap cleanup EXIT
app="$stage/DerivedData/Build/Products/Release/Gemino.app"
cp -R safari/Gemino "$stage/Gemino"
python3 - "$stage" <<'PY'
import json, shutil, sys
from pathlib import Path
resources = Path(sys.argv[1]) / 'Gemino/Gemino Extension/Resources'
shutil.rmtree(resources)
shutil.copytree('dist', resources)
manifest = json.loads((resources / 'manifest.json').read_text())
manifest['background'] = {'page': 'background.html'}
manifest.get('options_ui', {}).pop('open_in_tab', None)
(resources / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(resources / 'background.html').write_text(
    '<!doctype html>\n<meta charset="utf-8">\n'
    '<script type="module" src="service-worker-loader.js"></script>\n'
)
PY

mkdir -p release
if ! xcodebuild -project "$stage/Gemino/Gemino.xcodeproj" \
  -scheme Gemino -configuration Release -derivedDataPath "$stage/DerivedData" \
  -destination 'generic/platform=macOS' \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$identity" DEVELOPMENT_TEAM="$team" \
  CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO \
  'CODE_SIGN_ENTITLEMENTS=$(SRCROOT)/$(TARGET_NAME)/Release.entitlements' \
  'ARCHS=arm64 x86_64' ONLY_ACTIVE_ARCH=NO MACOSX_DEPLOYMENT_TARGET=12.0 \
  MARKETING_VERSION="$version" build > release/safari-build.log 2>&1; then
  tail -n 60 release/safari-build.log >&2
  exit 1
fi

extension="$app/Contents/PlugIns/Gemino Extension.appex"
for bundle in "$extension" "$app"; do
  codesign --force --sign "$identity" --timestamp --options runtime \
    --preserve-metadata=identifier,entitlements,requirements,flags "$bundle"
done
codesign --verify --deep --strict --verbose=2 "$app"

# Prevent a debug entitlement from silently entering a release again.
for bundle in "$extension" "$app"; do
  codesign -d --entitlements - --xml "$bundle" > "$stage/entitlements.plist" 2>/dev/null
  python3 - "$stage/entitlements.plist" <<'PY'
import plistlib, sys
with open(sys.argv[1], 'rb') as f:
    entitlements = plistlib.load(f)
if entitlements.get('com.apple.security.get-task-allow'):
    sys.exit('build-safari: debug entitlement found in release')
if not entitlements.get('com.apple.security.app-sandbox'):
    sys.exit('build-safari: Safari app and extension must be sandboxed')
PY
done

archive="$stage/gemino-safari.zip"
ditto -c -k --sequesterRsrc --keepParent "$app" "$archive"
if [ -n "${NOTARY_PROFILE:-}" ]; then
  xcrun notarytool submit "$archive" --keychain-profile "$NOTARY_PROFILE" \
    --wait --output-format json > release/safari-notarization.json
elif [ -n "${ASC_KEY_PATH:-}" ]; then
  : "${ASC_KEY_ID:?ASC_KEY_ID is required with ASC_KEY_PATH}"
  : "${ASC_ISSUER_ID:?ASC_ISSUER_ID is required with ASC_KEY_PATH}"
  xcrun notarytool submit "$archive" --key "$ASC_KEY_PATH" \
    --key-id "$ASC_KEY_ID" --issuer "$ASC_ISSUER_ID" \
    --wait --output-format json > release/safari-notarization.json
fi
if [ -n "${NOTARY_PROFILE:-}${ASC_KEY_PATH:-}" ]; then
  python3 - <<'PY'
import json, sys
result = json.load(open('release/safari-notarization.json'))
if result.get('status') != 'Accepted':
    sys.exit('build-safari: notarization was not accepted; see release/safari-notarization.json')
PY
  xcrun stapler staple "$app"
  xcrun stapler validate "$app"
  spctl --assess --type execute --verbose=4 "$app"
  output="release/gemino-$version-safari-macos.zip"
else
  output="release/gemino-$version-safari-macos-unnotarized.zip"
  echo "Signed only: Safari requires notarization for normal installation."
  echo "Set NOTARY_PROFILE to a saved notarytool Keychain profile and rerun."
fi

# Replace only the generated release app, after all requested checks pass.
rm -rf release/Gemino.app
ditto "$app" release/Gemino.app
ditto -c -k --sequesterRsrc --keepParent release/Gemino.app "$output"
echo "Built release/Gemino.app and $output"
