"""Write the code-drawn hotpot sprites into assets/props.webp at the sushi frames' exact rects (no manifest change).
Usage: python3 tools/hotpot_art/build_atlas.py <sprites_dir> <orig_props.webp> <out_props.webp> <manifest.json>"""
import sys, json
from PIL import Image
spr, src, dst, man = sys.argv[1:5]
fr = json.load(open(man))['atlases']['props']['frames']
atlas = Image.open(src).convert('RGBA')
crate = Image.open(__file__.rsplit('/', 1)[0] + '/crate_empty.png').convert('RGBA')
CRATES = ['c_box_salmon', 'c_box_fish', 'c_box_veg', 'c_box_rice']
KEYS = ['f_salmon', 'f_tuna', 'f_maki', 'f_premium', 'dr_matcha', 'd_mochi', 'c_ing_salmon', 'c_ing_tuna', 'c_ing_cucumber', 'c_rice_bowl'] + CRATES
for k in KEYS:
    x, y, w, h = fr[k][:4]
    im = Image.open(f'{spr}/{k}.png').convert('RGBA')
    if k in CRATES:
        base = crate.copy(); base.alpha_composite(im)          # contents drawn at crate size 246x206
        s = min(w / base.width, h / base.height); base = base.resize((round(base.width * s), round(base.height * s)), Image.LANCZOS)
        im = Image.new('RGBA', (w, h)); im.alpha_composite(base, ((w - base.width) // 2, h - base.height))   # bottom-anchored
    atlas.paste(Image.new('RGBA', (w, h), (0, 0, 0, 0)), (x, y))
    atlas.alpha_composite(im.crop((0, 0, w, h)), (x, y))
atlas.save(dst, 'WEBP', quality=90, method=6)
print('wrote', dst, len(KEYS), 'frames')
