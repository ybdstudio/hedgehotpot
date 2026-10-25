# Meow Sushi – one source for Web + TikTok native

Both builds come from this folder. `js/` is shared code (game logic, render, ads, minis). The web build adds
`index.html`, `css/`, `js/ui.js`, `js/input.js`, `js/main.js`. The native build adds `native/`.

```
native/src/adapter.js        tt.* -> browser globals shim (canvas, storage, touch, onShow/onHide)
native/src/uiart_files.js    UI art file list for the native package
native/src/ui_native.js      canvas UI (HUD, nav, panels, popups, toasts, test-ad overlay)
native/src/minis_native.js   canvas popups for Home screen / Revisit / Share / Free coins / Rush
native/src/main_native.js    boot: loading screen -> subpackage 'res' -> game loop + touch joystick
native/project/              game.json, project.config.json, nav/upgrade PNG icons, res/game.js stub
native/emulator.html         desktop tt.* emulator (not uploaded)
tools/build_native.js        builds dist/meow-hotpot (upload) + dist/emulator
tools/native_test.js         headless test of the native build (16 checks)
```

## Everyday loop
```
node tools/build_native.js                       # -> dist/meow-hotpot, size check vs 4 MB / 30 MB
python3 -m http.server 8000 -d dist              # play: http://localhost:8000/emulator/index.html?fakeads=1
node tools/native_test.js                        # native checks (Playwright)
python3 -m http.server 8765 & node tests/browser_test.js http://localhost:8765/   # web: 14 checks
```
Emulator URL flags: `?fakeads=1` fake TikTok ad SDK · no flag = test-ad overlay · `?noads=1` = client without ad SDK.
In the console: `APP.setAutoplay(true); APP.speed = 8` (bot plays), `__game` = game state, `CST.Ads.events` = ad log.

## Release build
```
node tools/build_native.js --appid <APP_ID> --rewarded <REWARDED_ID> --interstitial <INTER_ID> --zip
cd dist/meow-hotpot && ttmg dev                   # needs: npm i -g @ttmg/cli, ttmg login, Node >= 20
```

## Changes vs the first native package
- Ads: on a client with no ad SDK the native build no longer shows the fake test-ad overlay (which granted rewards
  without a real ad); ad offers are switched off instead. The emulator keeps the overlay for testing.
- Source recovered: the build is reproducible from this folder (verified byte-identical to the shipped game.js
  before the change above).

## Fixes from the first TikTok device test (iOS)
- Game froze after the first sound: TikTok's WebAudio gain has no `setValueAtTime`, the TypeError was thrown inside the
  requestAnimationFrame callback and the loop stopped rescheduling. `js/audio.js` now falls back to `.value` and never
  throws; `main_native.js` schedules the next frame first and catches frame errors (logged as `[frame]`, max 5).
- HUD pushed a third of the way down: safe-area / capsule values were used unchecked (device reported ~252 px).
  `adapter.js` now converts physical-px values, clamps the top inset to 15 % of the screen and logs `[safe] {...}` at boot.
  If the HUD still sits wrong on a device, copy that `[safe]` line from vConsole.
- Emulator `?ttquirks=1` reproduces both quirks; `tools/native_test.js` covers them (19 checks).

## Ads: HS TikTok SDK (hs-game.js 3.0.0 + hs-tiktok-sdk 1.0.7)
- Files: `native/hs-sdk/` (copied next to game.js in the package, do not edit), `native/hs-config.json` (gameId, sdkKey,
  slot -> dashboard label), `native/meow-hotpot.hs-dashboard.json` (placements + reward defaults; the build injects the
  defaults into game.js and copies the file next to the package for hs-check). Bridge: `native/src/hs_native.js`.
- Slot -> place: R1 "Double Task Bonus" · R2 "Buying Pad" · R3 "Meow Rush" · R4 "VIP tip" · R5 "Coin Purchase" ·
  R6 "Grand Opening" · every interstitial (I1-I6) "Inter1". Labels are matched exactly (case and spaces).
- The game keeps its pacing (cooldowns, caps, not while carrying); an offer only appears when HSGame.canShowAd(label).
- Rewards: each rewarded place gives one `ad_effect` item; onGive runs that placement's effect (sized to the economy).
  `coins` / `stars` (category currency) are fixed extras ops can add on the dashboard without a build.
- HSGame logs in (the game no longer calls tt.login). Share / home screen / revisit still use the TikTok API directly.
- Check: `node tools/build_native.js && node tools/hs/hs-check.mjs dist/meow-hotpot` (0 fail; the "capitals" warnings are
  expected because the dashboard labels have capitals; "calls TikTok directly" = share / missions).
- Emulator: `?fakeads=1&hsfake=1` = fake TikTok ads + fake HS backend serving the dashboard JSON.

## Round 3 (device feedback)
- Bottom UI compact: nav buttons 72 % height (max 56 px), task card 50 px single line, smaller bonus pill (~60 px more map).
- Settings: Sound / Vibration could not be switched back on (grey 'off' buttons had no tap area) -> style 'toggleOff'.
- Loading art: native/project/ui/loading.webp is a 2x EDSR super-resolution of the 720 px original (+ light sharpen),
  drawn with imageSmoothingQuality 'high'. A higher-resolution original would still be better.
- Ad timing (js/config.js ADS, real seconds of unpaused play): first interstitial after 60 s and task 3 (was 120 s /
  task 5), interstitial cooldown 60 s (was 75), 40 s after a rewarded ad (was 45), idle fallback 120 s (was 150),
  resume-after 120 s (was 180); Free Coins from 30 s (was 60), every 240 s (was 300); Meow Rush offer from 30 s (was 60).
