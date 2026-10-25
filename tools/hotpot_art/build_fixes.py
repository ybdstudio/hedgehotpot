"""Last step of the hotpot art pipeline (run after build_from_chatgpt.py and build_round2.py):
  - defringe: remove the light halo left around sprites that were cut from white backgrounds
    (invisible on the old cream sushi floor, smeared-looking on the dark rosewood floor);
  - 'stool' frame = the bar stool sprite (same stool on shop cards and waiting stools as at the counter);
  - 'banner' wall flag = the red cat-paw lantern from the ChatGPT set.
Character atlases are always read from git main (chef from the round-2 output) so re-running is safe.
Usage: python3 tools/hotpot_art/build_fixes.py"""
import io, json, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

git = lambda p: subprocess.check_output(['git', 'show', 'main:' + p])
s = open('js/manifest.js').read(); M = json.loads(s[s.index('CST.MANIFEST=') + 13:].rstrip().rstrip(';'))

def defringe(im, passes=2):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    for _ in range(passes):
        al = a[..., 3]; trans = al < 40
        near = ndimage.binary_dilation(trans, iterations=2) & ~trans
        rgb = a[..., :3]; mn = rgb.min(axis=2); mx = rgb.max(axis=2)
        light = (mn > 170) & (mx - mn < 70)                       # whitish / pale grey halo
        soft_light = (al < 200) & (mn > 120)                      # semi-transparent pale edge
        kill = near & (light | soft_light)
        a[..., 3] = np.where(kill, 0, al)
    return Image.fromarray(a.astype(np.uint8))

def unshadow(im):
    """drop baked-in floor shadows: wide semi-transparent areas (thin anti-aliased edges are kept)"""
    a = np.array(im.convert('RGBA')); al = a[..., 3]
    semi = (al > 8) & (al < 200)
    core = ndimage.binary_opening(semi, iterations=3)
    kill = ndimage.binary_dilation(core, iterations=2) & semi
    a[..., 3] = np.where(kill, 0, al); return Image.fromarray(a)

def frame(atlas, key):
    x, y, w, h = M['atlases']['props']['frames'][key][:4]; return atlas.crop((x, y, x + w, y + h))

def put(atlas, key, sp):
    x, y, w, h = M['atlases']['props']['frames'][key][:4]
    sp = sp.crop(sp.getbbox()); k = min(w / sp.width, h / sp.height)
    sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
    tile = Image.new('RGBA', (w, h)); tile.alpha_composite(sp, ((w - sp.width) // 2, h - sp.height))
    atlas.paste(Image.new('RGBA', (w, h)), (x, y)); atlas.alpha_composite(tile, (x, y))

props = defringe(unshadow(Image.open('assets/props.webp')))
put(props, 'stool', frame(props, 'stool_bar'))
lan = Image.open('art_incoming/split/187eb046_5.png').convert('RGBA'); put(props, 'banner', defringe(lan))
# the Japanese food stall near the entrance becomes the new Chinese gate
put(props, 'stall', defringe(Image.open('art_incoming/split/6e0fc582_0.png').convert('RGBA')))
# wall lanterns had blurry Japanese glyphs (one even read 寿司 'sushi'): use the theme's cat-paw lanterns
for key, src in [('lantern_r', '187eb046_5'), ('lantern_r2', '4e7770c1_5'), ('c_lantern_sushi', '39492b4e_4'), ('lantern_p', '4e7770c1_5'), ('lantern_w', '6a1de971_5')]:
    put(props, key, defringe(Image.open(f'art_incoming/split/{src}.png').convert('RGBA')))
props.save('assets/props.webp', 'WEBP', quality=90, method=6); print('props defringed, stool + banner + lanterns replaced')

for name, a in M['atlases'].items():
    if name == 'props': continue
    f = a['file']
    src = Image.open(f) if name == 'char_chef' else Image.open(io.BytesIO(git(f)))
    defringe(src).save(f, 'WEBP', quality=90, method=6)
print('character atlases defringed')
