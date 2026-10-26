/* Hedge Tasco — data-driven configuration (economy, layout, progression).
   Everything tunable lives here; tools/sim.js runs the real game logic against this file. */
(function (root) {
  const CST = root.CST = root.CST || {};

  const C = CST.CONFIG = {
    VERSION: 1,
    SAVE_KEY: 'cat_hotpot_tycoon_v1',
    WORLD: { W: 720, H: 640, CELL: 10 },
    VIEW_W: 450,                  // screen units visible horizontally on a phone
    START_COINS: 30,

    PLAYER: { speed: [175, 200, 225, 250], carry: [4, 6, 8, 10, 12], radius: 9 },
    STAFF: { speed: 145, carry: 6, sleepMin: 50, sleepMax: 80 },   /* waiter cats doze off after 50-80 s of work; walk past to wake them */
    INTERACT_R: 46,

    // ---------------- recipes ----------------
    RECIPES: {
      salmon:  { name: 'Sliced Beef', icon: 'f_salmon',  plate: 'c_plate_pink',   ownPlate: true, price: 6,  prep: 2.6, ing: 'salmon',  belt: true },
      tuna:    { name: 'Shrimp & Fish Balls',   icon: 'f_tuna',    plate: 'c_plate_blue',   ownPlate: true, price: 9,  prep: 3.0, ing: 'tuna',    belt: true },
      maki:    { name: 'Veggies & Mushrooms',     icon: 'f_maki',    plate: 'c_plate_green',  ownPlate: true, price: 14, prep: 3.4, ing: 'veg',     belt: true },
      premium: { name: 'Wagyu Platter', icon: 'f_premium', plate: 'c_plate_yellow', ownPlate: true, price: 50, prep: 4.5, ing: 'ikura',   belt: false },
      drink:   { name: 'Kumquat Tea',  icon: 'dr_matcha', plate: null,             price: 12, prep: 2.0, ing: null,      belt: false },
      dessert: { name: 'Three-Color Che', icon: 'd_mochi',   plate: null,             price: 16, prep: 2.8, ing: null,      belt: false }
    },
    INGREDIENTS: {
      salmon: { name: 'Beef', icon: 'c_ing_salmon',   cost: 1 },
      tuna:   { name: 'Shrimp',   icon: 'c_ing_tuna',     cost: 2 },
      veg:    { name: 'Veggies', icon: 'c_ing_cucumber', cost: 3 },
      ikura:  { name: 'Wagyu',  icon: 'c_box_salmon',   cost: 8 }
    },
    STATION: { inMax: 10, outMax: 6 },

    // ---------------- conveyor ----------------
    BELT: {
      speed: [34, 42, 50, 60, 70],          // units/s by conveyor speed level
      capA: [7, 10, 14, 18],                // plate capacity by capacity level
      gap: 30,                              // min spacing between plates (occupied space)
      halfW: 26                             // radius of the belt end arcs (world units)
    },

    // ---------------- customers ----------------
    CUSTOMER: {
      spawnBase: 7.0, spawnMin: 2.4,       // seconds between arrivals
      wantsMin: 2, wantsMax: 4,
      eatTime: 2.6,
      patienceQueue: 60, patienceSeat: 45, patienceRefill: 0.6, tablePatienceMult: 1.6,
      happyFastTime: 12,                    // served first plate within this → happy (+tip)
      tipRate: 0.2,
      extraOrderChance: 0.4,                // drink / dessert request after eating (once unlocked)
      extraWait: 22,
      queueCap: [1, 4],                     // before / after "waiting queue" unlock
      payTime: 0.7,
      happyStarChance: 0.1,                 // a happy paying customer leaves a star (rating)
      payWaitMax: 25                        // seconds a customer waits at an empty register before leaving cash (no tip)
    },
    VIP: {
      vip1: { wants: ['premium'], pay: 2.0, stars: 2, bonus: 40, patience: 70 },
      vip2: { wants: ['premium', 'dessert'], pay: 2.0, stars: 3, bonus: 70, patience: 80 },
      eatTime: 3.2, spawnEvery: 26
    },
    CLEAN: { time: [0.28, 0.18, 0.1] , dirtyCap: 12 },   // seconds per dirty plate by cleaning level; dirty plates stack high

    MANAGER: { every: 55, duration: 20, mult: 1.5 },
    RUSH: { duration: 150, spawnMult: 0.45, payMult: 2, goal: 15 },

    // ---------------- upgrades (Upgrade panel) ----------------
    UPGRADES: {
      beltSpeed: { name: 'Conveyor Speed',    icon: 'up_beltSpeed',  costs: [110, 320, 900, 2400], minPhase: [2, 3, 5, 8] },
      beltCap:   { name: 'Conveyor Capacity', icon: 'up_beltCap', costs: [260, 900, 2200], minPhase: [3, 5, 7] },
      carry:     { name: 'Carry Capacity',    icon: 'up_carry', costs: [55, 220, 650, 1500], minPhase: [2, 3, 5, 7] },
      move:      { name: 'Walk Speed',        icon: 'up_move', costs: [90, 400, 1100], minPhase: [2, 4, 6] },
      prod:      { name: 'Production Speed',  icon: 'up_prod', costs: [220, 800, 1900], minPhase: [3, 5, 7] },
      clean:     { name: 'Cleaning Speed',    icon: 'up_clean', costs: [350, 1000], minPhase: [4, 6] },
      staff:     { name: 'Staff Training',    icon: 'up_staff', costs: [700, 1700], minPhase: [6, 7] }
    },
    // ---------------- ads (see 'Hedge Tasco – Kịch bản Ads', option B: inter cooldown 75 s) ----------------
    ADS: {
      units: { rewarded: 'REWARDED_AD_UNIT_ID', inter: 'INTERSTITIAL_AD_UNIT_ID' },   // TikTok Minis ad unit ids (Developer Portal)
      interFirstDelay: 30, interFirstTask: 1, interFirstForce: true, interCooldown: 45, interAfterReward: 30, interCapSession: 30, interFallback: 90, interDelay: 0.6, resumeAfter: 60,
      rewardSlotCooldown: 90, rewardCapDay: 40, r1Cooldown: 75, vipTipCooldown: 90,
      rushEvery: 180, rushMinWaiting: 3, rushTime: 60, rushStaff: 1.25, rushPrice: 1.2,   // R3 Hedge Rush
      padShortMax: 0.4, vipTipMult: 3, coinsMinutes: 0.75, coinsAfter: 15, coinsCooldown: 180, rushExtra: 45, rushAfter: 20
    },
    // ---------------- TikTok Minis entry rewards (scaled to recent income so they never break the economy) ----------------
    MINIS: { addMinutes: 2, addStars: 1, revisitMinutes: 1.5, shareMinutes: 1 },
    PROD_MULT: [1, 1.3, 1.6, 2.0],
    STAFF_MULT: [1, 1.25, 1.5],
    RICE_MULT: 1.35,
    STAR_PRICE_BONUS: 0.035,      // each star raises menu prices by 3.5% (restaurant rating), capped at +100%

    // ---------------- layout (world units, y grows downward) ----------------
    // World is a flat top-down grid; the renderer projects it isometrically (Cat Pizza style):
    // +x runs down-right on screen, +y runs down-left. Back walls sit on x=0 and y=0.
    ISO: { K: 0.75 },
    LAYOUT: {
      wallH: 120,                 // wall height in screen units
      zones: {
        kitchen:  { x: 0,   y: 0,   w: 560, h: 200, floor: 'tile',   unlock: null,          label: 'Kitchen' },
        diningA:  { x: 0,   y: 200, w: 560, h: 220, floor: 'wood',   unlock: null,          label: 'Dining' },
        entry:    { x: 0,   y: 420, w: 200, h: 220, floor: 'stone',  unlock: null,          label: 'Entrance' },
        kitchen2: { x: 560, y: 0,   w: 160, h: 200, floor: 'tile',   unlock: 'st_premium',  label: 'Premium Kitchen' },
        vip:      { x: 560, y: 200, w: 160, h: 220, floor: 'rug',    unlock: 'vip_lounge',  label: 'VIP Lounge' },
        diningB:  { x: 200, y: 420, w: 360, h: 220, floor: 'wood',   unlock: 'seats_a67',   label: 'Dining Room 2' },
        hall:     { x: 560, y: 420, w: 160, h: 220, floor: 'tatami', unlock: 'hall',        label: 'Hotpot Hall' }
      },
      door: { x: 100, y: 640 },
      spawn: { x: 100, y: 720 },
      stations: {
        salmon:  { x: 110, y: 52, prop: 'st_salmon',  recipe: 'salmon',  unlock: null },
        tuna:    { x: 290, y: 52, prop: 'st_tuna',    recipe: 'tuna',    unlock: 'st_tuna' },
        maki:    { x: 440, y: 52, prop: 'st_maki',    recipe: 'maki',    unlock: 'st_maki' },
        premium: { x: 620, y: 52, prop: 'st_premium', recipe: 'premium', unlock: 'st_premium' },
        dessert: { x: 685, y: 52, prop: 'st_dessert', recipe: 'dessert', unlock: 'st_dessert' },
        drink:   { x: 685, y: 150, prop: 'st_drink',  recipe: 'drink',   unlock: 'st_drink' }
      },
      rice:    { x: 535, y: 52, prop: 'st_rice',    unlock: 'rice' },
      storage: { x: 26,  y: 150, prop: 'st_storage', unlock: 'storage' },
      bin:     { x: 26, y: 228 },   // trash bin: throw away anything you can't use (ingredients refunded); the dish return only takes dirty plates   // kitchen side wall, next to the salmon crate
      crates: {
        // ingredient crates sit on the kitchen back wall right next to the station that uses them
        salmon: { x: 22,  y: 50, prop: 'c_box_salmon', unlock: null,       ap: { x: 22,  y: 94 } },
        tuna:   { x: 200, y: 50, prop: 'c_box_fish',   unlock: 'st_tuna',  ap: { x: 200, y: 94 } },
        veg:    { x: 360, y: 50, prop: 'c_box_veg',    unlock: 'st_maki',  ap: { x: 360, y: 94 } },
        ikura:  { x: 620, y: 140, prop: 'c_box_rice',  unlock: 'st_premium' }
      },
      sinks: [{ id: 's1', x: 62, y: 300, prop: 'st_sink', unlock: null }, { id: 's2', x: 660, y: 600, prop: 'st_sink', unlock: 'hall' }],
      cashier: { x: 95, y: 470, prop: 'cashier', pad: { x: 95, y: 440 }, payAt: { x: 95, y: 505 }, pile: { x: 150, y: 455 } },
      queue: { x: 165, y: 560 },
      // small kaiten loop in front of the kitchen (long axis along x)
      belt: { cy: 205, x0: 150, x1: 300, x0ext: 120, x1ext: 340, loader: { x: 225, y: 150 } },   // wide walkway (~85u) between stations and belt
      stools: [
        { id: 'a1', x: 200, unlock: null }, { id: 'a2', x: 245, unlock: 'seat_a2' }, { id: 'a3', x: 155, unlock: 'seat_a3' },
        { id: 'a4', x: 290, unlock: 'belt_b' }, { id: 'a5', x: 115, unlock: 'belt_b' }, { id: 'a6', x: 335, unlock: 'belt_b' }
      ],
      stoolY: 287,                 // stools face the built-in counter that wraps the belt's dining side
      // dining tables (pizza style): each table seats two, chairs on its left (-x) and right (+x) side
      tables: [
        { id: 't1', x: 150, y: 375, unlock: 'seats_a45' }, { id: 't2', x: 310, y: 375, unlock: 'seats_a45' },
        { id: 't3', x: 300, y: 500, unlock: 'seats_a67' }, { id: 't4', x: 300, y: 590, unlock: 'seats_a67' },
        { id: 't5', x: 600, y: 500, unlock: 'hall' },      { id: 't6', x: 600, y: 590, unlock: 'hall' }
      ],
      vipSeats: [
        { id: 'v1', x: 600, y: 270, kind: 'vip1', unlock: 'vip_lounge' },
        { id: 'v2', x: 600, y: 370, kind: 'vip2', unlock: 'vip_sofa2' }
      ],
      managerDesk: { x: 665, y: 450, prop: 'mgr_desk' },
      // Cat Pizza-style upgrade spots: dashed floor circles with an up-arrow; stepping on one opens those upgrades
      upgradeSpots: [
        { id: 'kitchen', name: 'Kitchen Upgrades', x: 380, y: 150, keys: ['prod', 'carry', 'staff'] },
        { id: 'belt',    name: 'Conveyor Upgrades', x: 425, y: 215, keys: ['beltSpeed', 'beltCap'] },
        { id: 'service', name: 'Service Upgrades', x: 120, y: 610, keys: ['move', 'clean'] }
      ],
      homes: { chef: { x: 270, y: 115 }, chef2: { x: 180, y: 115 }, cleaner: { x: 75, y: 340 }, waiter: { x: 597, y: 184 } },   /* Server Hedgehog waits in the open aisle between the drink/dessert counters and the VIP lounge, not among the belt stools */
      decor: [
        { p: 'lantern_r', x: 140, y: 0, wall: 'right', h: 80 }, { p: 'lantern_r', x: 330, y: 0, wall: 'right', h: 80 },
        { p: 'banner', x: 0, y: 130, wall: 'left', h: 70 },
        { p: 'plant2', x: 20, y: 600 }, { p: 'bamboo', x: 400, y: 410 }, { p: 'chalkboard', x: 190, y: 625 }, { p: 'maneki', x: 40, y: 470 }
      ],
      finalDecor: [
        { p: 'sakura_tree', x: 800, y: 470 }, { p: 'koi', x: 790, y: 330 }, { p: 'gate', x: 100, y: 690 },
        { p: 'sakura_pot', x: 410, y: 630 }, { p: 'bonsai', x: 700, y: 690 },
        { p: 'stall', x: 330, y: 700 }, { p: 'lantern_p', x: 20, y: 690 }
      ]
    },

    // ---------------- unlocks (world build pads / Shop) ----------------
    UNLOCKS: [
      { id: 'seat_a2',    name: 'Second Stool',         cost: 45,   at: 'earn100', pad: { x: 245, y: 325 }, icon: 'stool' },
      { id: 'st_tuna',    name: 'Shrimp Station',         cost: 100,  at: 'seat2',   pad: { x: 290, y: 104 }, icon: 'f_tuna' },
      { id: 'seat_a3',    name: 'Third Stool',          cost: 90,   at: 'tuna',    pad: { x: 160, y: 325 }, icon: 'stool' },
      { id: 'queue',      name: 'Waiting Queue',        cost: 70,   at: 'tuna5',   pad: { x: 160, y: 600 }, icon: 'bench_red' },
      { id: 'rice',       name: 'Broth Station',         cost: 110,  at: 'rice',    pad: { x: 535, y: 108 }, icon: 'c_rice_bowl' },
      { id: 'storage',    name: 'Cold Storage',         cost: 150,  at: 'storage', pad: { x: 70, y: 150 }, icon: 'c_box_fish' },
      { id: 'chef',       name: 'Hire Waiter Hedgehog',      cost: 190,  at: 'chef',    pad: { x: 450, y: 255 }, icon: 'staff_waiter' },
      { id: 'cashier',    name: 'Hire Cashier Hedgehog',     cost: 220,  at: 'chef',    pad: { x: 150, y: 420 }, icon: 'staff_cashier' },
      { id: 'seats_a45',  name: 'Dining Tables',        cost: 240,  at: 'auto10',  pad: { x: 230, y: 375 }, icon: 'table_sq' },
      { id: 'belt_b',     name: 'Conveyor Extension',   cost: 600,  at: 'beltb',   pad: { x: 370, y: 250 }, icon: 'c_stack_blue' },
      { id: 'st_maki',    name: 'Veggie Station',         cost: 450,  at: 'maki',    pad: { x: 440, y: 104 }, icon: 'f_maki' },
      { id: 'cleaner',    name: 'Hire Cleaner Hedgehog',     cost: 420,  at: 'cleaner', pad: { x: 150, y: 420 }, icon: 'staff_cleaner' },
      { id: 'vip_lounge', name: 'VIP Lounge',           cost: 800,  at: 'vip',     pad: { x: 495, y: 290 }, icon: 'armchair' },
      { id: 'st_premium', name: 'Premium Kitchen',      cost: 650,  at: 'premium', pad: { x: 505, y: 160 }, icon: 'f_premium' },
      { id: 'seats_a67',  name: 'Dining Room 2',        cost: 700,  at: 'dining2', pad: { x: 182, y: 428 }, icon: 'table_sq' },
      { id: 'st_drink',   name: 'Drink Station',        cost: 750,  at: 'drink',   pad: { x: 675, y: 195 }, icon: 'dr_matcha' },
      { id: 'st_dessert', name: 'Dessert Station',      cost: 850,  at: 'dessert', pad: { x: 660, y: 112 }, icon: 'd_mochi' },
      { id: 'waiter',     name: 'Hire Server Hedgehog',      cost: 850,  at: 'waiter',  pad: { x: 380, y: 320 }, icon: 'staff_server' },
      { id: 'vip_sofa2',  name: 'VIP Sofa 2',           cost: 950,  at: 'sofa2',   pad: { x: 545, y: 380 }, icon: 'armchair2' },
      { id: 'hall',       name: 'Hotpot Hall',          cost: 1800, at: 'hall',    pad: { x: 570, y: 405 }, icon: 'floor_tatami' },
      { id: 'chef2',      name: 'Hire 2nd Waiter Hedgehog',  cost: 1500, at: 'hall',    pad: { x: 470, y: 330 }, icon: 'staff_waiter' },
      { id: 'manager',    name: 'Hire Manager Hedgehog',     cost: 2200, at: 'manager', pad: { x: 640, y: 455 }, icon: 'staff_manager' },
      { id: 'final_decor',name: 'Grand Decoration',     cost: 2600, at: 'decor',   pad: { x: 540, y: 545 }, icon: 'sakura_tree' },
      { id: 'grand_open', name: 'Start Grand Opening',  cost: 0,    at: 'open',    pad: { x: 100, y: 600 }, icon: 'gate' }
    ],

    // ---------------- task sequence (one primary task at a time) ----------------
    // type: counter key in stats (delta since task start) | 'unlock' id | 'upgrade' id>=level | 'coinsHave'
    TASKS: [
      { id: 'pick',     ph: 1, t: 'Pick up 3 beef from the crate',  type: 'stat', key: 'ingPicked', n: 3,  reward: { coins: 10 }, target: 'crate:salmon' },
      { id: 'prep',     ph: 1, t: 'Slice 3 plates of beef',           type: 'stat', key: 'made_salmon', n: 3, reward: { coins: 10 }, target: 'station:salmon' },
      { id: 'place',    ph: 1, t: 'Place 3 plates on the conveyor',   type: 'stat', key: 'beltLoaded', n: 3, reward: { coins: 10 }, target: 'loader:A' },
      { id: 'serve3',   ph: 1, t: 'Serve 3 customers (take payment at the register)', type: 'stat', key: 'paid', n: 3, reward: { coins: 15, stars: 1 }, target: 'cashier' },
      { id: 'earn100',  ph: 1, t: 'Earn 100 coins',                   type: 'stat', key: 'earned', n: 100, reward: { stars: 1 }, target: 'pile' },
      { id: 'seat2',    ph: 2, t: 'Unlock the second seat',           type: 'unlock', id2: 'seat_a2', reward: { coins: 20 } },
      { id: 'tuna',     ph: 2, t: 'Unlock the Shrimp Station',          type: 'unlock', id2: 'st_tuna', reward: { coins: 20 } },
      { id: 'tuna5',    ph: 2, t: 'Prepare 5 shrimp plates',             type: 'stat', key: 'made_tuna', n: 5, reward: { coins: 30, stars: 1 }, target: 'station:tuna' },
      { id: 'beltspd',  ph: 2, t: 'Upgrade conveyor speed',           type: 'upgrade', id2: 'beltSpeed', lv: 1, reward: { coins: 30 }, target: 'ui:upgrade' },
      { id: 'rice',     ph: 3, t: 'Unlock the Broth Station',          type: 'unlock', id2: 'rice', reward: { coins: 40 } },
      { id: 'storage',  ph: 3, t: 'Unlock Cold Storage',              type: 'unlock', id2: 'storage', reward: { coins: 40 } },
      { id: 'chef',     ph: 3, t: 'Hire Waiter Hedgehog (carries plates to the belt)',        type: 'unlock', id2: 'chef', reward: { coins: 50, stars: 1 } },
      { id: 'auto10',   ph: 3, t: 'Produce 10 plates automatically',   type: 'stat', key: 'chefLoaded', n: 10, reward: { coins: 60 }, target: 'loader:A' },
      { id: 'cashier',  ph: 3, t: 'Hire Cashier Hedgehog',                 type: 'unlock', id2: 'cashier', reward: { coins: 60 } },
      { id: 'beltb',    ph: 4, t: 'Extend the conveyor (+3 stools)',         type: 'unlock', id2: 'belt_b', reward: { coins: 60, stars: 1 } },
      { id: 'maki',     ph: 4, t: 'Unlock Veggies & Mushrooms',                type: 'unlock', id2: 'st_maki', reward: { coins: 60 } },
      { id: 'cleaner',  ph: 4, t: 'Hire Cleaner Hedgehog',                 type: 'unlock', id2: 'cleaner', reward: { coins: 60 } },
      { id: 'clean5',   ph: 4, t: 'Clean 5 dirty plates',             type: 'stat', key: 'cleaned', n: 5, reward: { coins: 60, stars: 1 }, target: 'dirty' },
      { id: 'vip',      ph: 5, t: 'Unlock the VIP Lounge',            type: 'unlock', id2: 'vip_lounge', reward: { coins: 80 } },
      { id: 'premium',  ph: 5, t: 'Unlock the Premium Station',       type: 'unlock', id2: 'st_premium', reward: { coins: 80 } },
      { id: 'vip1',     ph: 5, t: 'Serve VIP Customer 1 (bring the Wagyu Platter)', type: 'stat', key: 'vip1Served', n: 1, reward: { coins: 120, stars: 2 }, target: 'vip:vip1' },
      { id: 'dining2',  ph: 5, t: 'Open Dining Room 2 (more tables)', type: 'unlock', id2: 'seats_a67', reward: { coins: 100 } },
      { id: 'drink',    ph: 6, t: 'Unlock the Drink Station',         type: 'unlock', id2: 'st_drink', reward: { coins: 100 } },
      { id: 'drinks5',  ph: 6, t: 'Serve 5 drinks',                   type: 'stat', key: 'drinksServed', n: 5, reward: { coins: 120, stars: 1 }, target: 'station:drink' },
      { id: 'dessert',  ph: 6, t: 'Unlock the Dessert Station',       type: 'unlock', id2: 'st_dessert', reward: { coins: 120 } },
      { id: 'waiter',   ph: 6, t: 'Hire Server Hedgehog',                  type: 'unlock', id2: 'waiter', reward: { coins: 120 } },
      { id: 'sofa2',    ph: 6, t: 'Unlock VIP Sofa 2',                type: 'unlock', id2: 'vip_sofa2', reward: { coins: 150 } },
      { id: 'vip2',     ph: 6, t: 'Serve VIP Customer 2',             type: 'stat', key: 'vip2Served', n: 1, reward: { coins: 200, stars: 2 }, target: 'vip:vip2' },
      { id: 'hall',     ph: 7, t: 'Open the Hotpot Hall',           type: 'unlock', id2: 'hall', reward: { coins: 200, stars: 1 } },
      { id: 'cap',      ph: 7, t: 'Upgrade conveyor capacity (Lv 2)', type: 'upgrade', id2: 'beltCap', lv: 2, reward: { coins: 200 }, target: 'ui:upgrade' },
      { id: 'manager',  ph: 8, t: 'Hire Manager Hedgehog',                 type: 'unlock', id2: 'manager', reward: { coins: 250, stars: 2 } },
      { id: 'decor',    ph: 8, t: 'Add the Grand Decoration',         type: 'unlock', id2: 'final_decor', reward: { coins: 250 } },
      { id: 'final',    ph: 8, t: 'Final conveyor upgrade (max speed)', type: 'upgrade', id2: 'beltSpeed', lv: 4, reward: { coins: 300, stars: 2 }, target: 'ui:upgrade' },
      { id: 'open',     ph: 8, t: 'Start the Grand Opening',          type: 'unlock', id2: 'grand_open', reward: {} },
      { id: 'rush',     ph: 8, t: 'Grand Opening: serve 15 customers in the rush', type: 'stat', key: 'rushServed', n: 15, reward: { coins: 1000, stars: 10 }, target: 'cashier' }
    ],
    BONUS_TASKS: [
      { t: 'Serve 10 happy customers', key: 'happy', n: 10, reward: { stars: 1, coins: 40 } },
      { t: 'Load 30 plates on conveyors', key: 'beltLoadedAll', n: 30, reward: { coins: 60 } },
      { t: 'Clean 20 dirty plates', key: 'cleaned', n: 20, reward: { coins: 80, stars: 1 } },
      { t: 'Earn 2,000 coins', key: 'earned', n: 2000, reward: { stars: 2 } },
      { t: 'Serve 40 customers', key: 'paid', n: 40, reward: { coins: 300, stars: 2 } }
    ],
    PHASE_NAMES: ['', 'First Hotpot Counter', 'First Expansion', 'Kitchen Automation', 'Conveyor Expansion',
      'VIP Lounge', 'Drinks & Dessert', 'Restaurant Expansion', 'Grand Opening']
  };

  // ---- map scale: spreads every layout position apart (props/characters keep their size) so the restaurant
  //      has roomy walkways like Cat Pizza Tycoon. Applied once, before anything reads the layout.
  // v33: more room around the dish return (west wall) and in the Premium Kitchen / east column.
  // Piecewise remap of x (layout units, before MAP_SCALE): wall-side items (x<=70) stay, the rest moves +40;
  // the east column (x>=560) is stretched 1.5x. The world grows from 720 to 840 wide.
  (function widenLayout() {
    const f = x => x <= 70 ? x : x <= 100 ? 70 + (x - 70) * 70 / 30 : x <= 560 ? x + 40 : x <= 720 ? 600 + (x - 560) * 1.5 : x + 120;   // outside the east wall (garden decor): plain shift
    const XK = new Set(['x', 'x0', 'x1', 'x0ext', 'x1ext']);
    const walk = o => {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      if (typeof o.x === 'number' && typeof o.w === 'number' && o.floor) { const a = f(o.x), b = f(o.x + o.w); o.x = Math.round(a); o.w = Math.round(b - a); }
      else for (const k in o) if (XK.has(k) && typeof o[k] === 'number') o[k] = Math.round(f(o[k]));
      for (const k in o) if (typeof o[k] === 'object') walk(o[k]);
    };
    walk(C.LAYOUT);
    C.UNLOCKS.forEach(u => { u.pad.x = Math.round(f(u.pad.x)); });
    C.WORLD.W = Math.round(f(C.WORLD.W));
  })();
  C.MAP_SCALE = 1.25;
  (function scaleLayout(S) {
    const POS = new Set(['x', 'y', 'cy', 'x0', 'x1', 'x0ext', 'x1ext', 'stoolY']);
    const walk = (o, inZones) => {
      if (Array.isArray(o)) { o.forEach(v => walk(v, inZones)); return; }
      if (!o || typeof o !== 'object') return;
      for (const k in o) {
        const v = o[k];
        if (typeof v === 'number' && (POS.has(k) || (inZones && (k === 'w' || k === 'h')))) o[k] = Math.round(v * S);
        else if (typeof v === 'object') walk(v, inZones || k === 'zones');
      }
    };
    walk(C.LAYOUT, false);
    C.UNLOCKS.forEach(u => { u.pad.x = Math.round(u.pad.x * S); u.pad.y = Math.round(u.pad.y * S); });
    C.WORLD.W = Math.round(C.WORLD.W * S); C.WORLD.H = Math.round(C.WORLD.H * S);
    C.LAYOUT.stoolY = C.LAYOUT.belt.cy + 96;   // stools stay tucked against the belt's bar counter (fixed-size parts)
    C.SPLIT_X = Math.round(340 * S);
    C.LAYOUT.bin2 = { x: 775, y: 38, unlock: 'st_premium' };   // second trash bin on the Premium Kitchen back wall (world units, already scaled)   // west/east half split used for sink/crate orientation
  })(C.MAP_SCALE);
  // derived tables
  C.PHASE_BY_TASK = C.TASKS.map(t => t.ph).concat([8]);
  C.TASK_INDEX = {}; C.TASKS.forEach((t, i) => { C.TASK_INDEX[t.id] = i; });
  // global price multiplier used to tune total session length (layout v3 is quicker to work, so prices are +5%)
  C.COST_SCALE = 0.95;
  C.UNLOCKS.forEach(u => { u.cost = Math.round(u.cost * C.COST_SCALE / 5) * 5; });
  for (const k in C.UPGRADES) C.UPGRADES[k].costs = C.UPGRADES[k].costs.map(v => Math.round(v * C.COST_SCALE / 5) * 5);
  C.UNLOCKS.forEach(u => { u.showAfter = C.TASK_INDEX[u.at]; u.phase = C.TASKS[u.showAfter].ph; });

  if (typeof module !== 'undefined') module.exports = CST;
})(typeof window !== 'undefined' ? window : globalThis);
