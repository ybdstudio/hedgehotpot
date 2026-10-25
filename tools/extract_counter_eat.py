"""Cut the 5-frame 'sit & eat at the conveyor (top-right)' customer sheets out of their baked checker background."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'
SRC={'cust_gray':'1c495aac-image.png','cust_orange':'a4452640-image.png'}
O='/home/claude/new2'
def cut(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=np.max(a,2).astype(int)-np.min(a,2)
    bg=(lum>165)&(sat<26)
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
    lab,n=nd.label(fg)
    if n>1:
        sz=nd.sum(fg,lab,range(1,n+1)); fg=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>0.15*sz.max()])
    return fg
for k,f in SRC.items():
    a=np.array(Image.open(U+f).convert('RGB')); H,W=a.shape[:2]; q=W/5
    for i in range(5):
        x0,x1=int(i*q),int((i+1)*q); sub=a[300:,x0:x1]
        fg=cut(sub); al=(fg*255).astype(np.uint8)
        ys,xs=np.where(fg); box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
        Image.fromarray(np.dstack([sub,al])).crop(box).save(f'{O}/{k}_ce_{i}.png'); print(k,i,box)
