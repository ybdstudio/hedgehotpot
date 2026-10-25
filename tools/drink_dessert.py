"""Drink / Dessert counters rebuilt on the open-shelf counter (st4_maki_0) so finished drinks/desserts sit on the lower shelf
   like the other stations. The original counter-top items (register + dispenser / pots + oven) are cut out and placed on top."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
def hsv(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6
    h=np.where(mx==f[...,0],((f[...,1]-f[...,2])/d)%6,np.where(mx==f[...,1],(f[...,2]-f[...,0])/d+2,(f[...,0]-f[...,1])/d+4))*60
    return h,d/np.maximum(mx,1e-6),mx
def items(path, top_rows, counter):
    a=np.array(Image.open(path).convert('RGBA')); H,W=a.shape[:2]; h,s,v=hsv(a); al=a[...,3]>40
    Y=np.arange(H)[:,None].repeat(W,1)
    if counter=='wood': surf=al&(h>15)&(h<45)&(s>0.45)&(v>0.55)
    else: surf=al&(((s<0.2)&(v>0.72))|((h>20)&(h<45)&(s<0.35)&(v>0.6)))
    # counter-top surface = the big region of that colour touching the band bottom
    lab,n=nd.label(surf&(Y<top_rows+12)); sz=nd.sum(surf,lab,range(1,n+1))
    big=np.isin(lab,[i+1 for i,z in enumerate(sz) if z>0.08*sz.max()]) if n else np.zeros_like(surf)
    m=al&(Y<top_rows)&~big
    m=nd.binary_opening(m,iterations=2 if counter=='white' else 1)
    lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); m=np.isin(lab,[i+1 for i,z in enumerate(sz) if z>25])
    m=nd.binary_fill_holes(m)
    if counter=='white':   # drop the thin slab edge: keep only blobs that are taller than 6 px
        lab,n=nd.label(m); keep=[i+1 for i,sl in enumerate(nd.find_objects(lab)) if sl[0].stop-sl[0].start>8]; m=np.isin(lab,keep)
    o=a.copy(); o[...,3]=np.where(m,a[...,3],0); im=Image.fromarray(o); return im.crop(im.getbbox())
base=Image.open('stations/st4_maki_0.png').convert('RGBA')
out={}
for name,src,rows,ctype,w,pos in [('drink','env/71.png',24,'wood',0.62,(0.5,0.17)),('dessert','env/36.png',44,'white',0.78,(0.48,0.2))]:
    it=items(src,rows,ctype); sc=base.width*w/it.width; it=it.resize((round(it.width*sc),round(it.height*sc)),Image.LANCZOS)
    c=base.copy(); x=int(base.width*pos[0]-it.width/2); y=int(base.height*pos[1]-it.height*0.75)
    pad=max(0,-y); cv=Image.new('RGBA',(base.width,base.height+pad),(0,0,0,0)); cv.alpha_composite(c,(0,pad)); cv.alpha_composite(it,(x,y+pad))
    cv.save(f'stations/st5_{name}.png'); out[name]=cv; print(name,cv.size,pad)
c=Image.new('RGBA',(sum(i.width for i in out.values())+20,max(i.height for i in out.values())),(200,225,200,255)); x=0
for i in out.values(): c.alpha_composite(i,(x,0)); x+=i.width+20
c.resize((c.width*2,c.height*2)).save(S+'/st5.png')
