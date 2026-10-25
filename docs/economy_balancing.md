# Economy Balancing Table

## Unlocks (world price pads; also purchasable from the Shop panel)

| Unlock | Phase | Cost | Appears with task | Bought at (sim median) |
|---|---|---|---|---|
| Second Stool | 1 | 40 | Earn 100 coins | 1:25 |
| Tuna Station | 2 | 90 | Unlock the second seat | 2:35 |
| Third Stool | 2 | 80 | Unlock the Tuna Station | 14:10 |
| Waiting Queue | 2 | 60 | Prepare 5 tuna sushi | 6:44 |
| Rice Station | 3 | 95 | Unlock the Rice Station | 4:13 |
| Fish Storage | 3 | 130 | Unlock Fish Storage | 4:51 |
| Hire Waiter Cat | 3 | 165 | Hire Waiter Cat (carries sushi to the belt) | 6:22 |
| Hire Cashier Cat | 3 | 195 | Hire Waiter Cat (carries sushi to the belt) | 7:36 |
| Dining Tables | 3 | 210 | Produce 10 sushi automatically | 20:59 |
| Conveyor Extension | 4 | 530 | Extend the conveyor (+3 stools) | 10:08 |
| Maki Station | 4 | 395 | Unlock Maki sushi | 11:30 |
| Hire Cleaner Cat | 4 | 370 | Hire Cleaner Cat | 12:22 |
| VIP Lounge | 5 | 705 | Unlock the VIP Lounge | 14:53 |
| Premium Kitchen | 5 | 570 | Unlock the Premium Station | 16:49 |
| Dining Room 2 | 5 | 615 | Open Dining Room 2 (more tables) | 17:58 |
| Drink Station | 6 | 660 | Unlock the Drink Station | 19:57 |
| Dessert Station | 6 | 750 | Unlock the Dessert Station | 23:59 |
| Hire Server Cat | 6 | 750 | Hire Server Cat | 25:47 |
| VIP Sofa 2 | 6 | 835 | Unlock VIP Sofa 2 | 27:17 |
| Tatami Hall | 7 | 1585 | Open the Tatami Hall | 29:24 |
| Hire 2nd Waiter Cat | 7 | 1320 | Open the Tatami Hall | — |
| Hire Manager Cat | 8 | 1935 | Hire Manager Cat | 34:07 |
| Grand Decoration | 8 | 2290 | Add the Grand Decoration | 36:38 |
| Start Grand Opening | 8 | 0 | Start the Grand Opening | 41:37 |

## Upgrades

| Upgrade | Level costs | Phase gate per level | Effect per level |
|---|---|---|---|
| Conveyor Speed | 95 / 280 / 790 / 2110 | 2 / 3 / 5 / 8 | 34 → 42 → 50 → 60 → 70 u/s |
| Conveyor Capacity | 230 / 790 / 1935 | 3 / 5 / 7 | 7 → 10 → 14 → 18 plates |
| Carry Capacity | 50 / 195 / 570 / 1320 | 2 / 3 / 5 / 7 | 4 → 6 → 8 → 10 → 12 |
| Walk Speed | 80 / 350 / 970 | 2 / 4 / 6 | 175 → 200 → 225 → 250 |
| Production Speed | 195 / 705 / 1670 | 3 / 5 / 7 | x1 → x1.3 → x1.6 → x2 |
| Cleaning Speed | 310 / 880 | 4 / 6 | 0.28 → 0.18 → 0.1 s/plate |
| Staff Training | 615 / 1495 | 6 / 7 | x1 → x1.25 → x1.5 |

## Customers & income

| Parameter | Value |
|---|---|
| Arrival interval | 7s − 0.55s × seats (min 2.4s), ×0.45 during the Grand Opening rush |
| Plates per regular customer | 2–4 |
| Eat time | 2.6s per plate |
| Patience | queue 60s, seat 45s (refills 60% after each plate) |
| Tip | +20% if first plate arrives within 12s |
| Drink / dessert add-on | 40% of customers once stations exist |
| Rating bonus | +3.5000000000000004% menu price per star (max +100%) |
| VIP 1 | wants premium, pays bill ×2 + 40, +2★ |
| VIP 2 | wants premium + dessert, pays bill ×2 + 70, +3★ |
| Manager boost | every 55s, 20s at x1.5 |
| Grand Opening rush | 150s, pay ×2, goal 15 customers |

## Simulated income (coins earned per minute, 5-minute blocks, seed 1000)

| Minutes | 0–5 | 5–10 | 10–15 | 15–20 | 20–25 | 25–30 | 30–35 |
|---|---|---|---|---|---|---|---|
| coins/min | 80 | 185 | 381 | 598 | 503 | 795 | 640 |
