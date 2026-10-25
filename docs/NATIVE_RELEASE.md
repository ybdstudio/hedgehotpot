# Hedge Hotpot — TikTok native release candidate

Local branch: `native/tiktok-release`. No GitHub push, TikTok upload or review submission has been performed.

## Status

The native code is prepared and passes the supplied HS SDK checker. **This is an offline review candidate, not an upload-ready release.** The owner will supply the live IDs later. Do not upload the review draft ZIP; it contains the package folder and review files outside that folder.

- Runtime kit: **hs-game.js 3.2.4**, low-level SDK **1.1.3** from the supplied `hs-sdk-1.1.3.zip`.
- Both vendor runtime files match the supplied kit byte for byte (SHA-256 in `docs/qa/hs-sdk-1.1.3.json`).
- HS checker: **0 FAIL, 8 WARN**. The eight warnings are the empty TikTok App ID and seven placeholder ad unit IDs. HS Game ID and SDK key are also deliberately empty and checked by the release gate.
- Native browser review: **21/21 PASS** using the unmodified HS preview toolkit. Simulated credentials exist only in browser test setup, never in the packaged game. Host antivirus script requests were blocked and recorded separately; game fixtures made no requests to live services.
- Main package approximately **1.26 MB / 4 MB**; total **11.14 MB / 30 MB**.
- No HTML entry point, SDK guides, tools, test harness, dashboard JSON or emulator is inside the game folder.

## What's changed

The native build now imports canvas UI, native ad/mission code and the HS bridge instead of the web ads/minis implementations. The existing web/standalone HTML code and graphics are preserved.

All ads use HSGame; no direct TikTok ad/share/mission calls are present in game code. Timer, idle, resume, unlock and automatic phase-change ads are removed. Ad requests run synchronously from native canvas tap handlers, and pending requests block repeated taps. There are no game-owned failed-ad locks or retry loops.

Entry Reward and Launch Reward appear with step popups while supported and incomplete, and hide after SDK verification. Share is capability-gated and its reward is daily. No local shortcut/profile fallback can fabricate a completion. Mission/share/reward labels come from HS reward metadata. The existing expansion/staff Shop remains an in-game coin shop; a new paid IAP shop was not added.

SDK pause/resume freezes the fixed-step simulation and visual timers, and suspends/mutes sound. The same capability gates hide TikTok-only missions in the Android fixture.

## Saves and delivery

This is an upgrade of an existing 3.0 integration, so the game retains its **legacy `HSGame.save()`/`onLoad` style** instead of an unrelated migration to `HSGame.profile()`.

The snapshot is `Game.serialize()`: version, time, coins, stars, unlocks, upgrade levels, task/progression state, statistics, bonuses, settings, stock, dirty seats, cash piles, conveyor, held items, staged food and timestamps. Native reward fields include `hsEffects`, `hsTaskAds` and `hsLastTaskReward`.

- Full snapshots are sent through `HSGame.save()` whenever the existing game saves.
- `onGive` validates known item types, applies currency or stores/consumes earned effect tokens, then saves **in the same callback**. The returned ad result is never used to grant a second reward.
- Delivery with no active UI request keeps effect tokens in the save; they can be redeemed at a relevant reward offer without a second ad.
- `onLoad` restores the SDK-selected snapshot, rebinds the renderer/UI and saves it back unchanged. Wallets are not summed. This legacy API has no per-field profile merge configuration.
- An `otherDevice` message pauses play and offers Play here via HSGame.takeOver().

Physical-device tests for account switching, network loss, lifecycle and session takeover still need to be performed after the real configuration is available. Offline checker success is not TikTok approval.

## Reward keys and review buttons

| Key | Trigger | Default | Limit |
|---|---|---|---|
| `tiktok_shortcut` | Launch Reward → Go → SDK confirms icon launch | 80 coins + 1 star | once |
| `tiktok_profile` | Entry Reward → Go → SDK confirms profile entry | 60 coins | once |
| `share` | Share tap → SDK share completion | 50 coins | daily |

There is no manual claim button that adds these items. HSGame credits them through onGive after verification. Core restaurant task/economy rewards remain the existing gameplay loop, separate from HS entry/share/ad rewards.

## Ad moments (pacing confirmed by the owner)

| Place | Player tap | Item/effect | Dashboard cooldown |
|---|---|---|---|
| `double_task_bonus` | Extra task reward chip | `double_task`: an additional task reward; once per completed task | 30 s |
| `finish_building` | Finish building chip at an eligible pad | `finish_pad` | 30 s |
| `hedge_rush` | Hedge Rush chip | `hedge_rush` | 30 s |
| `vip_tip` | VIP bonus tip chip | `vip_tip` | 30 s |
| `free_coins` | Coin offer → Watch ad | `free_coins`: original income-based coin reward | 30 s |
| `rush_extend` | Rush continuation → Watch ad | `rush_extend` | 30 s |
| `phase_continue` | Continue - ad chip after a phase transition | interstitial, no reward | 90 s |

Interstitial eligibility starts only after three completed tasks; a phase change creates an offer and does not start an ad. It is never forced. Rewarded placements have no additional daily limit: the completed ad is the price. SDK/dashboard cooldowns govern availability. A pending ad does not accept a second tap. Stored reward redemption is labeled Use saved reward.

Items: `coins`, `stars` (currency); `double_task`, `finish_pad`, `hedge_rush`, `vip_tip`, `free_coins`, `rush_extend` (known ad effects). Unknown types are rejected. Dashboard reward amounts, names and cooldowns remain data; extra supported item kinds require code changes.

## Build and check

From the repository root:

```powershell
node tools/build_native.js dist/tiktok-native
node tools/check_native.mjs
node vendor/hs-sdk-1.1.3/web/hs-web.mjs preview dist/tiktok-native/hedgehotpot --port 8091
```

The preview is fake/offline. Without IDs the TikTok fixture runs as a guest; Android preview supplies its own fake credentials. `tests/native_release_test.cjs` injects test credentials into browser memory only to exercise TikTok login/ads/missions. Install Playwright locally or set PW/CHROMIUM to existing installations, then run:

```powershell
node tests/native_release_test.cjs http://127.0.0.1:8091/
python tools/package_native_review.py
```

Generated layout:

```
dist/tiktok-native/
  hedgehotpot/                  native game folder: game.js, game.json, project.config.json, two SDK files, ui/, res/
  hedgehotpot.hs-dashboard.json  OUTSIDE the uploaded game
  emulator/                     local test only
  HedgeHotpot_TikTok_native_review_draft.zip
```

## Complete the official release later

1. Set `native/project/project.config.json` → appid to the real TikTok App ID.
2. Copy `native/hs-config.example.json` to ignored `native/hs-config.json`. Set gameId to the registered TikTok App ID and sdkKey to the public HS SDK key. Keep the approved pacing settings. Do not put a TikTok Client Secret in source or chat.
3. Replace the seven `<AD_UNIT_ID_...>` entries in `native/hedgehotpot.hs-dashboard.json` with real ad unit IDs. Set the interstitial unit type in the HS dashboard, and import this file's iaa_config.
4. Build with release gates and the supplied packer:

```powershell
node tools/build_native.js dist/tiktok-native --release --zip
```

`--release` refuses missing IDs/key, checks Game ID/App ID match, and runs hs-check. The official packer performs its own package/security/size checks. When configured, it writes `dist/tiktok-native/hedgehotpot-tiktok.zip` with game files at ZIP root. Uploading/submitting is a separate owner action.
