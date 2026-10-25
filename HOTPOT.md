# Meow Hotpot Conveyor (branch `feature/hotpot-reskin`)

Reskin of Meow Sushi Conveyor into a hot pot conveyor restaurant. Same game logic, tasks, economy and cat characters.

## What changed
- Menu: Sliced Beef, Shrimp & Fish Balls, Veggies & Mushrooms, Wagyu Platter, Kumquat Tea, Three-Color Che; tasks/zones renamed; own save key `cat_hotpot_tycoon_v1`.
- Art (ChatGPT, round 1): prep counters (4 states), chef cats, dishes with their own plates, carried ingredients, crates, broth station, cold storage, drink/dessert counters, decor, key art, app icon. Pipeline: `tools/hotpot_art/split_sheets.py` (cut sheets, remove background) → `tools/hotpot_art/build_from_chatgpt.py` (fit into the sushi atlas frames).
- Code: mini hot pot on the bar for every seated guest and in the middle of occupied tables (`hp_pot`), red carpet Hotpot Hall, Chinese-style walls (lattice windows, red lacquer paw medallions, lanterns).

## Still to do
- Round-2 art (`art_requests/round2/PROMPTS_ROUND2.md`): dining-table frames, chef carry/place frames, empty beef counter.
- TikTok popup art (Add to Home / Revisit / Share) still shows the sushi version (native build only).
