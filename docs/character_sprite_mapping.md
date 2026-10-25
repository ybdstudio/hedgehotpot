# Character Sprite Mapping

Direction convention (matches the source sheets and the game): `front` = facing the camera (moving down the screen), `right` = screen right, `back` = away from camera. Eight directions: front, front_right, right, back_right, back, back_left, left, front_left. 4-direction characters fall back from a diagonal to the nearest side view (never mirrored), so asymmetric markings, bags and hats are never flipped.

## Logical animation → atlas animation

| Character | Logical anim | Atlas anim | Directions | Frames |
|---|---|---|---|---|
| waiter | walk | walk | 8 | 4 |
| waiter | — | carry_plates | 8 | 4 |
| waiter | — | carry_tray | 8 | 4 |
| chef | walk, carry_idle | carry | 8 | 4 |
| chef | place | place | 8 | 4 |
| chef | idle, sleep | rest | 8 | 1 |
| chef | — | emote | 1 (front) | 8 |
| chef | cheer | emote2 | 1 (front) | 8 |
| chef | — | idle | 8 | 1 |
| chef | — | prepare | 1 | 4 |
| chef | — | wash | 1 | 4 |
| chef | — | walk | 8 | 4 |
| server | — | idle | 8 | 4 |
| server | — | carry | 8 | 4 |
| server | — | serve | 8 | 4 |
| server | — | collect | 8 | 4 |
| server | — | walk | 8 | 4 |
| cashier | — | idle_counter | 8 | 4 |
| cashier | walk | walk | 8 | 4 |
| cashier | — | checkout | 8 | 4 |
| cleaner | walk | walk | 8 | 4 |
| cleaner | wipe | mop | 8 | 4 |
| cleaner | — | wipe | 8 | 4 |
| cust_orange | idle | idle | 8 | 4 |
| cust_orange | walk | walk | 8 | 4 |
| cust_orange | sit | sit | 8 | 4 |
| cust_orange | eat | eat | 8 | 4 |
| cust_orange | happy | happy | 8 | 4 |
| cust_orange | — | counter_sit | 1 | 1 |
| cust_orange | — | counter_eat | 1 | 4 |
| cust_gray | walk | walk | 8 | 4 |
| cust_gray | eat | eat | 4 | 4 |
| cust_gray | drink | drink | 4 | 4 |
| cust_gray | — | counter_sit | 1 | 1 |
| cust_gray | — | counter_eat | 1 | 4 |
| vip1 | walk | walk | 8 | 4 |
| vip1 | sit | sit | 8 | 1 |
| vip1 | idle | idle | 8 | 1 |
| vip1 | — | drink | 1 | 4 |
| manager | idle | idle | 4 | 3 |
| manager | walk | walk | 4 | 4 |
| vip2 | idle | idle | 8 | 1 |
| vip2 | sit | sit | 8 | 1 |
| vip2 | eat | drink | 1 (front) | 4 |
| vip2 | walk | walk | 8 | 4 |

## Character master specification (identity lock)

| Character | Head / ears | Fur & markings | Tail | Clothing / accessories |
|---|---|---|---|---|
| Player – Sushi Chef Cat | large round head, tall white toque | orange with white muzzle/chest | orange, white tip | white chef coat, red fish-logo apron, red neckerchief, black trousers |
| Waiter Cat (staff, waitress sheets) | large round head, pointed ears with pink inner | calico: white face/chest, brown patch over left eye+ear, orange patch right ear | calico ringed tail | pink maid dress, white apron with cat-face pocket, frilled pink headband |
| Waiter Cat (staff) | round head, ears hidden under beret | orange with white muzzle/chest | orange, white tip | red beret with fish logo, white shirt, red apron, black trousers |
| Sushi Chef Cat | round head, tall white toque | orange with white muzzle | orange, white tip | white chef hat, white coat, red apron with fish logo, red neckerchief |
| Cleaner Cat | calico, ears through white cap | calico patches as player | calico ringed | blue maid dress, white cap with pink emblem, broom + spray bucket |
| Cashier Cat | calico | calico | calico ringed | pink dress, white apron, pink headband (works behind the counter) |
| Manager Cat | orange/white | orange with white muzzle | orange | black fedora with red band + gold crown pin, gold sunglasses, black suit, red tie, tablet |
| Customer (orange) | round head, pink inner ears | ginger with faint stripes | ginger, white tip | green jacket, brown satchel |
| Customer (gray) | round head | gray & white | gray | blue overalls, brown satchel |
| VIP 1 | tabby, ears pierce fedora | brown tabby stripes | striped tabby | black fedora + red band + crown pin, sunglasses, black suit, red tie |
| VIP 2 | cream, ears under hat | cream/white | cream | pink wide-brim hat with flower, pink dress, pearl necklace, red handbag |

Rules applied by the pipeline: one source sheet per animation family; every frame of a character is cut from that character's own sheets (never re-generated per direction); frames are scaled with one factor per character so head size never changes between animations; the shadow is drawn separately by the renderer.

## Walking animation notes

* **Player = Sushi Chef Cat.** Walking uses the 8-direction *Carry Sushi Tray* sheet (4 frames); standing uses the 8-direction *Rest* pose (front uses the neutral face from the Emotions sheet); loading the belt uses *Place on Conveyor* (8 dir); task completion plays the *victory* emotion; after 8 s idle the chef dozes (Rest + zzz).
* Cleaner, cashier, customers, VIP 1, VIP 2: 4-frame walk cycles taken directly from the sheets (customer 8-frame cycles are sampled every other frame → 4 frames).
* Waiter Cat (calico waitress sheets) and Manager: the source walk sheets were unusable (cells overlapping the neighbouring row / idle-only sheet). Their walk is synthesised **legs-only**: the lower 17% of the idle frame alternates a 5 px lift per leg (frames 2 and 4) while head and torso stay pixel-identical to the idle frame — this satisfies the "only legs move, head/torso stable" rule without inventing new art.
