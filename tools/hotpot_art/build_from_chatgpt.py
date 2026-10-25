"""Put the ChatGPT hotpot art (split by split_sheets.py) into assets/props.webp at the sushi frames' rects.
Each sprite is trimmed, scaled to fit its frame (aspect kept) and anchored bottom-centre, so the game's
existing sizes/positions still apply. Usage:
  python3 tools/hotpot_art/build_from_chatgpt.py <split_dir> <orig_props.webp> <manifest.json> <out_props.webp>"""
import sys, json
from PIL import Image

S = {   # atlas frame -> split sprite
    # crates / dishes / carried ingredients
    'c_box_salmon': '088f08a1_0', 'c_box_fish': '088f08a1_1', 'c_box_veg': '088f08a1_2', 'c_box_rice': '088f08a1_3',
    'f_salmon': '913da496_0', 'f_tuna': '913da496_1', 'f_maki': '913da496_2', 'f_premium': '913da496_3',
    'dr_matcha': '913da496_4', 'd_mochi': '913da496_5',
    'c_ing_salmon': 'f4fea0ca_0', 'c_ing_tuna': 'f4fea0ca_1', 'c_ing_cucumber': 'f4fea0ca_2',
    # beef counter (no empty-top stage: stage 1 = stocked, empty lower shelf, used for every state)
    'st_salmon': 'a44010d8_4', 'st3_salmon_0': 'a44010d8_4', 'st3_salmon_1': 'a44010d8_4', 'st3_salmon_2': 'a44010d8_4', 'st3_salmon_3': 'a44010d8_4',
    'chefst_salmon_0': '8eaed88b_0', 'chefst_salmon_1': '8eaed88b_1', 'chefst_salmon_2': '8eaed88b_2', 'chefst_salmon_3': '8eaed88b_4',
    # shrimp counter: stage 2 = stocked (state 0), stage 1 = empty (state 3, no ingredient)
    'st_tuna': 'ddfc04a5_6', 'st3_tuna_0': 'ddfc04a5_6', 'st3_tuna_1': 'ddfc04a5_6', 'st3_tuna_2': 'ddfc04a5_6', 'st3_tuna_3': 'ddfc04a5_5',
    'chefst_tuna_0': '6a5cf401_0', 'chefst_tuna_1': '6a5cf401_1', 'chefst_tuna_2': '6a5cf401_2', 'chefst_tuna_3': '6a5cf401_3',
    # veggie + wagyu stations: 0 empty · 1 ingredients ready · 2 plates waiting · 3 done flash
    'st_maki': '187eb046_10', 'st4_maki_0': '187eb046_6', 'st4_maki_1': '187eb046_7', 'st4_maki_2': '187eb046_9', 'st4_maki_3': '187eb046_10',
    'st_premium': 'wagyu_stage5', 'st4_ikura_0': '6a1de971_6', 'st4_ikura_1': 'wagyu_stage2', 'st4_ikura_2': 'wagyu_stage4', 'st4_ikura_3': 'wagyu_stage5',
    # open-shelf counters (finished items are drawn by code on the empty lower shelf)
    'st5_drink': '733194f4_0', 'st_drink': '733194f4_1', 'st5_dessert': '4e7770c1_6', 'st_dessert': '4e7770c1_10',
    'st_rice': 'f0104c9f_1', 'st_storage': 'c985e2c4_1',
    'c_rice_bowl': '39492b4e_0', 'hp_pot': '39492b4e_2',
    'gate': '6e0fc582_0', 'sakura_tree': '6e0fc582_1', 'koi': '6e0fc582_2', 'floor_tatami': '6e0fc582_3',
}
EXTRA_FRAMES = {'hp_pot': 'c_tray_sushi'}   # new keys reuse the rect of an unused sushi frame

