#!/usr/bin/env bash
#
# Builds the Android APK from the vendored wallet at vendor/paradym-wallet.
#
# Four things are load-bearing and none of them fails with a message that names
# the cause, so each is an assertion here rather than a paragraph in a runbook:
# a JDK 17 exactly, ANDROID_HOME, APP_VARIANT, and the issuer URL the wallet's
# directory screen is built from.
#
#   ./scripts/build-wallet.sh                 # issuer URL from deploy/.env
#   ./scripts/build-wallet.sh --issuer https://host
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
WALLET="vendor/paradym-wallet"
APP="$WALLET/apps/wallet"

ISSUER="${CREDENTIAL_ISSUER_URLS:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --issuer) ISSUER="$2"; shift 2 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

die() { printf '\n  %s\n\n' "$1" >&2; exit 1; }

[ -d "$APP" ] || die "no vendored wallet at $APP — run ./scripts/vendor-wallet.sh"

# A JDK 17 EXACTLY. On 21 or 23 the React Native gradle plugin's jvmToolchain(17)
# makes Gradle try to provision one through the foojay-resolver 0.5.0 it pins,
# which touches an API removed in Gradle 9. The build then dies with
# "JvmVendorSpec ... IBM_SEMERU", which says nothing about JDK versions at all.
is_17() { [ -x "$1/bin/java" ] && "$1/bin/java" -version 2>&1 | head -1 | grep -q '"17'; }

# A shell whose JAVA_HOME points elsewhere is the normal case here — sdkman sets
# it to 11 — so look for a 17 rather than refusing outright, and say which one is
# being used. Only give up when the machine genuinely has none.
if [ -n "${JAVA_HOME:-}" ] && is_17 "$JAVA_HOME"; then
  :
else
  FOUND=""
  for cand in /opt/homebrew/opt/openjdk@17 "$(/usr/libexec/java_home -v 17 2>/dev/null || true)" \
              "$HOME/.sdkman/candidates/java"/17.*; do
    [ -n "$cand" ] && is_17 "$cand" && { FOUND="$cand"; break; }
  done
  [ -n "$FOUND" ] || die "no JDK 17 found. The React Native gradle plugin declares
  jvmToolchain(17); on an older JDK Gradle refuses outright, and on 21 or 23 it
  tries to provision a 17 through the foojay-resolver 0.5.0 it pins and dies with
  'JvmVendorSpec ... IBM_SEMERU', which names neither Java nor a version.
  Install one (brew install --cask temurin@17) or set JAVA_HOME."
  [ -n "${JAVA_HOME:-}" ] && printf '  note: JAVA_HOME was not a JDK 17; using %s\n' "$FOUND"
  JAVA_HOME="$FOUND"
fi
JV="$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"

# expo prebuild does not write android/local.properties, so without this the
# build stops at "SDK location not found".
if [ -z "${ANDROID_HOME:-}" ] && [ -d /opt/homebrew/share/android-commandlinetools ]; then
  ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
fi
[ -n "${ANDROID_HOME:-}" ] || die "set ANDROID_HOME to your Android SDK"
[ -x "$ANDROID_HOME/platform-tools/adb" ] || die "no platform-tools under $ANDROID_HOME"

# Empty hides the issuer directory entirely — the screen the demo opens on.
if [ -z "$ISSUER" ] && [ -f deploy/.env ]; then
  ISSUER="$(grep '^PUBLIC_URL=' deploy/.env | cut -d= -f2- || true)"
fi
[ -n "$ISSUER" ] || die "no issuer URL: pass --issuer, or run scripts/bootstrap.sh so deploy/.env has PUBLIC_URL"

export JAVA_HOME ANDROID_HOME
export PATH="$JAVA_HOME/bin:$PATH"
# Decides the package name. Without it the namespace becomes id.paradym.wallet
# while the generated autolinking sources still reference id.paradym.wallet.preview,
# and the build fails in javac with "package does not exist".
export APP_VARIANT=preview
export CREDENTIAL_ISSUER_URLS="$ISSUER"
# Falls back to the app scheme, which needs no App Link verification — the right
# choice against a demo host whose assetlinks.json cannot list a locally signed
# certificate.
export WALLET_REDIRECT_BASE_URLS=""

printf 'building the wallet\n  jdk     %s\n  sdk     %s\n  issuer  %s\n  variant %s\n\n' \
  "$JV" "$ANDROID_HOME" "$CREDENTIAL_ISSUER_URLS" "$APP_VARIANT"

[ -d "$APP/node_modules" ] || die "dependencies are not installed. Run:
  cd $WALLET && corepack pnpm install --frozen-lockfile"

( cd "$APP" && npx expo prebuild --platform android --no-install )
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$APP/android/local.properties"
# One ABI on purpose: the generated gradle.properties builds all four, which
# compiles every native module four times. That is how the first attempt spent
# two hours and fourteen minutes before dying in Skia's JNI compile.
( cd "$APP/android" && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a )

APK="$APP/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || die "gradle reported success but produced no APK at $APK"
printf '\n  %s\n  %s bytes\n\n  install it with:\n    adb install -r %s\n\n' \
  "$APK" "$(wc -c < "$APK" | tr -d ' ')" "$APK"
