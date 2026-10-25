"""Remove the baked-in counter/belt/plates from the counter-eat frames, keeping cat + stool + paws + held sushi.
   The counter's left edge is found as a line fitted to the left boundary of the largest wood-coloured region
   (the counter front face); right of it everything goes except cat-coloured pixels in a narrow band (paws/chopsticks/
   held sushi) that stay connected to the body."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
D='/home/claude/new2'
def hsv(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6
    r,g,b=f[...,0],f[...,1],f[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    s=np.where(mx>0,d/np.maximum(mx,1e-6),0); return h,s,mx
def strip(path,out,band=46):
    a=np.array(Image.open(path).convert('RGBA')); H,W=a.shape[:2]
    h,s,v=hsv(a); al=a[...,3]>0
    X=np.arange(W)[None,:].repeat(H,0); Y=np.arange(H)[:,None].repeat(W,1)
    wood=al&(h>12)&(h<45)&(s>0.40)&(v>0.28)&(v<0.86)
    lab,n=nd.label(wood); sz=nd.sum(wood,lab,range(1,n+1)); face=lab==(np.argmax(sz)+1)
    ys=[];xs=[]
    for y in range(H):
        r=np.where(face[y])[0]
        if len(r)>8: ys.append(y); xs.append(r.min())
    ys=np.array(ys); xs=np.array(xs)
    # robust line x = a*y + b
    best=None
    rng=np.random.default_rng(1)
    for _ in range(300):
        i,j=rng.choice(len(ys),2,replace=False)
        if ys[i]==ys[j]: continue
        A=(xs[j]-xs[i])/(ys[j]-ys[i]); B=xs[i]-A*ys[i]
        inl=np.abs(xs-(A*ys+B))<4
        if best is None or inl.sum()>best[0]: best=(inl.sum(),A,B)
    _,A,B=best
    edge=A*Y+B-3
    right=X>=edge
    belt=(v<0.42)&(s<0.55)&(v>0.10)
    plate=(h>185)&(h<240)&(s>0.25)
    sushi=(h>5)&(h<30)&(s>0.45)&(v>0.75)&(v<0.97)            # salmon flesh on the belt (fur is lighter / less saturated)
    blk=v<0.22
    catlike=al&~wood&~belt&~plate&~blk
    # head silhouette: cat pixels above the counter-face top, used to protect the head; paws in a band right of the edge
    keepR=catlike&(X<edge+band)
    keep=al&~right
    keep|=right&keepR&~sushi
    keep|=right&(Y<face.nonzero()[0].min()+6)&catlike&~sushi   # head part over the counter top
    ctop=max(int(0.22*H),np.where((wood|plate)&right&(X>W*0.55))[0].min()-4)                # rows above the counter top: nothing of the counter there
    keep|=al&(Y<ctop)
    keep&=~(wood&(X>edge-10)&(Y>ctop))
    keep=nd.binary_opening(keep,iterations=1)
    lab,n=nd.label(keep); sz=nd.sum(keep,lab,range(1,n+1)); m=lab==(np.argmax(sz)+1)
    # restore dark outline pixels that hug the kept shape inside the counter zone
    ring=nd.binary_dilation(m,iterations=3)&~m&al&blk&right
    m=m|ring
    lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); m=lab==(np.argmax(sz)+1)
    o=a.copy(); o[...,3]=np.where(m,a[...,3],0)
    yy,xx=np.where(m); Image.fromarray(o).crop((xx.min(),yy.min(),xx.max()+1,yy.max()+1)).save(out)
    return A,B
for k in ['cust_gray','cust_orange']:
    for i in range(5): print(k,i,strip(f'{D}/{k}_ce_{i}.png',f'{D}/{k}_ces_{i}.png'))
