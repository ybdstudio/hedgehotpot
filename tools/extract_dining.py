"""Dining table v2: empty table+2 chairs sprite, and 3-frame 'two cats eating at the table' sheet.
   The checker background is removed; then each composite frame is registered onto the empty table and differenced
   to isolate the left (orange, faces front-right) and right (gray, faces back-left) seated customers."""
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'; O='/home/claude/new4'
def cut(rgb):
    r,g,b=[rgb[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=rgb.max(-1).astype(int)-rgb.min(-1)
    bg=(lum>180)&(sat<24)
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
    lab,n=nd.label(fg); sz=nd.sum(fg,lab,range(1,n+1)); fg=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>0.01*sz.max()])
    al=(fg*255).astype(np.uint8); edge=fg&~nd.binary_erosion(fg); al[edge&(lum>200)]=110
    return al
t=np.array(Image.open(U+'46986f9e-image.png').convert('RGB')); ta=cut(t)
ys,xs=np.where(ta>0); T=np.dstack([t,ta])[ys.min():ys.max()+1,xs.min():xs.max()+1]
Image.fromarray(T).save(f'{O}/table2.png'); print('table',T.shape)
c=np.array(Image.open(U+'b44d2484-image.png').convert('RGB')); ca=cut(c)
# split into 3 frames at the emptiest columns near the thirds
colsum=(ca>0).sum(0); W=len(colsum)
cuts=[0]+[int(np.argmin(colsum[int(W*f)-30:int(W*f)+30])+int(W*f)-30) for f in (1/3,2/3)]+[W]
print('cuts',cuts, [colsum[c] for c in cuts[1:-1]])
for k in range(3):
    x0,x1=cuts[k],cuts[k+1]; sub=np.dstack([c,ca])[:,x0:x1].copy()
    lab,n=nd.label(sub[...,3]>0); sz=nd.sum(sub[...,3]>0,lab,range(1,n+1)); keep=np.isin(lab,[i+1 for i,v in enumerate(sz) if v>0.02*sz.max()]); sub[~keep,3]=0
    ys,xs=np.where(sub[...,3]>0); sub=sub[ys.min():ys.max()+1,xs.min():xs.max()+1]
    Image.fromarray(sub).save(f'{O}/combo_{k}.png'); print(k,sub.shape)
