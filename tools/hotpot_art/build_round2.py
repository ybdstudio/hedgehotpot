"""Round-2 ChatGPT art: chef carry/place animations (char_chef atlas, repacked frames + anchors in
js/manifest.js), dining-table frames, solo diners, empty tables and the empty beef counter (props atlas).
Run AFTER build_from_chatgpt.py. Sources are always taken from git `main` so the script is re-runnable.
Usage: python3 tools/hotpot_art/build_round2.py art_incoming/split2"""
import sys, io, json, re, subprocess
import numpy as np
from PIL import Image

SPLIT = sys.argv[1] if len(sys.argv) > 1 else 'art_incoming/split2'
git = lambda p: subprocess.check_output(['git', 'show', 'main:' + p])
MAN_SRC = git('js/manifest.js').decode()
M = json.loads(MAN_SRC[MAN_SRC.index('CST.MANIFEST=') + len('CST.MANIFEST='):].rstrip().rstrip(';'))

def load(name):
    im = Image.open(f'{SPLIT}/{name}.png').convert('RGBA'); return im.crop(im.getbbox())

# ---------------------------------------------------------------- chef carry / place (8 directions x 4 frames)
SHEETS = {'21a': ('carry', 'front', 'back'), '21b': ('carry', 'front_right', 'back_left'), '21c': ('carry', 'right', 'left'), '21d': ('carry', 'back_right', 'front_left'),
          '22a': ('place', 'front', 'back'), '22b': ('place', 'front_right', 'back_left'), '22c': ('place', 'right', 'left'), '22d': ('place', 'back_right', 'front_left')}
chefA = M['atlases']['char_chef']; anims = M['chars']['chef']['anims']
atlas = Image.open(io.BytesIO(git('assets/char_chef.webp'))).convert('RGBA')
new_frames = []   # (key, image, ax, ay)
for sheet, (act, d1, d2) in SHEETS.items():
    for row, d in enumerate((d1, d2)):
        olds = anims[act][d]; news = [load(f'r2{sheet}_{row * 4 + i}') for i in range(4)]
        oh = np.median([chefA['frames'][o[0]][3] for o in olds]); nh = np.median([n.height for n in news]); k = oh / nh   # one scale per direction
        for (key, ax, ay), n in zip(olds, news):
            ow, ohh = chefA['frames'][key][2:4]
            g = n.resize((max(1, round(n.width * k)), max(1, round(n.height * k))), Image.LANCZOS)
            new_frames.append((key, g, round(ax / ow * g.width, 1), round(ay / ohh * g.height, 1)))
# shelf-pack the new frames below the existing atlas content
used_h = max(f[1] + f[3] for f in chefA['frames'].values()) + 4
x = y = 0; rowh = 0; W = atlas.width; places = []
for key, g, ax, ay in new_frames:
    if x + g.width > W: x = 0; y += rowh + 2; rowh = 0
    places.append((key, x, used_h + y, g, ax, ay)); x += g.width + 2; rowh = max(rowh, g.height)
H = used_h + y + rowh + 2
out = Image.new('RGBA', (W, H)); out.alpha_composite(atlas.crop((0, 0, W, min(atlas.height, used_h))))
for key, px, py, g, ax, ay in places:
    out.alpha_composite(g, (px, py)); chefA['frames'][key] = [px, py, g.width, g.height]
    act, d, i = key.split('.')[1:4]; anims[act][d][int(i)][1:3] = [ax, ay]
out.save('assets/char_chef.webp', 'WEBP', quality=90, method=6)
print('char_chef', out.size, len(places), 'frames')

# ---------------------------------------------------------------- props: dining + empty beef counter
fr = M['atlases']['props']['frames']
props = Image.open('assets/props.webp').convert('RGBA'); orig = Image.open(io.BytesIO(git('assets/props.webp'))).convert('RGBA')
GROUPS = [([f'dine_one_L_{i}' for i in range(8)], [f'r223a_{i}' for i in range(8)]),
          ([f'dine_one_R_{i}' for i in range(8)], [f'r223b_{i}' for i in range(8)]),
          ([f'dine_one_G_{i}' for i in range(8)], [f'r223c_{i}' for i in range(8)]),
          ([f'dine_pair_{i}' for i in range(3)], [f'r223d_{i}' for i in range(3)]),
          ([f'dine_solo_orange_{i}' for i in range(3)], [f'r223e_{i}' for i in range(3)]),
          ([f'dine_solo_gray_{i}' for i in range(3)], [f'r223e_{i}' for i in range(3, 6)]),
          (['dine_one_empty'], ['r223f_0']), (['dine_table'], ['r223f_1']),
          (['st3_salmon_3'], ['r224_0'])]
for keys, names in GROUPS:
    boxes = [orig.crop((fr[k][0], fr[k][1], fr[k][0] + fr[k][2], fr[k][1] + fr[k][3])).getbbox() for k in keys]
    ux0 = min(b[0] for b in boxes); uy0 = min(b[1] for b in boxes); ux1 = max(b[2] for b in boxes); uy1 = max(b[3] for b in boxes)
    news = [load(n) for n in names]
    if keys == ['st3_salmon_3']:   # same scale as the stocked counter it alternates with
        ref = props.crop((fr['st3_salmon_0'][0], fr['st3_salmon_0'][1], fr['st3_salmon_0'][0] + fr['st3_salmon_0'][2], fr['st3_salmon_0'][1] + fr['st3_salmon_0'][3])).getbbox()
        k = (ref[2] - ref[0]) / news[0].width; ux0, ux1, uy1 = ref[0], ref[2], ref[3]
    else:
        k = min((ux1 - ux0) / max(n.width for n in news), (uy1 - uy0) / max(n.height for n in news))
    for key, n in zip(keys, news):
        x, y, w, h = fr[key][:4]; g = n.resize((max(1, round(n.width * k)), max(1, round(n.height * k))), Image.LANCZOS)
        tile = Image.new('RGBA', (w, h)); tile.alpha_composite(g, (max(0, int((ux0 + ux1) / 2 - g.width / 2)), max(0, uy1 - g.height)))
        props.paste(Image.new('RGBA', (w, h)), (x, y)); props.alpha_composite(tile, (x, y))
props.save('assets/props.webp', 'WEBP', quality=90, method=6)
print('props: dining + empty counter done')

# ---------------------------------------------------------------- manifest (keep the current props frames, e.g. hp_pot)
cur = open('js/manifest.js').read(); CUR = json.loads(cur[cur.index('CST.MANIFEST=') + len('CST.MANIFEST='):].rstrip().rstrip(';'))
# characters: main's entries (chef updated here; later steps patch others), props frames keep the current ones
for n in M['atlases']:
    if n != 'props': CUR['atlases'][n] = M['atlases'][n]
CUR['chars'] = M['chars']
open('js/manifest.js', 'w').write(cur[:cur.index('CST.MANIFEST=') + len('CST.MANIFEST=')] + json.dumps(CUR, separators=(',', ':')) + ';\n')
print('manifest updated')
