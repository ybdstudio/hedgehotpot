# Native test variants

Manual baseline: `native/tiktok-release` (autoplay off, speed 1x).
Autoplay variant: `native/tiktok-autoplay-test` (bot starts automatically, speed 1x).

In the autoplay build, open Settings. Toggle Autoplay on/off, then select
Simulation speed 1x, 1.5x, 2x or 4x. Settings scroll on small phones.
The chosen speed applies to fixed simulation steps, including the bot and game
timers, while UI, sound and ad pacing use real time. SDK pause freezes the game
at every speed. Reset restaurant creates a new bot bound to the new game.
Test speed and autoplay choice reset on each launch. The autoplay device save
uses a separate key; do not configure production cloud credentials for soak tests.

Build on the autoplay branch:

    node tools/build_native.js dist/tiktok-autoplay
    node tools/check_native.mjs dist/tiktok-autoplay/hedgetasco
    python tools/package_native_test.py --package dist/tiktok-autoplay/hedgetasco --output ../HedgeTasco_TikTok_Native_Autoplay_Test.zip

The manual archive was built from the baseline before the autoplay changes.
To reproduce it, switch to `native/tiktok-release` and follow AGENTS.md.

Both archives have native entry files at ZIP root, assets in the res subpackage,
and the unchanged HS SDK 1.1.3. App ID, HS Game ID, SDK key and seven ad unit IDs
are empty. Configure them later via native/project/project.config.json,
native/hs-config.json (copy the example) and native/hedgehotpot.hs-dashboard.json.
No Client Secret belongs in this game or these archives. Ads are never automated
by the bot. These are offline test packages, not upload-ready releases.

Validation: HS checker on both packages; browser autoplay tests measure all four
simulation rates and verify pause/resume, Settings controls, reset and Android boot.
Live TikTok device validation remains pending registration.
