# Hedgehog reference art

Character PNGs are the approved images supplied in the three HedgeBurger ZIPs.
The base is `HedgeBurger_character_assets_v1.1.zip`; updates are applied in order
`HedgeBurger_update_v1.1.zip`, then `HedgeBurger_update_v1.2.zip`.

Folder names match the game's logical roles. `chef` is the player, `waiter`
runs food from the kitchen, `server` serves guests. `cust_orange` and `cust_gray`
are compatibility identifiers for two different hedgehog identities, not cats.
Both may sit on either side of a dining table.

Run `python tools/build_hedgehog_assets.py` to regenerate the character atlases
and manifest. Duplicate images share one atlas rectangle. Every frame uses a
bottom-center foot pivot and the same 160-pixel height.

The supplied PNGs contain left/right walks for most NPCs, full directional idle
poses, and seated views. Missing directional walks use the correct idle view
with a small procedural step motion; kitchen/cleaning motions are procedural
overlays, rather than newly hand-drawn character sequences. Left/right seated
views are selected without mirroring asymmetric accessories.
