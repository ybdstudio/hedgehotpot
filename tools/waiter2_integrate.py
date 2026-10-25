"""Install the new Waiter Cat sheets: carry-dishes (8 dir x 4) -> carry_tray + carry_plates, standing sleep (8 dir x 4) -> sleep.
   Each frame is scaled so its body height matches the waiter's own walk frame in the same direction."""
import json, sys, shutil, os, numpy as np
sys.path.insert(0,'/home/claude/game/tools'); import extract as E
from PIL import Image
F='frames'; M=json.load(open(f'{F}/meta.json')); N='/home/claude/new3'
D=['front','front_right','right','back_right','back','back_left','left','front_left']
def body_h(im):
    a=np.array(im)[...,3]>60; ys=np.where(a.sum(1)>0.15*a.sum(1).max())[0]; return ys.max()-ys.min()
for an in ['carry_tray','carry_plates','sleep']:
    M['player'][an]={}; shutil.rmtree(f'{F}/player/{an}',ignore_errors=True); os.makedirs(f'{F}/player/{an}')
for d in D:
    wh=np.median([body_h(Image.open(f'{F}/player/walk/{fr["f"]}')) for fr in M['player']['walk'][d]])
    for src,ans in [('wcarry',['carry_tray','carry_plates']),('wsleep',['sleep'])]:
        ims=[Image.open(f'{N}/{src}_{d}_{i}.png') for i in range(4)]
        s=wh/np.median([body_h(i) for i in ims])
        for i,im in enumerate(ims):
            im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
            ax,ay=E.head_anchor(im)
            for an in ans:
                im.save(f'{F}/player/{an}/{d}_{i}.png')
                M['player'][an].setdefault(d,[]).append(dict(f=f'{d}_{i}.png',w=im.width,h=im.height,ax=ax,ay=ay))
json.dump(M,open(f'{F}/meta.json','w')); print('ok')
