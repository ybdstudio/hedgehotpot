"""Build an empty dining table from the single-guest sheet (frame R_0) so the empty / 1-guest / 2-guest states share one table:
   remove the cat + plates, rebuild the hidden table top / side face, keep chairs."""
import numpy as np, cv2, sys
from PIL import Image
from scipy import ndimage as nd
from matplotlib.path import Path
S='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
a=np.array(Image.open('stations/dine_one_R_0.png').convert('RGBA')); H,W=a.shape[:2]
f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6; r,g,b=f[...,0],f[...,1],f[...,2]
h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60; s=d/np.maximum(mx,1e-6); al=a[...,3]>40
Y,X=np.mgrid[0:H,0:W]
def poly(p): return Path(p).contains_points(np.c_[X.ravel(),Y.ravel()]).reshape(H,W)
Lc=np.array([38,134]); Fc=np.array([113,170]); back=np.array([float(v) for v in sys.argv[1:3]]) if len(sys.argv)>2 else np.array([92,-44]); T=int(sys.argv[3]) if len(sys.argv)>3 else 11
Bc=Lc+back; Rc=Fc+back
P=poly([Lc,Bc,Rc,Fc]); F=poly([Fc,Rc,Rc+[0,T],Fc+[0,T]])
chair=al&(((h<16)|(h>340))&(s>0.55))
chair=nd.binary_opening(chair,iterations=1)
lab,n=nd.label(chair); sz=nd.sum(chair,lab,range(1,n+1)); chair=np.isin(lab,[i+1 for i,z in enumerate(sz) if z>300])   # only the two chairs, not the soy-sauce dish
top=al&(h>38)&(h<62)&(s>0.15)&(s<0.65)&(mx>0.8)
# everything that is the cat or a dish: above the table's lower boundary, right of the visible top, not chair
low=poly([Lc+[0,T],Fc+[0,T],Rc+[0,T],Rc+[60,T],[W,0],[0,0],Lc-[40,0]])
cat=al&~chair&low&(X>108)
dish=P&~top&~nd.binary_dilation(~P,iterations=3)
dish=nd.binary_dilation(dish,iterations=1)&P
fill=(cat|dish)&(nd.binary_dilation(P|F,iterations=1))
gone=cat&~nd.binary_dilation(P|F,iterations=1)
o=a.copy()
# legs / shirt of the cat still showing between the chair and the table base
extra=al&~chair&(X>118)&(X<200)&(Y>140)&(Y<195)&(((h>65)&(h<175)&(s>0.25))|((h>24)&(h<44)&(s>0.4)&(mx>0.9))|((s<0.12)&(mx>0.85)))
gone|=extra&~(P|F)
def fitcol(mask):   # least-squares colour plane c = k0 + k1 x + k2 y over visible pixels
    yy,xx=np.nonzero(mask); A=np.c_[np.ones(len(xx)),xx,yy]
    return [np.linalg.lstsq(A,a[yy,xx,k].astype(float),rcond=None)[0] for k in range(3)]
def paint(region,coef,noise=0):
    yy,xx=np.nonzero(region)
    for k in range(3): o[yy,xx,k]=np.clip(coef[k][0]+coef[k][1]*xx+coef[k][2]*yy,0,255)
    o[yy,xx,3]=255
vis_top=top&P&~nd.binary_dilation(~P,iterations=2)
paint(fill&P,fitcol(vis_top))
vis_face=al&~chair&poly([Lc,Fc,Fc+[0,T],Lc+[0,T]])&(h>10)&(h<45)&(s>0.4)
paint(F&~P&~chair&(X>116),fitcol(vis_face) if vis_face.sum()>20 else [[c*0.8,0,0] for c in (230,160,80)])
o[...,3]=np.where(gone,0,o[...,3])
box=(X>=118)&(X<=200)&(Y>=150)&(Y<=190)&~chair&~P&~F&(((s<0.25)&(mx>0.6))|((X>=135)&(X<=172)&(mx>0.5))); o[box,3]=0   # cat tail / foot under the right chair
sl=(X>=104)&(X<=118)&(Y>=162)&(Y<=184)&(s<0.18)&(mx>0.75)&al; yy,xx=np.nonzero(sl)
for y0,x0 in zip(yy,xx): o[y0,x0,:3]=o[y0,x0-6,:3]   # white sliver at the table's front corner
edge=(nd.binary_dilation(P|F,iterations=1)&~(P|F))|(P&nd.binary_dilation(F,iterations=1)&~nd.binary_erosion(P,iterations=1))
edge&=nd.binary_dilation(fill,iterations=2)&~chair
o[edge]=[70,35,20,255]
o[...,3]=np.where(chair,a[...,3],o[...,3]); o[chair,:3]=a[chair,:3]
seat=(X>=136)&(X<=182)&(Y>=163)&(Y<=186)&(o[...,3]<40)&nd.binary_fill_holes(o[...,3]>40)   # gap between the right chair's back and seat (the cat sat there): seat top
seat|=(X>=136)&(X<=182)&(Y>=163)&(Y<=186)&(o[...,3]<40)&(Y>=170)
o[seat]=[196,44,38,255]
Image.fromarray(o).save('stations/dine_empty_new.png')
c=Image.new('RGBA',(W,H),(200,225,200,255)); c.alpha_composite(Image.fromarray(o))
c2=Image.new('RGBA',(W,H),(200,225,200,255)); c2.alpha_composite(Image.fromarray(a))
out=Image.new('RGBA',(W*2+10,H),(255,255,255,255)); out.paste(c2,(0,0)); out.paste(c,(W+10,0)); out.resize((out.width*2,out.height*2),Image.NEAREST).save(f'{S}/empty_new.png')
if '--dbg' in sys.argv:
    for nm in ['P','top','dish','fill','gone','chair','al']:
        print(nm, bool(eval(nm)[127,82]))