def fit(sp, w, h):
    bb = sp.getbbox(); sp = sp.crop(bb)
    k = min(w / sp.width, h / sp.height)
    sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (w, h)); out.alpha_composite(sp, ((w - sp.width) // 2, h - sp.height)); return out

# Animated groups: every frame of a group gets ONE common scale and a common anchor, otherwise the
# animation jumps in size/position (each ChatGPT frame has its own tight bbox).
#  - chef overlays: placed inside the area the ORIGINAL chef occupied in its frame (the rest of the frame is
#    empty on purpose so the cat lines up with the counter), anchored on the chef-hat centre (top).
#  - counter states: common scale (largest frame fits), anchored bottom-centre.
GROUPS = {
    'chefst_salmon_': ('chef', 4), 'chefst_tuna_': ('chef', 4),
    'st3_salmon_': ('counter', 4), 'st3_tuna_': ('counter', 4), 'st4_maki_': ('counter', 4), 'st4_ikura_': ('counter', 4),
}
BLACK_BG = ('8eaed88b',)   # sheets that came on a black background: shave the dark fringe

def load(split, name):
    im = Image.open(f'{split}/{name}.png').convert('RGBA')
    if name.startswith(BLACK_BG):
        from PIL import ImageFilter
        a = im.getchannel('A').filter(ImageFilter.MinFilter(3)); im.putalpha(a)
    return im.crop(im.getbbox())

def hat_cx(sp):   # x centre of the opaque pixels in the top 18 % (chef hat): stable across frames
    import numpy as np
    a = np.array(sp.getchannel('A'))[: max(1, int(sp.height * 0.18))] > 100
    xs = np.where(a.any(axis=0))[0]; return (xs[0] + xs[-1]) / 2 if len(xs) else sp.width / 2

def fit_group(kind, frames, rects, orig_boxes):
    outs = []
    if kind == 'chef':
        # target: union of the original chef bboxes (frame-local), scale by height of the tallest new frame
        ux0 = min(b[0] for b in orig_boxes); uy0 = min(b[1] for b in orig_boxes); ux1 = max(b[2] for b in orig_boxes); uy1 = max(b[3] for b in orig_boxes)
        k = (uy1 - uy0) / max(f.height for f in frames); cx = (ux0 + ux1) / 2
        for f, (w, h) in zip(frames, rects):
            g = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            out = Image.new('RGBA', (w, h)); out.alpha_composite(g, (int(round(cx - hat_cx(f) * k)), uy0)); outs.append(out)
    else:
        w, h = rects[0]; k = min(min(w / f.width, h / f.height) for f in frames)
        for f in frames:
            g = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            out = Image.new('RGBA', (w, h)); out.alpha_composite(g, ((w - g.width) // 2, h - g.height)); outs.append(out)
    return outs

if __name__ == '__main__':
    split, src, man, dst = sys.argv[1:5]
    fr = json.load(open(man))['atlases']['props']['frames']
    for k, base in EXTRA_FRAMES.items(): fr.setdefault(k, fr[base])
    atlas = Image.open(src).convert('RGBA')
    done = set()
    for pre, (kind, n) in GROUPS.items():
        keys = [pre + str(i) for i in range(n)]
        rects = [tuple(fr[k][2:4]) for k in keys]
        orig_boxes = [atlas.crop((fr[k][0], fr[k][1], fr[k][0] + fr[k][2], fr[k][1] + fr[k][3])).getbbox() for k in keys]
        for k, im in zip(keys, fit_group(kind, [load(split, S[k]) for k in keys], rects, orig_boxes)):
            x, y, w, h = fr[k][:4]; atlas.paste(Image.new('RGBA', (w, h)), (x, y)); atlas.alpha_composite(im, (x, y)); done.add(k)
    for key, name in S.items():
        if key in done: continue
        x, y, w, h = fr[key][:4]
        atlas.paste(Image.new('RGBA', (w, h)), (x, y))
        atlas.alpha_composite(fit(load(split, name), w, h), (x, y))
    atlas.save(dst, 'WEBP', quality=90, method=6)
    print('wrote', dst, len(S), 'frames')
