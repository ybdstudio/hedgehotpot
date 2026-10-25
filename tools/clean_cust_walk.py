"""Customer walk frames: drop fragments of neighbouring sheet rows (feet floating above the head / bits under the feet),
   keep the body's main connected shape; replace the one frame whose head interior was lost in extraction."""
import numpy as np, json, shutil, os
from PIL import Image
from scipy import ndimage as nd
F='frames'; M=json.load(open(f'{F}/meta.json'))
def cut_top(a):
    # a stray block of the row above sits on top of the ears: ears start as narrow tips, a stray block starts wide
    m=a[...,3]>30; H,W=m.shape; rows=m.sum(1); nz=np.where(rows>0)[0]
    if not len(nz): return 0
    t0=nz[0]
    if rows[t0:t0+3].max()<0.16*W: return 0
    lo,hi=t0+3,t0+int(0.32*H); r=lo+int(np.argmin(rows[lo:hi]))
    a[:r+1,:,3]=0; return 1
def strip_checker(a):
    # leftover checker-background fringe (light, unsaturated) reachable from the transparent outside
    rgb=a[...,:3].astype(int); lum=(rgb[...,0]*30+rgb[...,1]*59+rgb[...,2]*11)/100; sat=rgb.max(-1)-rgb.min(-1)
    chk=(a[...,3]>0)&(lum>160)&(sat<30)
    out=a[...,3]==0
    reach=nd.binary_propagation(nd.binary_dilation(out)&chk, mask=chk|out)&chk
    a[reach,3]=0; return int(reach.sum())
def clean(path):
    im=Image.open(path).convert('RGBA'); a=np.array(im)
    strip_checker(a)
    c=cut_top(a)
    Image.fromarray(a).save(path)
    m=a[...,3]>30
    er=nd.binary_erosion(m,iterations=3)
    lab,n=nd.label(er)
    if n<=1: return 0
    sz=nd.sum(er,lab,range(1,n+1)); main=np.argmax(sz)+1
    ys,xs=np.where(lab==main); top,bot=ys.min(),ys.max()
    keepseed=lab==main
    for i in range(1,n+1):
        if i==main: continue
        yy,xx=np.where(lab==i); cy=yy.mean()
        if sz[i-1]>0.06*sz[main-1] and top+0.08*(bot-top)<cy<bot-0.02*(bot-top): keepseed|=lab==i
    keep=nd.binary_dilation(keepseed,iterations=4)&(a[...,3]>0)
    drop=(a[...,3]>0)&~keep
    if drop.sum()<15: return 0
    a[drop,3]=0; Image.fromarray(a).save(path); return 1
tot=0
for ch in ['cust_gray','cust_orange','vip1','vip2']:
    for an in ['walk','idle']:
        if an not in M.get(ch,{}): continue
        for d,lst in M[ch][an].items():
            for fr in lst:
                p=f'{F}/{ch}/{an}/{fr["f"]}'
                if os.path.exists(p): tot+=clean(p)
# orange front_right walk frame 3 lost its head interior during extraction -> reuse frame 2
shutil.copy(f'{F}/cust_orange/walk/front_right_2.png',f'{F}/cust_orange/walk/front_right_3.png')
M['cust_orange']['walk']['front_right'][3]=dict(M['cust_orange']['walk']['front_right'][2],f='front_right_3.png')
json.dump(M,open(f'{F}/meta.json','w')); print('fragments removed',tot)
