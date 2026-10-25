"""Cut each seated cat out of the two-cat table frames (for tables with a single guest).
   gray (right, back to camera): every non-furniture pixel connected to its head in the right part.
   orange (left, facing front-right): head/body above the table top + its paws over the table (no table wood)."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S='/home/claude/pipe/stations'; O='/home/claude/new4'
def hsv(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6; r,g,b=f[...,0],f[...,1],f[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h, np.where(mx>0,d/np.maximum(mx,1e-6),0), mx
for k in range(3):
    a=np.array(Image.open(f'{S}/dine_pair_{k}.png')); H,W=a.shape[:2]; al=a[...,3]>40
    h,s,v=hsv(a); X=np.arange(W)[None,:].repeat(H,0); Y=np.arange(H)[:,None].repeat(W,1)
    chair=al&((h<14)|(h>335))&(s>0.45)&(v>0.35)
    wood=al&(h>=34)&(h<56)&(s>0.25)&(v>0.5)
    brown=al&(h>=10)&(h<40)&(s>0.3)&(v<0.6)
    plate=al&(s<0.12)&(v>0.85)&(Y>H*0.5)&(X>W*0.3)&(X<W*0.56)
    blk=v<0.25
    furn=chair|wood|brown
    # gray cat: right half, non furniture; seed = gray fur near the top right
    gm=al&~furn&~plate&(X>W*0.45)
    gm=nd.binary_opening(gm,iterations=1)
    lab,n=nd.label(gm); seeds=set(np.unique(lab[:int(H*0.35),int(W*0.55):]))-{0}
    sz={i:(lab==i).sum() for i in seeds}; seed=max(sz,key=sz.get)
    g=lab==seed; g=nd.binary_closing(g,iterations=2)&al&~chair
    # orange cat: left part; above table top line (wood rows) plus orange/green/white non-wood pixels
    om=al&~chair&~(wood&(Y>H*0.42))&~brown&~plate&(X<W*0.62)&~g
    om=nd.binary_opening(om,iterations=1)
    lab,n=nd.label(om); seeds=set(np.unique(lab[:int(H*0.3),:int(W*0.45)]))-{0}
    sz={i:(lab==i).sum() for i in seeds}; seed=max(sz,key=sz.get)
    o=lab==seed; o=nd.binary_closing(o,iterations=3)&al&~chair&~(wood&(Y>H*0.45))
    for nm,m in [('gray',g),('orange',o)]:
        # restore outline pixels hugging the cut
        m=nd.binary_fill_holes(m)&al
        if nm=='orange':
            pl=al&(s<0.15)&(v>0.75)&(Y>H*0.42)&(X>W*0.3)
            m&=~(wood&(Y>H*0.40))&~pl&~brown
            m=nd.binary_opening(m,iterations=1)
        lab2,n2=nd.label(m); m=lab2==(np.argmax(nd.sum(m,lab2,range(1,n2+1)))+1)
        m=m|(nd.binary_dilation(m,iterations=2)&blk&al&~chair)
        out=a.copy(); out[...,3]=np.where(m,a[...,3],0); Image.fromarray(out).save(f'{O}/solo_{nm}_{k}.png')
