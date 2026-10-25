"""Integrate the 2nd batch of sheets (chef master sheet, chef actions, VIP1 8-dir, waiter walk) into frames/meta.json.
   Directions are assigned by the sprite's actual facing (verified visually), not the sheet labels, which are
   inconsistent in places. Right-side VIP1 views are mirrored from left-side views (VIP1 is left/right symmetric:
   centred tie, crown pin on the hat front)."""
import json, os, sys, shutil
sys.path.insert(0, '/home/claude/game/tools')
import extract as E
from PIL import Image, ImageOps
N = '/home/claude/new'; F = 'frames'
M = json.load(open(f'{F}/meta.json'))

def put(ch, an, d, i, img):
    od = f'{F}/{ch}/{an}'; os.makedirs(od, exist_ok=True); fn = f'{d}_{i}.png'; img.save(f'{od}/{fn}')
    ax, ay = E.head_anchor(img)
    M.setdefault(ch, {}).setdefault(an, {}).setdefault(d, []).append(dict(f=fn, w=img.width, h=img.height, ax=ax, ay=ay))

def reset(ch, an):
    M.setdefault(ch, {})[an] = {}; shutil.rmtree(f'{F}/{ch}/{an}', ignore_errors=True)

# ---- Chef (player + hired chefs): idle 8 dirs (eyes open), mapped by real facing
reset('chef', 'idle')
for d, i in dict(front=0, front_left=1, left=2, back_left=3, back=4, back_right=5, right=6, front_right=8).items():
    put('chef', 'idle', d, 0, Image.open(f'{N}/ci_{i}.png'))
# chef walk: dedicated 8-dir x 4-frame walk sheet (Oct 19)
reset('chef', 'walk')
for d in ['front', 'front_right', 'right', 'back_right', 'back', 'back_left', 'left', 'front_left']:
    for j in range(4): put('chef', 'walk', d, j, Image.open(f'{N}/cwk_{d}_{j}.png'))
# chef actions (front view, 4 frames): prepare at stations, wash at the dish return
for an, src, idx in [('prepare', 'prepare', [0, 1, 2, 3]), ('wash', 'clean', [0, 1, 3, 1])]:
    reset('chef', an)
    for j, k in enumerate(idx): put('chef', an, 'front', j, Image.open(f'{N}/ca_{src}_{k}.png'))

# ---- Waiter (red beret): real 8-dir walk sheet
reset('player', 'walk')
for ri, d in enumerate(['front', 'front_right', 'right', 'back_right', 'back', 'back_left', 'left', 'front_left']):
    for ci in range(4): put('player', 'walk', d, ci, Image.open(f'{N}/ww_{ri}_{ci}.png'))

# ---- VIP 1: 8-dir walk / idle / sofa from the new sheet
sp = json.load(open(f'{N}/v1spec.json'))
L = lambda k, idx: [Image.open(f'{N}/' + sp[k][i]) for i in idx]
walk = {'front': L('walk_front', [0, 2, 4, 6]), 'back': L('walk_back', [0, 2, 3, 5]), 'left': L('walk_left', [0, 2, 3, 5]),
        'front_left': L('walk_front_left', [0, 2, 4, 6]), 'back_left': L('walk_back_left', [0, 1, 2, 1]), 'back_right': L('walk_back_right', [0, 1, 2, 3])}
walk['right'] = [ImageOps.mirror(im) for im in walk['left']]
walk['front_right'] = [ImageOps.mirror(im) for im in walk['front_left']]
reset('vip1', 'walk')
for d, ims in walk.items():
    for j, im in enumerate(ims): put('vip1', 'walk', d, j, im)
idle = {'front': 0, 'back': 4, 'left': 6, 'front_left': 7, 'back_left': 5}
reset('vip1', 'idle')
for d, i in idle.items(): put('vip1', 'idle', d, 0, Image.open(f'{N}/' + sp['idle'][i]))
for d, s in [('right', 'left'), ('front_right', 'front_left'), ('back_right', 'back_left')]:
    put('vip1', 'idle', d, 0, ImageOps.mirror(Image.open(f'{N}/' + sp['idle'][idle[s]])))
reset('vip1', 'sit')
for d, i in dict(front=0, front_right=1, right=2, back_right=3, back=4, back_left=5, left=6, front_left=7).items():
    put('vip1', 'sit', d, 0, Image.open(f'{N}/' + sp['sit'][i]))
reset('vip1', 'drink')
for j in range(4): put('vip1', 'drink', 'front', j, Image.open(f'{N}/' + sp['drink'][j]))
json.dump(M, open(f'{F}/meta.json', 'w'), indent=0)
print('ok')
