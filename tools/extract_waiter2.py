"""Waiter Cat: carry-dishes 8x4 and standing rest/sleep 8x4 sheets -> per-cell cut-outs (checker bg removed)."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'
O='/home/claude/new3'
D=['front','front_right','right','back_right','back','back_left','left','front_left']
COLS=[194,371,548,726,903,1081,1259,1437]; ROWS=[(140,360),(358,578),(575,795),(790,1010)]
def cut(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=np.max(a,2).astype(int)-np.min(a,2)
    bg=(lum>165)&(sat<28)
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
    lab,n=nd.label(fg); sz=nd.sum(fg,lab,range(1,n+1)); main=np.argmax(sz)+1
    ys,xs=np.where(lab==main); top,bot=ys.min(),ys.max()
    keep=lab==main
    for i in range(1,n+1):   # keep sizeable bits inside the body span (zzz, sleep bubbles near the head)
        if i!=main and sz[i-1]>30:
            yy,xx=np.where(lab==i)
            if yy.mean()<top+0.4*(bot-top) and xx.min()>6 and xx.max()<keep.shape[1]-6 and sz[i-1]<0.2*sz[main-1]: keep|=lab==i
    # strip a thin ground-line under the feet (bottom rows much narrower than the legs, separated by a gap)
    rows=keep.sum(1); ys=np.where(rows>0)[0]; b=ys.max()
    while b>ys.min() and rows[b]>0 and rows[b]<0.12*rows.max(): keep[b]=False; b-=1
    return keep, lum
for name,f in [('wcarry','bf10394b-image.png'),('wsleep','4c5e4024-image.png')]:
    a=np.array(Image.open(U+f).convert('RGB'))
    for ri,(y0,y1) in enumerate(ROWS):
        for ci,cx in enumerate(COLS):
            sub=a[y0:y1,max(cx-92,121):cx+92]; keep,lum=cut(sub)
            al=(keep*255).astype(np.uint8); edge=keep&~nd.binary_erosion(keep); al[edge&(lum>200)]=110
            ys,xs=np.where(keep)
            Image.fromarray(np.dstack([sub,al])).crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)).save(f'{O}/{name}_{D[ci]}_{ri}.png')
print('ok')
