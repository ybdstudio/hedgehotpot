## 2026-10-31 — Main includes manual native game and promotional assets

Owner requested moving the work into main. Main now includes native/tiktok-release plus all icon and special-effect artwork from 716fbb3. Autoplay and speed controls remain isolated on native/tiktok-autoplay-test. No gameplay changes in this integration.

## 2026-10-30 — Restore Hedge Hotpot branding

Owner requested Hedge Hotpot everywhere: display strings, share/mission text, project metadata, package folder, packaging scripts, docs and original icon/loading artwork. Save identifiers preserved. Rebuilt native test ZIP; credentials deferred.

# Progress

## 2026-10-29 — connect to new GitHub repository

- Origin now points exclusively to https://github.com/ybdstudio/hedgehotpot.git. Old origin and remote-tracking refs removed.
- Push manual/autoplay branches to the new repo; leave its existing main intact.
- Updated active repository references in README and AGENTS. Game code unchanged.


## 2026-10-26 — correct game branding to Hedge Hotpot

- Owner confirmed exact display name: Hedge Hotpot.
- Rename native/web Settings, mission instructions, share title, project metadata and exported package to Hedge Hotpot / hedgehotpot.
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
