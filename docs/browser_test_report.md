# Browser Test Report

* Executed: 2026-10-19T06:38:38.685Z
* Browser: Chromium (Playwright), device emulation **iPhone 13 (Chromium emulation)**, 390×844 CSS px @3x, touch enabled
* Method: the real game ran in the page. Long stretches were fast-forwarded *inside the page* by stepping the same `game.update()` the render loop uses, driven by the autoplay bot through the joystick API. Screenshots were taken from the live canvas.
* Result: **14/14 checks passed**, page errors: 0

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Game starts without a blank screen | PASS | canvas pixel std-dev 121.3, page errors 0 |
| 2 | Characters render correctly in all directions | PASS | 950 frames, 0 missing, 274/274 direction sets populated (see sprite_sheet_check.png) |
| 3 | Walking animations preserve proportions | PASS | max frame-height variation inside one walk cycle 11.7% (cashier.back_right) |
| 4 | Conveyor plates move continuously | PASS | 7/7 plates advanced over 1 s at 34 u/s |
| 5 | Customers take the correct sushi | PASS | 832 pickups verified, 0 wrong |
| 6 | Plates are not duplicated | PASS | duplicate-id samples 0, over-capacity samples 0 |
| 7 | Customers complete the payment cycle | PASS | 33 customers paid, 956 coins earned |
| 8 | Cleaner clears dirty seats | PASS | dirty plates 23→23, cleaner collected 18 plates in 40 s with the player idle |
| 9 | Employees perform assigned tasks | PASS | staff chef, cashier, cleaner, waiter, manager; chef loaded 572 plates, 715 plates cleaned, waiter served 68 |
| 10 | Upgrades apply correctly | PASS | beltSpeed Lv2: 42→50; beltCap Lv1: 7→10; carry Lv2: 6→8; move Lv2: 200→225; prod Lv1: 1.35→1.7550000000000001; clean Lv1: -0.28→-0.18 |
| 11 | Expansion unlocks in order | PASS | 14 future unlocks could not be bought early (bought 0); pad order monotonic: true |
| 12 | VIP customers use correct sofas and animations | PASS | 5 VIP seatings, 0 on a wrong sofa; sofa frames {"vip1":"vip1.sit.front.0","vip2":"vip2.sit.front.0"}; served VIP1 3, VIP2 2 |
| 13 | Save/load works | PASS | before {"coins":1264,"task":35,"unlocked":23,"stars":74} → after reload {"coins":1264,"task":35,"unlocked":23,"stars":74,"staff":5} |
| 14 | Grand Opening milestone is reachable | PASS | completed=true at game time 36:44 (task 35) |

Screenshots: `tests/out/*.png` (start, each phase, the Grand Opening, every UI panel, and the sprite sheet check).

## Headless pacing simulation (Node, same game code)

6 seeds; 6 reached the Grand Opening; completion 39m, 45m, 43m, 41m, 44m, 39m. Duplicate-plate or over-capacity violations: 0.

## Not covered by automation

* Real iPhone Safari / iPhone Chrome and Android Chrome hardware were **not** tested. Only Chromium mobile emulation was used. Things to check on real devices: safe-area insets, audio unlock after the first tap, and frame rate on older phones.
* The playtime estimate comes from a bot that plays reasonably well. A first-time human player may be slower early on, while learning the loop, and faster later, by multitasking better.
