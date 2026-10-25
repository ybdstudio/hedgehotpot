# Source Audit & Missing-Asset Report

## Source project audit

* **Cat Pizza Tycoon source code: not available in this session.** No project files were attached, and the linked computer was offline, so the existing code could not be read. The sushi game is therefore a new, self-contained codebase. It uses the system list from the brief (joystick, 8-direction movement, customer/employee AI, currency, tasks, upgrades, expansion, save/load, UI framework), each as a separate module, so the pizza game's code can be merged in later if needed.
* **Art inputs used:** 19 uploaded PNG sheets (1536×1024, plus one 1774×887). Most are "transparent" sheets with the checkerboard painted into the pixels, or sheets on gradient or glow backgrounds. `tools/extract.py` removes these backgrounds by flood-filling from each cell border, bounded by the dark outline, and rejects bits of neighbouring sprites.

## Reusable systems (implemented as modules)

| System | File |
|---|---|
| Joystick + keyboard input | `js/input.js` |
| 8-direction character controller, nav grid, A* pathfinding, agent separation | `js/nav.js`, `js/game.js` (`Agent`) |
| Animation controller (logical anim → atlas frames, 8-dir with side fallback) | `js/assets.js` (`CST.Anim`) |
| Customer AI (ENTER → QUEUE → FIND SEAT → SIT → WAIT_FOR_SUSHI → PICK_SUSHI → EAT → PAY → LEAVE) | `js/game.js` |
| Employee AI (Chef, Cashier, Cleaner, Waiter, Manager) | `js/game.js` |
| Conveyor controller | `js/conveyor.js` |
| Economy / upgrades / unlocks / tasks / save | `js/game.js` + `js/config.js` |
| Renderer (y-sorted, iso-styled props, overlays) | `js/render.js` |
| UI framework (HUD, panels, toasts) | `js/ui.js`, `css/style.css` |
| Autoplay bot + pacing simulator | `js/bot.js`, `tools/sim.js` |

## Missing or incomplete assets (and the fallback used)

| # | Needed | What the sheets contain | Fallback in the build | Priority |
|---|---|---|---|---|
| 1 | Sushi Chef **prepare sushi** (8 dirs) | Front-only chop / cook / make-sushi strips on a noisy red/black background (cannot be cleanly cut) | Chef shows *Place on Conveyor* (8 dirs) at the loader and *Carry Sushi Tray* while walking. Station progress is shown with a progress ring | High |
| 2 | Waiter (red beret) **walk** | Walk sheet has a heavy glow background and cells that overlap | Legs-only synthesised walk from the idle frame (head and torso pixel-identical) | High |
| 3 | Waiter **idle with eyes open** | Only Rest/Sleep frames (eyes closed) | Rest frame 1 is used as idle. The waiter is almost always moving with a tray | Medium |
| 4 | Customer **angry** (8 dirs) | Angry sheet frames overlap their neighbours, so cutting them is unreliable | Red "!" emote bubble + patience bar | Medium |
| 5 | VIP 1: front-left / front-right / back diagonals | 4-direction walk and sofa sheets only | Diagonals fall back to the side view (never mirrored) | Medium |
| 6 | VIP 1 **eat / drink / dessert** | Only thumbnails in the overview sheet | Cycles the 3 sofa frames while eating | Medium |
| 7 | VIP 2 **eat sushi / dessert** | Only *drink* (front, 4 frames) at usable size | Drink animation used for all VIP 2 consumption | Low |
| 8 | Manager **walk** + diagonals | Idle "check tablet" (4 dirs × 3 frames) only | Legs-only synthesised walk; diagonals use side views | Medium |
| 9 | Manager **give instructions / activate boost** action sheets | Overview thumbnails only | "x1.5" boost bubble + toast + HUD boost timer | Low |
| 10 | Gray customer **idle / sit** | Walk + 4-dir eat/drink only | Walk frame 0 (idle) and eat frame 0 (sit) | Low |
| 11 | Cleaner **collect plates / dispose** | Sheet panels clipped by neighbouring panels | Mop animation while collecting. The plate stack is drawn by the renderer | Low |
| 12 | Cashier **checkout** at our counter prop | Checkout sprite has its own counter baked in (would double the counter) | Cashier stands behind the counter prop, with a "$" bubble while processing | Low |
| 13 | Separate shadow layers | Not provided | Renderer draws a soft ellipse shadow under every walking character | — |
| 14 | Waiter Cat with blue cap (overview sheet) | Overview thumbnails only | The red-beret cat (full 8-dir carry sheets) is the Waiter employee | — |

## Identity notes

* The **player** is the calico Waitress cat. It has the most complete sheets (idle, walk, carry, serve and collect, 8 directions × 4 frames).
* The Cashier and Cleaner use the same calico base and are told apart by outfit (pink counter apron vs blue maid dress and cap). If a fully distinct face is required, a new cashier sheet is needed (asset #12 above).
* Asymmetric characters are never mirrored. Every direction comes from its own sheet row.

## Update — second asset batch (Oct 19)

| Sheet | Now used for | Notes |
|---|---|---|
| Sushi Chef master sheet | Player + hired chefs: **idle 8 dirs (eyes open)**, empty-handed walk | Directions assigned by real facing (several sheet labels are swapped, e.g. "right" faces left). The sheet's 4×8 walk grid mixes facings inside rows, so the walk is legs-only animation of the idle pose (head/torso pixel-stable). |
| Sushi Chef – Clean / Cook / Prepare | `prepare` pose while standing at a working station, `wash` pose at the dish return | Front view only. Wash frame 3 has a background hole and is skipped (1-2-4-2 cycle). |
| Sushi Chef – Carry Tray / Place on Conveyor | Carrying sushi, loading the belt | Unchanged (already integrated). |
| Waiter Cat (red beret) – Walk 4×8 | Waiter employee walk | Now cut cleanly; carry-tray / carry-plates sheets used while carrying. The calico waitress is no longer used. |
| VIP Customer Cat 1 | Walk 8 dirs ×4, idle 8 dirs, sofa sit 8 dirs, drink 4 frames | Sheet has no right-facing views (right labels face left). Right-side views are mirrored from left-side views; VIP1 is symmetric (centred tie, crown pin on the hat front). Walk frames are small in the source (~70 px) and are upscaled, so they are softer than other characters. |
| Manager Cat – Idle (Check Tablet) | Same as before | Identical to the earlier upload. Still no walk sheet (legs-only walk). |

## Update — v3 (Oct 19)

* Chef walk now uses the dedicated "Sushi Chef Cat – Walk Animation (8 directions × 4 frames)" sheet. The legs-only stand-in has been removed. Front-left frames are scaled +8% to match the other rows.
* Walls are drawn as vector shapes (shoji, cherry-blossom panels, noren) instead of a stretched low-res texture, so they stay sharp. Props are packed at full source resolution, the chef atlas is stored at 1.3×, and the canvas renders at up to 3× device pixel ratio.
