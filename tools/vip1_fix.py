import numpy as np, json, os, sys
from PIL import Image
from scipy import ndimage as nd
F='frames'; SC='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
def hsv(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6; r,g,b=f[...,0],f[...,1],f[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h, np.where(mx>0,d/np.maximum(mx,1e-6),0), mx
def strip(a, name):
    H,W=a.shape[:2]; al=a[...,3]>40
    h,s,v=hsv(a); Y=np.arange(H)[:,None].repeat(W,1); X=np.arange(W)[None,:].repeat(H,0)
    red=al&((h<10)|(h>350))&(s>0.6)&(v>0.35)&(Y>H*0.5)            # couch (hat band is above 0.5H)
    red|=al&((h<14)|(h>345))&(s>0.5)&(X<W*0.17)&(Y>H*0.35)       # left couch arm
    red|=al&((h<14)|(h>345))&(s>0.5)&(X>W*0.78)&(Y>H*0.35)       # right couch arm
    wood=al&(h>5)&(h<38)&(s>0.3)&(v<0.7)&(v>0.12)&(Y>H*0.62)&(X>W*0.55)
    gold=al&(h>30)&(h<55)&(s>0.5)&(Y>H*0.9)
    glass=al&(X>W*0.715)&(Y>H*0.25)                                  # big glass + straw + table top on the right
    tan=al&(h>8)&(h<42)&(s>0.22)&(v>0.4)&(Y>H*0.72)&(X>W*0.5)               # table top / fur-coloured remnants below the face
    red2=al&((h<12)|(h>345))&(s>0.45)&(Y>H*0.5)
    kill=red|wood|gold|glass|tan
    kill=nd.binary_closing(kill,iterations=1)&al
    m=al&~kill
    m=nd.binary_opening(m,iterations=1)
    lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1))
    keep=np.isin(lab,[i+1 for i,z in enumerate(sz) if z>0.06*max(sz)])
    # drop dark outline bits hugging the right/bottom furniture edge
    o=a.copy(); o[...,3]=np.where(keep,a[...,3],0); return o
if __name__=='__main__':
    M=json.load(open(f'{F}/meta.json')); out=[]
    for an in ['sit','drink']:
        for fr in M['vip1'][an]['front']:
            a=np.array(Image.open(f'{F}/vip1/{an}/{fr["f"]}').convert('RGBA'))
            out.append(Image.fromarray(strip(a,fr['f'])))
    W=sum(i.width for i in out); H=max(i.height for i in out)
    c=Image.new('RGBA',(W,H),(200,230,200,255)); x=0
    for i in out: c.alpha_composite(i,(x,0)); x+=i.width
    c.resize((c.width*2,c.height*2),Image.NEAREST).save(f'{SC}/v1new.png')
