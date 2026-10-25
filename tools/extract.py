import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def load(path):
    return np.array(Image.open(path).convert('RGB')).astype(np.int16)

def pink_mask(a):
    R,G,B=a[...,0],a[...,1],a[...,2]
    return (R>232)&(G>180)&(G<230)&(B>175)&(B<225)&(R-G>18)

def comps(mask,min_area):
    lab,n=ndi.label(mask)
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab)):
        area=(lab[sl]==i+1).sum()
        if area>=min_area:
            out.append(((sl[1].start+sl[1].stop)/2,(sl[0].start+sl[0].stop)/2,sl))
    return out

def detect_grid(a, left_w=230, top_h=130, min_area=900):
    pm=pink_mask(a)
    H,W=pm.shape
    L=np.zeros_like(pm); L[top_h-20:,:left_w]=pm[top_h-20:,:left_w]
    T=np.zeros_like(pm); T[:top_h,left_w-30:]=pm[:top_h,left_w-30:]
    rows=sorted(c[1] for c in comps(ndi.binary_closing(L,iterations=3),min_area))
    cols=sorted(c[0] for c in comps(ndi.binary_closing(T,iterations=3),min_area))
    return rows,cols

def extract(a, cx, cy, w, h, dark_thr=95, dil=2, keep_frac=0.12, fill_max=900, tight=0, bgsat=None, bglum=170):
    H,W=a.shape[:2]
    x0,x1=int(max(0,cx-w/2)),int(min(W,cx+w/2)); y0,y1=int(max(0,cy-h/2)),int(min(H,cy+h/2))
    win=a[y0:y1,x0:x1]
    lum=(win[...,0]*30+win[...,1]*59+win[...,2]*11)/100
    dark=lum<dark_thr
    barrier=ndi.binary_dilation(dark,iterations=dil)
    free=~barrier
    if bgsat is not None:
        sat=win.max(-1)-win.min(-1)
        free=free&(lum>bglum)&(sat<bgsat)
    lab,n=ndi.label(free)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    fg=~bg
    fg=fg & ~(ndi.binary_dilation(bg,iterations=dil) & ~dark)
    fg=ndi.binary_fill_holes(ndi.binary_opening(fg,iterations=1)) if False else fg
    lab2,n2=ndi.label(fg)
    if n2==0: return None
    areas=ndi.sum(fg,lab2,range(1,n2+1))
    cms=ndi.center_of_mass(fg,lab2,range(1,n2+1))
    hc,wc=fg.shape[0]/2,fg.shape[1]/2
    # main: big and near center
    score=[areas[i]/(1+((cms[i][0]-hc)**2+(cms[i][1]-wc)**2)/(0.25*(hc*hc+wc*wc))) for i in range(n2)]
    m=int(np.argmax(score))
    keep=np.zeros(n2+1,bool); keep[m+1]=True
    mb=ndi.find_objects(lab2)[m]
    for i in range(n2):
        if areas[i]>=keep_frac*areas[m]:
            sl=ndi.find_objects(lab2)[i]
            # overlaps main horizontally and vertically within window centre zone
            cy_,cx_=cms[i]
            touch = sl[0].start==0 or sl[1].start==0 or sl[0].stop>=fg.shape[0] or sl[1].stop>=fg.shape[1]
            if abs(cx_-wc)<wc*0.75 and abs(cy_-hc)<hc*0.75 and not touch: keep[i+1]=True
    mask=keep[lab2]
    # fill small enclosed holes (leaks through outline gaps), keep big real gaps
    holes=ndi.binary_fill_holes(mask)&~mask
    hl,hn=ndi.label(holes)
    if hn:
        hs=ndi.sum(holes,hl,range(1,hn+1))
        small=np.zeros(hn+1,bool); small[1:]=hs<fill_max
        mask=mask|small[hl]
    if tight:
        ys,xs=np.nonzero(mask); t0=ys.min(); t1=t0+int((ys.max()-t0)*tight)
        vd=(lum<62)&mask
        shoes=ndi.binary_opening(vd,iterations=3)
        band=np.zeros_like(mask); band[t0:t1]=True
        sl,sn=ndi.label(shoes&band)
        rm=np.zeros_like(mask)
        for i,o in enumerate(ndi.find_objects(sl)):
            if o[0].start<t0+int((ys.max()-t0)*0.12): rm|=(sl==i+1)
        rm=ndi.binary_dilation(rm,iterations=4)&mask
        mask=mask&~rm
        l3,n3=ndi.label(ndi.binary_opening(mask,iterations=1))
        if n3>1:
            s3=ndi.sum(mask,l3,range(1,n3+1)); big=int(np.argmax(s3))+1
            mask=mask&ndi.binary_dilation(l3==big,iterations=2)
    ys,xs=np.nonzero(mask)
    by0,by1,bx0,bx1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    rgba=np.zeros((by1-by0,bx1-bx0,4),np.uint8)
    rgba[...,:3]=win[by0:by1,bx0:bx1]
    al=mask[by0:by1,bx0:bx1].astype(np.float32)
    # soft 1px feather
    soft=ndi.uniform_filter(al,3)
    al=np.where(al>0,np.maximum(soft,0.55),0)
    rgba[...,3]=(np.clip(al*1.0,0,1)*255).astype(np.uint8)
    rgba[...,3][mask[by0:by1,bx0:bx1]&ndi.binary_erosion(mask,iterations=1)[by0:by1,bx0:bx1]]=255
    return Image.fromarray(rgba), (x0+bx0, y0+by0)

def head_anchor(img):
    a=np.array(img)[...,3]>128
    ys,xs=np.nonzero(a)
    h=ys.max()-ys.min()
    top=a[ys.min():ys.min()+int(h*0.45)]
    ty,tx=np.nonzero(top)
    return float(tx.mean()), int(ys.max())

def peaks(a,x0,y0,x1,y1,n,axis=0,thr=95,smooth=25):
    win=a[y0:y1,x0:x1]
    lum=(win[...,0]*30+win[...,1]*59+win[...,2]*11)/100
    d=(lum<thr).sum(axis=axis).astype(float)
    d=ndi.uniform_filter1d(d,smooth)
    off=x0 if axis==0 else y0
    # greedy peak pick with min distance
    L=len(d); mind=L/(n*1.6)
    idx=np.argsort(-d); pk=[]
    for i in idx:
        if all(abs(i-p)>mind for p in pk): pk.append(i)
        if len(pk)==n: break
    return sorted(int(p+off) for p in pk)
