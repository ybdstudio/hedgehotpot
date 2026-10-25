"""Single-guest dining table sheets: left seat (orange cat facing front-right) and right seat (orange cat, back view),
   8 eat frames each. Checker bg removed; frames split at the emptiest columns; all frames aligned on the table's
   bottom-right chair leg so the table stays perfectly still while the cat animates."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/716ce21a-image.png'; O='/home/claude/new5'
a=np.array(Image.open(U).convert('RGB')); print(a.shape)
def cut(rgb):
    r,g,b=[rgb[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=rgb.max(-1).astype(int)-rgb.min(-1)
    bg=(lum>175)&(sat<26)
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
    return fg,lum
for side,(y0,y1) in [('L',(195,425)),('R',(540,750))]:
    band=a[y0:y1]; fg,lum=cut(band); W=band.shape[1]
    col=fg.sum(0)
    cuts=[0]+[int(np.argmin(col[int(W*k/8)-25:int(W*k/8)+25])+int(W*k/8)-25) for k in range(1,8)]+[W]
    frames=[]
    for k in range(8):
        x0,x1=cuts[k],cuts[k+1]; m=fg[:,x0:x1].copy()
        lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); main=np.argmax(sz)+1
        ys,xs=np.where(lab==main); top=ys.min()
        keep=lab==main
        for i in range(1,n+1):   # keep sparkle/emote marks above the table, drop neighbour bits at the edges
            if i==main or sz[i-1]<12: continue
            yy,xx=np.where(lab==i)
            if xx.min()>2 and xx.max()<m.shape[1]-3 and yy.mean()<ys.mean(): keep|=lab==i
        al=(keep*255).astype(np.uint8); edge=keep&~nd.binary_erosion(keep); al[edge&(lum[:,x0:x1]>200)]=110
        rgba=np.dstack([band[:,x0:x1],al]); frames.append(rgba)
    # align: bottom-most furniture row, its mean x
    out=[]
    for f in frames:
        m=f[...,3]>60; ys,xs=np.where(m); by=ys.max(); bx=xs[ys>by-6].mean(); out.append((f,bx,by))
    CW,CH=240,250
    for k,(f,bx,by) in enumerate(out):
        can=Image.new('RGBA',(CW,CH),(0,0,0,0)); can.alpha_composite(Image.fromarray(f),(int(round(170-bx)),int(round(CH-4-by))))
        can.save(f'{O}/solo_{side}_{k}.png')
    print(side,'cuts',cuts)
