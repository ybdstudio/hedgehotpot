# Progress

## 2026-10-26 — correct game branding to Hedge Tasco

- Owner confirmed exact display name: Hedge Tasco.
- Rename native/web Settings, mission instructions, share title, project metadata and exported package to Hedge Tasco / hedgetasco.
- Update loading artwork and app icon; keep restaurant art theme, gameplay, economy, ads configuration and save keys.
- Rebuild both manual and autoplay offline native archives; credentials still deferred.


## 2026-10-26 — standard native test baseline for autoplay split

Done: rebuilt the manual native test (autoplay off, speed 1x); HS checker 0 FAIL / 8 deferred-ID warnings. Exported the standard native test ZIP. Autoplay/speed controls will be isolated on native/tiktok-autoplay-test. No push.


## 2026-10-26 — native TikTok test archive, parameters deferred

Done:
- Read D:\Workspace\gamekit\GAME-RULES.md; selected highest non-Copy kit hs-sdk-1.1.3. SDK runtime, checker and guides match the previously supplied kit byte-for-byte.
- Rebuilt native package at dist/tiktok-test/hedgehotpot. Main 1.26 MB, total 11.14 MB before compression.
- HS checker: 0 FAIL / 8 WARN (App ID and seven ad IDs missing). HS Game ID/SDK key intentionally empty, as requested.
- Exported HedgeHotpot_TikTok_Native_Test.zip in the parent workspace: 40 native files at ZIP root, 10.67 MB. ZIP CRC/layout and SDK hashes verified. No HTML, dashboard, emulator or kit tools inside.
- Added project rule pointers and a reproducible package_native_test.py command. No gameplay changes, upload or GitHub push.

Deferred:
- Real TikTok App ID is required for actual upload. HS Game ID/SDK key and ad unit IDs will be supplied later.
- Official release packing, device tests and submission remain pending configuration. Do not mark this offline test archive upload-ready.

Next:
- Apply the supplied parameters, run HS checks, then use the official --release --zip pipeline. Push only if explicitly requested.
