"""Split ChatGPT sheets into single sprites: remove the flat background (flood fill from the border),
drop filename labels, return sprites in reading order. Usage: python3 split_sheets.py raw_dir out_dir"""
import sys, os, glob, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

def remove_bg(im):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    if a[..., 3].min() < 250 and (a[..., 3] < 10).mean() > 0.2: return a.astype(np.uint8)   # already transparent
    border = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    bg = np.median(border, axis=0)
    dist = np.abs(a[..., :3] - bg).max(axis=2)
    tol = 34 if bg.mean() > 128 else 26
    cand = dist < tol
    bmn, bmx = border.min(axis=1), border.max(axis=1)
    if (bmx - bmn).max() < 16 and bmn.min() > 175 and border.std() > 6:
        # fake "transparent" checkerboard painted into an RGB image: both light greys are background
        mn, mx = a[..., :3].min(axis=2), a[..., :3].max(axis=2)
        cand = (mx - mn < 16) & (mn > 178)
        dist = np.where(cand, 0, 60).astype(np.int16); tol = 30
    lab, n = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge))
    alpha = np.where(bgmask, 0, 255).astype(np.float32)
    # soft 1px edge: semi-transparent where the colour is still close to the background
    ring = ndimage.binary_dilation(bgmask, iterations=2) & ~bgmask
    soft = np.clip((dist - tol * 0.6) / (tol * 1.6), 0, 1) * 255
    alpha[ring] = np.minimum(alpha[ring], soft[ring])
    a[..., 3] = alpha.astype(np.int16)
    return a.astype(np.uint8)

def _col_split(m):
    """split a component at fully empty columns (sprites that only touch after dilation)"""
    cols = m.any(axis=0); runs = []; x = 0; W = len(cols)
    while x < W:
        if cols[x]:
            s0 = x
            while x < W and cols[x]: x += 1
            runs.append([s0, x])
        else: x += 1
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 3: merged[-1][1] = r[1]
        else: merged.append(r)
    return [r for r in merged if r[1] - r[0] >= 40]

def split(arr):
    m = arr[..., 3] > 100
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=6))
    items = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        own = (lab[sl] == i + 1) & m[sl]
        h = sl[0].stop - sl[0].start
        if h < 46 or own.sum() < 2500: continue          # filename labels / specks
        for c0, c1 in _col_split(own):
            sub_m = own[:, c0:c1]; rows = np.where(sub_m.any(axis=1))[0]
            if len(rows) == 0 or rows[-1] - rows[0] < 46 or sub_m.sum() < 2500: continue
            y0, y1 = sl[0].start + rows[0], sl[0].start + rows[-1] + 1; x0, x1 = sl[1].start + c0, sl[1].start + c1
            sub = arr[y0:y1, x0:x1].copy(); sub[..., 3] = np.where(sub_m[rows[0]:rows[-1] + 1], sub[..., 3], 0)
            items.append(((y0 + y1) / 2, y1 - y0, x0, sub))
    if not items: return []
    med = sorted(i[1] for i in items)[len(items) // 2]
    items.sort(key=lambda i: i[0]); rowsl = []; 
    for it in items:
        if rowsl and it[0] - rowsl[-1][-1][0] < med * 0.55: rowsl[-1].append(it)
        else: rowsl.append([it])
    out = []
    for r in rowsl: out += [Image.fromarray(i[3]) for i in sorted(r, key=lambda i: i[2])]
    return out

if __name__ == '__main__':
    raw, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
    cells = []
    for f in sorted(glob.glob(raw + '/*.png')):
        src = os.path.basename(f).split('-')[0]
        for i, sp in enumerate(split(remove_bg(Image.open(f)))):
            sp.save(f'{dst}/{src}_{i}.png'); cells.append((f'{src}_{i}', sp))
    # contact sheet on a green background so leftover background shows
    W = 8; cs = Image.new('RGB', (W * 230, ((len(cells) + W - 1) // W) * 230), 'white'); d = ImageDraw.Draw(cs)
    for k, (name, sp) in enumerate(cells):
        t = sp.copy(); t.thumbnail((220, 200)); bg = Image.new('RGBA', t.size, (110, 190, 110, 255)); bg.alpha_composite(t)
        x, y = (k % W) * 230, (k // W) * 230; cs.paste(bg.convert('RGB'), (x + 5, y + 2)); d.text((x + 5, y + 210), name, fill='black')
    cs.save(dst + '/_contact.jpg', quality=82); print(len(cells), 'sprites')
