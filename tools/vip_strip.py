"""Strip the baked couch (and VIP1's side table) from the VIP seated/drinking frames so the new sofa + round table
   sprites can be drawn around the same seated cat. Writes *_cat.png next to originals (front-facing frames only)."""
import numpy as np, json, os
from PIL import Image
from scipy import ndimage as nd
F='frames'; M=json.load(open(f'{F}/meta.json'))
def hsv(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6; r,g,b=f[...,0],f[...,1],f[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h, np.where(mx>0,d/np.maximum(mx,1e-6),0), mx
jobs=[('vip1','sit','front'),('vip1','drink','front'),('vip2','sit','front'),('vip2','drink','all')]
os.makedirs('/home/claude/new6/vipcat',exist_ok=True)
for ch,an,d in jobs:
    for fr in M[ch][an][d]:
        a=np.array(Image.open(f'{F}/{ch}/{an}/{fr["f"]}').convert('RGBA')); H,W=a.shape[:2]; al=a[...,3]>40
        h,s,v=hsv(a); Y=np.arange(H)[:,None].repeat(W,1); X=np.arange(W)[None,:].repeat(H,0)
        couch=al&((h<9)|(h>353))&(s>0.74)&(v>0.45)&(Y>H*(0.45 if ch=='vip1' else 0.55))
        couch|=al&((h<12)|(h>345))&(s>0.6)&((X<W*0.2)|(X>W*0.84))&(Y>H*0.35)   # couch back / arm corners
        gold=al&(h>30)&(h<55)&(s>0.5)&(Y>H*0.85)
        wood=al&(h>8)&(h<35)&(s>0.35)&(v<0.62)&(v>0.15)&(Y>H*0.6)&(X>W*0.5) if ch=='vip1' else np.zeros_like(al)
        kill=couch|gold|wood
        kill=nd.binary_closing(kill,iterations=2)&al
        # dark outlines that only border furniture
        dark=al&(v<0.25)
        kill|=dark&nd.binary_dilation(kill,iterations=2)&~nd.binary_dilation(al&~kill&~dark,iterations=1)
        m=al&~kill
        m=nd.binary_opening(m,iterations=1)
        lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1))
        keep=np.isin(lab,[i+1 for i,z in enumerate(sz) if z>0.08*sz.max()])
        o=a.copy(); o[...,3]=np.where(keep,a[...,3],0)
        Image.fromarray(o).save(f'/home/claude/new6/vipcat/{ch}_{an}_{fr["f"]}')
print('ok')

# install as separate anims (sit_cat / drink_cat) with the original anchors
for ch,an,d in jobs:
    na=an+'_cat'; os.makedirs(f'{F}/{ch}/{na}',exist_ok=True); M[ch][na]={d:[]}
    for fr in M[ch][an][d]:
        Image.open(f'/home/claude/new6/vipcat/{ch}_{an}_{fr["f"]}').save(f'{F}/{ch}/{na}/{fr["f"]}'); M[ch][na][d].append(dict(fr))
json.dump(M,open(f'{F}/meta.json','w')); print('installed')
