# Block Dash

An original one-tap rhythm-platformer (cube + ship modes, jump pads, orbs, secret coins) drawn in a flat,
classic arcade style: coloured tiled backgrounds that shift through each level, tiled ground with a white
horizon line, black blocks and spikes with white outlines, chunky outlined text and round 3D buttons.
Everything is unlocked from the start and there is a built-in **Cheats** menu.

* `BlockDash.apk` - ready-to-install Android build (debug-signed, landscape, offline). Installs over the
  earlier Neon Dash build and keeps its progress.
* `web/` - the game itself (HTML5 canvas). Open `web/index.html` in any browser to play.
* `build.sh` - rebuilds the APK without the Android SDK (`apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23`)
* `tools/validate.js` - proves every level is beatable with a search bot; `tools/startcheck.js` does the same for every "start position" cheat

## Cheats menu
God mode (no-clip), infinite jump, auto-play, hitboxes, game speed 0.25-2x, start position 0-95%,
complete every level, max stats, editable stars/orbs/diamonds/coins, per-level done/coin editor, reset.
Pause menu has Practice mode with automatic + manual checkpoints.

Controls: tap / hold anywhere (or Space / Up) to jump; hold to fly in ship mode.

Font: Lilita One by Juan Montoreano, SIL Open Font License 1.1 (`web/fonts/OFL-LICENSE.txt`).
