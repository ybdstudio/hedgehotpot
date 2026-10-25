# 40-Minute Progression Configuration

Source of truth: `js/config.js` (`TASKS`, `UNLOCKS`, `UPGRADES`, `PHASE_NAMES`). Times below are **simulated** (autoplay bot driving the real game logic, `node tools/sim.js`) — a balancing estimate, not a measured player KPI.

| Phase | Name | Target window | Simulated start (median) | Unlocks |
|---|---|---|---|---|
| 1 | First Sushi Counter | 0–5 min | 0:00 | Second Stool |
| 2 | First Expansion | 5–10 min | 2:30 | Tuna Station, Third Stool, Waiting Queue |
| 3 | Kitchen Automation | 10–15 min | 3:42 | Rice Station, Fish Storage, Hire Waiter Cat, Hire Cashier Cat, Dining Tables |
| 4 | Conveyor Expansion | 15–20 min | 7:36 | Conveyor Extension, Maki Station, Hire Cleaner Cat |
| 5 | VIP Lounge | 20–25 min | 12:37 | VIP Lounge, Premium Kitchen, Dining Room 2 |
| 6 | Drinks & Dessert | 25–30 min | 17:58 | Drink Station, Dessert Station, Hire Server Cat, VIP Sofa 2 |
| 7 | Restaurant Expansion | 30–35 min | 28:00 | Tatami Hall, Hire 2nd Waiter Cat |
| 8 | Grand Opening | 35–40 min | 30:01 | Hire Manager Cat, Grand Decoration, Start Grand Opening |

Simulation: 6 seeds, 6/6 completed the Grand Opening. Completion time median **42:49** (range 38:33 – 45:12). Average gap between purchases 67 s, longest gap 253 s. Duplicate-plate / over-capacity violations: 0.
