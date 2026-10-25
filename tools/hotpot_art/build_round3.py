"""Round-3 ChatGPT art. Run LAST: build_from_chatgpt.py -> build_round2.py -> build_fixes.py -> build_round3.py
  - cashier counter, lucky golden cat, VIP armchair icon, tasselled paw lantern (props atlas);
  - customers eating at the conveyor bar (orange / gray): counter_sit + 5-frame counter_eat, repacked into
    their atlases with anchors scaled per character (like round 2). Atlases come from the build_fixes output.
Usage: python3 tools/hotpot_art/build_round3.py art_incoming/split3"""
import sys, io, json, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

SPLIT = sys.argv[1] if len(sys.argv) > 1 else 'art_incoming/split3'
git = lambda p: subprocess.check_output(['git', 'show', 'main:' + p])
_m = git('js/manifest.js').decode(); M0 = json.loads(_m[_m.index('CST.MANIFEST=') + 13:].rstrip().rstrip(';'))
cur = open('js/manifest.js').read(); M = json.loads(cur[cur.index('CST.MANIFEST=') + 13:].rstrip().rstrip(';'))

def defringe(im, passes=2):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    for _ in range(passes):
        al = a[..., 3]; trans = al < 40
        near = ndimage.binary_dilation(trans, iterations=2) & ~trans
        mn = a[..., :3].min(axis=2); mx = a[..., :3].max(axis=2)
        a[..., 3] = np.where(near & (((mn > 170) & (mx - mn < 70)) | ((al < 200) & (mn > 120))), 0, al)
    return Image.fromarray(a.astype(np.uint8))

def load(n):
    im = defringe(Image.open(f'{SPLIT}/{n}.png').convert('RGBA')); return im.crop(im.getbbox())

# ---------------------------------------------------------------- props
pf = M['atlases']['props']['frames']
props = Image.open('assets/props.webp').convert('RGBA')
for key, name in [('cashier', 'r331_0'), ('maneki', 'r332_0'), ('armchair', 'r333_3'), ('lantern_r', 'r333_4')]:
    x, y, w, h = pf[key][:4]; sp = load(name); k = min(w / sp.width, h / sp.height)
    sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
    props.paste(Image.new('RGBA', (w, h)), (x, y)); props.alpha_composite(sp, (x + (w - sp.width) // 2, y + h - sp.height))
# manager desk: the new red counter with a small lucky golden cat on top (old desk had a Japanese maneki + baked shadow)
x, y, w, h = pf['mgr_desk'][:4]; desk = load('r331_0'); cat = load('r332_0')
k = min(w / desk.width, h * 0.78 / desk.height); desk = desk.resize((round(desk.width * k), round(desk.height * k)), Image.LANCZOS)
ch = round(h * 0.36); cat = cat.resize((round(cat.width * ch / cat.height), ch), Image.LANCZOS)
tile = Image.new('RGBA', (w, h)); dx = (w - desk.width) // 2; tile.alpha_composite(desk, (dx, h - desk.height))
top = h - desk.height   # pedestal stands on the counter top, behind the till
tile.alpha_composite(cat, (min(w - cat.width, dx + int(desk.width * 0.60)), max(0, top + int(desk.height * 0.30) - cat.height)))
props.paste(Image.new('RGBA', (w, h)), (x, y)); props.alpha_composite(tile, (x, y))
props.save('assets/props.webp', 'WEBP', quality=90, method=6); print('props: cashier, lucky cat, armchair, lantern, manager desk')

# ---------------------------------------------------------------- counter eaters
for char, first in [('cust_orange', 5), ('cust_gray', 11)]:
    ch = M['chars'][char]; A = M['atlases'][ch['atlas']]
    olds = [ch['anims']['counter_sit']['back_right'][0]] + ch['anims']['counter_eat']['back_right']
    ch0 = M0['chars'][char]; olds0 = [ch0['anims']['counter_sit']['back_right'][0]] + ch0['anims']['counter_eat']['back_right']   # original anchors
    news = [load(f'r333_{first + i}') for i in range(6)]
    # original frames: cat in the upper part, empty space below for the bar stool (anchor = floor point).
    # Scale by the CAT's height (not the frame's) and keep the anchor the same distance below the cat.
    main_at = Image.open(io.BytesIO(git(A['file']))).convert('RGBA'); A0 = M0['atlases'][ch['atlas']]
    obox = [main_at.crop((A0['frames'][o[0]][0], A0['frames'][o[0]][1], A0['frames'][o[0]][0] + A0['frames'][o[0]][2], A0['frames'][o[0]][1] + A0['frames'][o[0]][3])).getbbox() for o in olds]
    k = np.median([b[3] - b[1] for b in obox]) / np.median([n.height for n in news])
    atlas = Image.open(A['file']).convert('RGBA'); W = atlas.width
    used = max(f[1] + f[3] for f in A['frames'].values()) + 4
    x = 0; rowh = 0; placed = []
    for (key, ax, ay), n, ob in zip(olds0, news, obox):
        g = n.resize((max(1, round(n.width * k)), max(1, round(n.height * k))), Image.LANCZOS)
        sc = g.height / (ob[3] - ob[1])                       # new px per original cat px
        nax = g.width / 2 + (ax - (ob[0] + ob[2]) / 2) * sc   # same offset from the cat's centre
        nay = (ay - ob[1]) * sc                               # anchor below the cat, where the stool is
        if x + g.width > W: x = 0; used += rowh + 2; rowh = 0
        placed.append((key, x, used, g, round(nax, 1), round(nay, 1))); x += g.width + 2; rowh = max(rowh, g.height)
    out = Image.new('RGBA', (W, used + rowh + 2)); out.alpha_composite(atlas.crop((0, 0, W, min(atlas.height, used + rowh + 2))))
    for key, px, py, g, ax, ay in placed:
        out.paste(Image.new('RGBA', g.size), (px, py)); out.alpha_composite(g, (px, py)); A['frames'][key] = [px, py, g.width, g.height]
        for act in ('counter_sit', 'counter_eat'):
            for f in ch['anims'][act]['back_right']:
                if f[0] == key: f[1:3] = [ax, ay]
    out.save(A['file'], 'WEBP', quality=90, method=6); print(char, out.size)

open('js/manifest.js', 'w').write(cur[:cur.index('CST.MANIFEST=') + 13] + json.dumps(M, separators=(',', ':')) + ';\n')
print('manifest updated')
