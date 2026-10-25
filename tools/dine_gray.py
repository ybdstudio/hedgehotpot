"""Gray guest alone at a dining table: recolour the orange cat of the single-guest sheet (right chair) to the gray cat
   (gray fur, blue shirt). The table pixels are untouched (mask = difference from the rebuilt empty table)."""
import numpy as np, colorsys
from PIL import Image
from scipy import ndimage as nd
S='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
E=np.array(Image.open('stations/dine_one_empty.png').convert('RGBA')).astype(int)
def hsv(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6; r,g,b=f[...,0],f[...,1],f[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60; return h,d/np.maximum(mx,1e-6),mx
outs=[]
for i in range(8):
    a=np.array(Image.open(f'stations/dine_one_R_{i}.png').convert('RGBA')).astype(int)
    diff=(np.abs(a[...,:3]-E[...,:3]).sum(-1)>60)|((E[...,3]<40)&(a[...,3]>40))
    Y=np.arange(a.shape[0])[:,None]; X=np.arange(a.shape[1])[None,:]
    cat=diff&(a[...,3]>40)&(X>110)
    cat=nd.binary_opening(cat,iterations=1)
    lab,n=nd.label(cat); sz=nd.sum(cat,lab,range(1,n+1)); cat=lab==(1+int(np.argmax(sz)))   # the cat is the one big blob that differs from the empty table
    cat=nd.binary_dilation(cat,iterations=1)&(a[...,3]>40)
    h,s,v=hsv(a)
    fur=cat&(h>8)&(h<50)&(s>0.18)&(X>118)&~((h<23)&(s>0.82))
    shirt=cat&(h>55)&(h<185)&(s>0.15)&(X>138)&(Y>112)
    o=a.copy().astype(float)
    # fur -> gray (keep shading): luminance mapped to a cool gray ramp, top of head darker like the gray cat
    L=(0.3*a[...,0]+0.59*a[...,1]+0.11*a[...,2])/255
    g=np.clip(L*0.78+0.02,0,1)
    for k,t in enumerate((0.96,0.98,1.04)): o[...,k]=np.where(fur,g*255*t,o[...,k])
    # shirt -> blue overalls
    for k,c in enumerate((70,110,200)): o[...,k]=np.where(shirt,np.clip(c*(v*1.15),0,255),o[...,k])
    o=np.clip(o,0,255).astype(np.uint8)
    Image.fromarray(o).save(f'stations/dine_one_G_{i}.png'); outs.append(o)
c=np.concatenate(outs[::2],1); bg=Image.new('RGBA',(c.shape[1],c.shape[0]),(200,225,200,255)); bg.alpha_composite(Image.fromarray(c)); bg.resize((bg.width*2,bg.height*2),Image.NEAREST).save(f'{S}/gray_one.png')
