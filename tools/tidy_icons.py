"""Remove fragments of neighbouring items that were caught in an icon's crop box (small blobs touching the border),
   then trim to the content. Backs up originals to bak_icons/."""
import numpy as np, os, shutil, sys
from PIL import Image
from scipy import ndimage as nd
os.makedirs('bak_icons',exist_ok=True)
ENV_ICONS=[29,30,31,45,50,52,27,26,54,66,67,68,69,62,63,64]
paths=[f'cp/{k}' for k in sorted(os.listdir('cp'))]+[f'env/{i}.png' for i in ENV_ICONS]
for p in paths:
    b=f"bak_icons/{p.replace('/','_')}"
    if not os.path.exists(b): shutil.copy(p,b)
    im=Image.open(b).convert('RGBA'); a=np.array(im); m=a[...,3]>30
    lab,n=nd.label(m,structure=np.ones((3,3)))
    if n<2: continue
    sz=nd.sum(m,lab,range(1,n+1)); big=sz.max()
    H,W=m.shape; drop=[]
    for i in range(n):
        ys,xs=np.nonzero(lab==i+1)
        border=xs.min()==0 or ys.min()==0 or xs.max()==W-1 or ys.max()==H-1
        if (border and sz[i]<0.2*big) or sz[i]<0.004*big: drop.append(i+1)
    if not drop: continue
    kill=np.isin(lab,drop); kill=nd.binary_dilation(kill,iterations=1)&~np.isin(lab,[i+1 for i in range(n) if i+1 not in drop])
    a[...,3]=np.where(kill,0,a[...,3]); o=Image.fromarray(a); bb=o.getbbox(); o=o.crop(bb); o.save(p)
    print(p,'dropped',len(drop),'blobs',im.size,'->',o.size)
