# Sushi & Conveyor Asset Mapping

| Recipe | Icon (props key) | Plate | Price | Prep (s) | Ingredient (cost) | Served via |
|---|---|---|---|---|---|---|
| Salmon Nigiri (`salmon`) | f_salmon | c_plate_blue | 6 | 2.6 | Salmon (1) | conveyor belt |
| Tuna Nigiri (`tuna`) | f_tuna | c_plate_pink | 9 | 3 | Tuna (2) | conveyor belt |
| Maki Roll (`maki`) | f_maki | c_plate_green | 14 | 3.4 | Cucumber & Nori (3) | conveyor belt |
| Premium Ikura (`premium`) | f_premium | c_plate_yellow | 50 | 4.5 | Ikura (8) | hand-served (player / Waiter) |
| Matcha Drink (`drink`) | dr_matcha | — | 12 | 2 | none | hand-served (player / Waiter) |
| Mochi Dessert (`dessert`) | d_mochi | — | 16 | 2.8 | none | hand-served (player / Waiter) |

Plate colour encodes the recipe (classic kaiten-zushi colour coding), so players can read the belt at a glance.

## Plate entity

Every plate object carries: `id` (unique), `recipe`, `price`, `s` (conveyor path position, arc-length), `speed`, occupied space (`BELT.gap` = 30 units) and `state` ∈ PREPARING, READY, ON_CONVEYOR, TAKEN, CONSUMED, DIRTY, CLEANED.

## Conveyor

* One small stadium loop in front of the kitchen (Cat Pizza style iso view); arc radius 26; capacity by level 7 / 10 / 14 / 18 plates.
* Phase 4 "Conveyor Extension" lengthens the loop (x 188–375 → 150–425) and adds 3 stools; plates already on the belt are remapped proportionally.
* Stool customers take plates from the belt; table customers order from the menu and are served by hand (player chef or Waiter Cat).
* Speed by level: 34 / 42 / 50 / 60 / 70 units/s.
* Loading: the LOAD point has a 6-plate staging tray. Plates enter the belt only when the loader slot is clear by ≥ 30 units and the belt is below capacity; otherwise they wait (production also waits when a station's 6-plate output is full).
* Pickup: each seat has a pickup parameter (closest point on its belt). When a plate crosses it and the seated customer is WAIT_FOR_SUSHI and wants that recipe, the plate is spliced out of the belt array and assigned to that customer in the same step → a plate can never be taken twice (checked every 2 s by the simulator: 0 duplicates).

## Environment props used

Stations: st_salmon, st_tuna, st_rice, st_maki, st_premium, st_dessert, st_drink, st_storage, st_sink. Crates: c_box_salmon, c_box_fish, c_box_veg, c_box_rice. Seating: stool_round (belt stools), table_long + stool (2-seat dining tables), armchair, armchair2 (VIP sofas). Decor: wall, floor_*, lanterns, banners, plants, maneki, chalkboard, sakura_tree, koi, gate, stall, bench_red.
