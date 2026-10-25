"""Isolate the chef (incl. hands/sushi over the counter) from the chef-at-salmon-station frames by differencing
against the empty salmon station, so the same chef pose can be drawn behind the tuna station too."""
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd
D='/home/claude/new2'
REG={0:(0.99,0,2),1:(0.97,-2,4),2:(0.98,-2,2),3:(0.97,-2,3)}
base=np.array(Image.open(f'{D}/st_salmon_0.png').convert('RGBA')).astype(np.float32)
for k,(sc,dy,dx) in REG.items():
    c=np.array(Image.open(f'{D}/st_chef_{k}.png').convert('RGBA')).astype(np.float32); H,W=c.shape[:2]
    b=cv2.resize(base,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
    canvas=np.zeros_like(c); y0=H-b.shape[0]+dy
    xs=max(0,dx); xe=min(W,dx+b.shape[1]); canvas[y0:y0+b.shape[0],xs:xe]=b[:,xs-dx:xe-dx]
    diff=np.abs(c[...,:3]-canvas[...,:3]).max(-1)
    diff=cv2.GaussianBlur(diff,(5,5),0)
    m=((diff>70)|(canvas[...,3]<40))&(c[...,3]>40)
    m=nd.binary_opening(m,iterations=2)
    lab,n=nd.label(m)
    # keep the component(s) that reach into the top 25% (the chef's head/hat)
    top=set(np.unique(lab[:int(H*0.25)]))-{0}
    m=np.isin(lab,list(top)); m=nd.binary_fill_holes(m); m=nd.binary_dilation(m,iterations=2)&(c[...,3]>40)
    # keep only the chef's column window; below the shoulders only the paws/sushi zone (no table rims or fish box)
    hy,hx=np.where(m[:int(H*0.30)]); x0,x1=hx.min(),hx.max(); cx=(x0+x1)/2
    X=np.arange(W)[None,:].repeat(H,0); Y=np.arange(H)[:,None].repeat(W,1)
    sh=int(H*0.42)                                   # roughly shoulder / counter-back line
    win=(X>=x0-18)&(X<=x1+28)&((Y<sh-14)|((Y<sh)&(X>=cx-40))|((Y<sh+62)&(X>=cx-55)&(X<=cx+75)))
    m=m&win
    lab,n=nd.label(m); top=set(np.unique(lab[:int(H*0.25)]))-{0}; m=np.isin(lab,list(top))
    out=c.copy(); out[...,3]=np.where(m,c[...,3],0)
    Image.fromarray(out.astype(np.uint8)).save(f'{D}/chefcut_{k}.png')
    print(k,'table top y in frame',y0)

    # tuna variant: recolor the held salmon nigiri (saturated orange flesh, below the chin) to tuna red
    a=out.copy(); r,g,b=a[...,0],a[...,1],a[...,2]
    flesh=(k in (1,2))&(a[...,3]>0)&(Y>int(H*0.30))&(r>170)&(g<0.62*r)&(b<0.55*r)&(X>=cx-60)
    a[...,0]=np.where(flesh,np.minimum(255,r*0.92),r); a[...,1]=np.where(flesh,g*0.28,g); a[...,2]=np.where(flesh,b*0.55+12,b)
    # white fat stripes on salmon -> soft pink on tuna is fine as is
    Image.fromarray(a.astype(np.uint8)).save(f'{D}/chefcut_tuna_{k}.png')
