"""New bar stool art for every counter / waiting stool, and strip the old stool baked into the seated-cat frames so the
   same stool sprite can be drawn under a seated cat (cat drawn on top)."""
import numpy as np, json, os, shutil
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/2a4d0797-image.png'
a=np.array(Image.open(U).convert('RGB')).astype(int)
r,g,b=a[...,0],a[...,1],a[...,2]; lum=(r*30+g*59+b*11)/100; sat=a.max(-1)-a.min(-1)
bg=(lum>180)&(sat<22)
lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
# drop the soft checker shadow (grey, low saturation, mid luminance) that is not part of the legs' outline
lab,n=nd.label(fg); sz=nd.sum(fg,lab,range(1,n+1)); fg=lab==(np.argmax(sz)+1)
shadow=fg&(sat<18)&(lum>120)&(lum<200)
legs_core=nd.binary_dilation(fg&((lum<90)|(sat>40)),iterations=6)
fg=fg&~(shadow&~legs_core)
lab,n=nd.label(fg); sz=nd.sum(fg,lab,range(1,n+1)); fg=lab==(np.argmax(sz)+1)
al=(fg*255).astype(np.uint8); ys,xs=np.where(fg)
Image.fromarray(np.dstack([a.astype(np.uint8),al])).crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)).save('stations/stool_bar.png')
print('stool', xs.max()-xs.min()+1, ys.max()-ys.min()+1)

F='frames'; M=json.load(open(f'{F}/meta.json'))
for ch in ['cust_orange','cust_gray']:
    for an in ['counter_eat','counter_sit']:
        for fr in M[ch][an]['back_right']:
            p=f'{F}/{ch}/{an}/{fr["f"]}'; bak=p.replace('.png','.orig.png')
            if not os.path.exists(bak): shutil.copy(p,bak)
            im=np.array(Image.open(bak).convert('RGBA')).astype(int); H,W=im.shape[:2]
            r,g,b,A=im[...,0],im[...,1],im[...,2],im[...,3]
            red=(A>60)&(r>150)&(g<95)&(b<95)&(r-g>80)
            lab,n=nd.label(red); sz=nd.sum(red,lab,range(1,n+1)); cush=lab==(np.argmax(sz)+1)
            ys,xs=np.where(cush); cb=ys.max(); ct=ys.min()
            kill=np.zeros_like(red); kill[cb-4:,:]=True                     # everything below the cushion: legs, feet
            kill|=nd.binary_dilation(cush,iterations=3)&((r+g+b)<200)       # cushion outline
            kill|=cush|red
            # keep cat pixels below/at the cushion that hang down the side (tail tip, paws): light fur colours above the leg zone
            fur=(A>60)&((r+g+b)>420)&~red
            keep=fur&(np.arange(H)[:,None]<cb-4)   # nothing of the cat hangs below the cushion (it read as an extra stool leg)
            m=(A>0)&~(kill&~keep)
            lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); m=lab==(np.argmax(sz)+1)
            im[...,3]=np.where(m,A,0)
            Image.fromarray(im.astype(np.uint8)).save(p)
        print(ch,an,'cushion rows',ct,cb,'of',H)
