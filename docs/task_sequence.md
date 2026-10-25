# Task Sequence

One primary task is shown at a time (task card + bouncing arrow over the target; an edge arrow appears when the target is off-screen). Bonus tasks run in parallel.

| # | Phase | Objective | Completion condition | Reward | Unlock dependency | Sim median |
|---|---|---|---|---|---|---|
| 1 | 1 | Pick up 3 salmon from the crate | stat `ingPicked` +3 | 10 coins | — | 0:01 |
| 2 | 1 | Prepare 3 salmon sushi | stat `made_salmon` +3 | 10 coins | task 1 | 0:09 |
| 3 | 1 | Place 3 plates on the conveyor | stat `beltLoaded` +3 | 10 coins | task 2 | 0:16 |
| 4 | 1 | Serve 3 customers (take payment at the register) | stat `paid` +3 | 15 coins + 1★ | task 3 | 1:22 |
| 5 | 1 | Earn 100 coins | stat `earned` +100 | 1★ | task 4 | 2:30 |
| 6 | 2 | Unlock the second seat | unlock `seat_a2` | 20 coins | task 5 | 2:30 |
| 7 | 2 | Unlock the Tuna Station | unlock `st_tuna` | 20 coins | task 6 | 2:35 |
| 8 | 2 | Prepare 5 tuna sushi | stat `made_tuna` +5 | 30 coins + 1★ | task 7 | 3:28 |
| 9 | 2 | Upgrade conveyor speed | upgrade `beltSpeed` ≥ Lv 1 | 30 coins | task 8 | 3:42 |
| 10 | 3 | Unlock the Rice Station | unlock `rice` | 40 coins | task 9 | 4:13 |
| 11 | 3 | Unlock Fish Storage | unlock `storage` | 40 coins | task 10 | 4:51 |
| 12 | 3 | Hire Waiter Cat (carries sushi to the belt) | unlock `chef` | 50 coins + 1★ | task 11 | 6:22 |
| 13 | 3 | Produce 10 sushi automatically | stat `chefLoaded` +10 | 60 coins | task 12 | 7:20 |
| 14 | 3 | Hire Cashier Cat | unlock `cashier` | 60 coins | task 13 | 7:36 |
| 15 | 4 | Extend the conveyor (+3 stools) | unlock `belt_b` | 60 coins + 1★ | task 14 | 10:08 |
| 16 | 4 | Unlock Maki sushi | unlock `st_maki` | 60 coins | task 15 | 11:30 |
| 17 | 4 | Hire Cleaner Cat | unlock `cleaner` | 60 coins | task 16 | 12:22 |
| 18 | 4 | Clean 5 dirty plates | stat `cleaned` +5 | 60 coins + 1★ | task 17 | 12:37 |
| 19 | 5 | Unlock the VIP Lounge | unlock `vip_lounge` | 80 coins | task 18 | 14:53 |
| 20 | 5 | Unlock the Premium Station | unlock `st_premium` | 80 coins | task 19 | 16:49 |
| 21 | 5 | Serve VIP Customer 1 (bring Premium Ikura) | stat `vip1Served` +1 | 120 coins + 2★ | task 20 | 17:20 |
| 22 | 5 | Open Dining Room 2 (more tables) | unlock `seats_a67` | 100 coins | task 21 | 17:58 |
| 23 | 6 | Unlock the Drink Station | unlock `st_drink` | 100 coins | task 22 | 19:57 |
| 24 | 6 | Serve 5 drinks | stat `drinksServed` +5 | 120 coins + 1★ | task 23 | 23:44 |
| 25 | 6 | Unlock the Dessert Station | unlock `st_dessert` | 120 coins | task 24 | 23:59 |
| 26 | 6 | Hire Server Cat | unlock `waiter` | 120 coins | task 25 | 25:47 |
| 27 | 6 | Unlock VIP Sofa 2 | unlock `vip_sofa2` | 150 coins | task 26 | 27:17 |
| 28 | 6 | Serve VIP Customer 2 | stat `vip2Served` +1 | 200 coins + 2★ | task 27 | 28:00 |
| 29 | 7 | Open the Tatami Hall | unlock `hall` | 200 coins + 1★ | task 28 | 29:24 |
| 30 | 7 | Upgrade conveyor capacity (Lv 2) | upgrade `beltCap` ≥ Lv 2 | 200 coins | task 29 | 30:01 |
| 31 | 8 | Hire Manager Cat | unlock `manager` | 250 coins + 2★ | task 30 | 34:07 |
| 32 | 8 | Add the Grand Decoration | unlock `final_decor` | 250 coins | task 31 | 36:38 |
| 33 | 8 | Final conveyor upgrade (max speed) | upgrade `beltSpeed` ≥ Lv 4 | 300 coins + 2★ | task 32 | 41:26 |
| 34 | 8 | Start the Grand Opening | unlock `grand_open` | — | task 33 | 41:37 |
| 35 | 8 | Grand Opening: serve 15 customers in the rush | stat `rushServed` +15 | 1000 coins + 10★ | task 34 | 42:49 |

## Bonus tasks (parallel)

| Bonus | Goal | Reward |
|---|---|---|
| Serve 10 happy customers | happy +10 | 40 coins + 1★ |
| Load 30 plates on conveyors | beltLoadedAll +30 | 60 coins |
| Clean 20 dirty plates | cleaned +20 | 80 coins + 1★ |
| Earn 2,000 coins | earned +2000 | 2★ |
| Serve 40 customers | paid +40 | 300 coins + 2★ |
