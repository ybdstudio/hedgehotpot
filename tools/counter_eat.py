"""Counter-seat customer animation (faces the conveyor counter = back_right on screen).
   Built from each customer's own back_right walk frame so identity is unchanged:
   legs hidden (seated on the stool), torso fixed, head + shoulders bob/lean toward the counter
   while eating (4 frames). Writes frames into frames/meta.json and a standalone sprite sheet."""
import json, os, sys, numpy as np
sys.path.insert(0, '/home/claude/game/tools')
import extract as E
from PIL import Image, ImageDraw
F = 'frames'; M = json.load(open(f'{F}/meta.json'))
OUT_SHEET = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/game/docs/customer_counter_eat_sheet.png'

def seated(img, cut=0.0):   # keep the legs: they rest on the stool
    a = np.array(img); h = a.shape[0]; ys = np.nonzero(a[..., 3].max(1))[0]; bot = ys.max()
    keep = int(bot - (bot - ys.min()) * cut)          # drop the feet/lower legs (they are under the counter edge / on the stool)
    a[keep:, :, 3] = 0
    # soften the cut line so it reads as the body resting on the stool
    for i, y in enumerate(range(keep - 3, keep)): a[y, :, 3] = (a[y, :, 3] * (0.75 - 0.2 * i)).astype(np.uint8)
    return Image.fromarray(a[:keep + 1])

def bob(img, dy, lean):
    """whole-sprite nod: squash by dy px and shear the top toward the counter by `lean` px, anchored at the seat (no seams)"""
    w, h = img.size; nh = h - dy
    im = img.resize((w, nh), Image.LANCZOS)
    # shear: x' = x - lean*(1 - y/nh)  (top moves right by `lean`, bottom stays)
    pad = abs(lean) + 2
    can = Image.new('RGBA', (w + 2 * pad, nh), (0, 0, 0, 0)); can.paste(im, (pad, 0))
    sh = can.transform(can.size, Image.AFFINE, (1, lean / nh, -lean, 0, 1, 0), resample=Image.BICUBIC)
    out = Image.new('RGBA', (sh.width, h), (0, 0, 0, 0)); out.paste(sh, (0, dy)); return out

def put(ch, an, d, i, img):
    od = f'{F}/{ch}/{an}'; os.makedirs(od, exist_ok=True); fn = f'{d}_{i}.png'; img.save(f'{od}/{fn}')
    ax, ay = E.head_anchor(img)
    M.setdefault(ch, {}).setdefault(an, {}).setdefault(d, []).append(dict(f=fn, w=img.width, h=img.height, ax=ax, ay=ay))

sheet_rows = []
for ch in ['cust_orange', 'cust_gray']:
    base = seated(Image.open(f'{F}/{ch}/walk/back_right_0.png').convert('RGBA'))
    for an in ('counter_sit', 'counter_eat'): M.setdefault(ch, {})[an] = {}
    sit = bob(base, 0, 0); put(ch, 'counter_sit', 'back_right', 0, sit)
    frames = [bob(base, dy, ln) for dy, ln in [(0, 0), (3, 3), (5, 5), (2, 2)]]
    for i, fr in enumerate(frames): put(ch, 'counter_eat', 'back_right', i, fr)
    sheet_rows.append((ch, [sit] + frames))
json.dump(M, open(f'{F}/meta.json', 'w'), indent=0)

# standalone sprite sheet (transparent, 256x256 cells, bottom-centre pivot) for the art library
C = 256; S = Image.new('RGBA', (C * 5, C * len(sheet_rows) + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(S)
labels = ['sit', 'eat 1', 'eat 2', 'eat 3', 'eat 4']
for r, (ch, frs) in enumerate(sheet_rows):
    for c, fr in enumerate(frs):
        k = 2.4; im = fr.resize((int(fr.width * k), int(fr.height * k)), Image.LANCZOS)
        S.alpha_composite(im, (c * C + (C - im.width) // 2, 40 + r * C + C - 16 - im.height))
for c, t in enumerate(labels): d.text((c * C + 8, 10), t, fill=(120, 60, 40, 255))
S.save(OUT_SHEET); print('sheet', OUT_SHEET, S.size)
