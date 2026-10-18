#!/usr/bin/env bash
# Builds BlockDash.apk without the Android SDK: needs aapt, dalvik-exchange, zipalign, apksigner,
# android-sdk-platform-23 and a JDK  (apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23)
set -euo pipefail
cd "$(dirname "$0")"
ANDROID_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
OUT=build
rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/assets"
cp -r web/. "$OUT/assets/"

aapt package -f -M android/AndroidManifest.xml -S android/res -A "$OUT/assets" -I "$ANDROID_JAR" \
  --min-sdk-version 21 --target-sdk-version 30 --version-code 2 --version-name 2.0 -F "$OUT/unsigned.apk"

javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d "$OUT/classes" android/src/com/neondash/game/*.java 2>&1 | grep -v '^Note:\|warning:' || true
dalvik-exchange --dex --output="$OUT/classes.dex" "$OUT/classes"
( cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null )

zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
[ -f android/debug.keystore ] || keytool -genkeypair -keystore android/debug.keystore -storepass android -keypass android \
  -alias neondash -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Block Dash, O=Block Dash, C=US" 2>/dev/null
apksigner sign --ks android/debug.keystore --ks-pass pass:android --key-pass pass:android --out BlockDash.apk "$OUT/aligned.apk"
apksigner verify --verbose BlockDash.apk | head -5
ls -l BlockDash.apk
