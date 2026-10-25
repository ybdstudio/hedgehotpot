"""Re-extract tightly stacked 4x8 sprite sheets (rows touch each other) using min-cost seams between rows
   instead of rectangular cells. Writes frames/<ch>/<anim>/<dir>_<i>.png + meta (head-x / foot-y anchor)."""
import numpy as np, json, os, sys
from PIL import Image
from scipy import ndimage as nd
import extract as E
D=['front','front_right','right','back_right','back','back_left','left','front_left']
SC='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
def fgmask(win, dark_thr=95, dil=2, bgsat=26, bglum=170):
    lum=(win[...,0]*30+win[...,1]*59+win[...,2]*11)/100; sat=win.max(-1)-win.min(-1)
    dark=lum<dark_thr; barrier=nd.binary_dilation(dark,iterations=dil)
    free=~barrier&(lum>bglum)&(sat<bgsat)
    lab,n=nd.label(free); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border)); fg=~bg & ~(nd.binary_dilation(bg,iterations=dil)&~dark)
    holes=nd.binary_fill_holes(fg)&~fg; hl,hn=nd.label(holes)
    if hn:
        hs=nd.sum(holes,hl,range(1,hn+1)); small=np.zeros(hn+1,bool); small[1:]=hs<900; fg|=small[hl]
    return fg
def seam(cost, lo, hi):
    """min-cost left->right path with y in [lo,hi), moving at most 1 px per column"""
    c=cost[lo:hi].astype(float); H,W=c.shape; acc=c.copy(); back=np.zeros((H,W),int)
    for x in range(1,W):
        prev=acc[:,x-1]; up=np.r_[np.inf,prev[:-1]]+0.3; dn=np.r_[prev[1:],np.inf]+0.3
        st=np.vstack([up,prev,dn]); k=st.argmin(0); acc[:,x]+=st.min(0); back[:,x]=k-1
    y=int(acc[:,-1].argmin()); path=[0]*W
    for x in range(W-1,-1,-1):
        path[x]=y+lo; y=min(max(y+back[y,x],0),H-1)
    return np.array(path)
SEEDX=0
OV=12
STRAY=2
DBG=0
MIDS=None
CUTS=None
ERASE={'mop':[('front_left',1,(0,0,0.17,0.27)),('front_left',2,(0,0,0.13,0.22)),('back_right',0,(0.68,0,1,0.1))]}
CENTERLOW={}
COLCUTS={('mop',0):[255,363,484,575,691,803,903]}
def run(sheet, ch, an, cols, rows, halfw, y0, y1, dark=95, out=True, mids=None, cuts=None):
    global MIDS, CUTS; MIDS=mids; CUTS=cuts
    a=E.load(sheet).astype(np.int32)
    M=json.load(open('frames/meta.json')); M.setdefault(ch,{})[an]={d:[] for d in D}
    od=f'frames/{ch}/{an}'; os.makedirs(od,exist_ok=True)
    rgba=np.dstack([np.clip(a,0,255).astype(np.uint8),np.full(a.shape[:2],255,np.uint8)])
    previews=[]
    for fi,cx in enumerate(cols):
        xa,xb=max(0,cx-halfw),min(a.shape[1],cx+halfw)
        win=a[y0:y1,xa:xb]; fg=fgmask(win,dark_thr=dark)
        # column-header pills ("Frame 1") above the first row: salmon-pink, low saturation, flat
        fw=win.astype(float); pink=(fw[...,0]>235)&(fw[...,1]>170)&(fw[...,1]<215)&(fw[...,2]>150)&(fw[...,2]<200)
        hdr=nd.binary_dilation(pink,iterations=2)&(np.arange(fg.shape[0])[:,None]<14)
        fg&=~hdr
        # geodesic assignment: every foreground pixel goes to the character seed it is connected to by the shortest path
        from skimage.segmentation import watershed
        markers=np.zeros(fg.shape,int); Y,X=np.mgrid[0:fg.shape[0],0:fg.shape[1]]
        prof=fg.sum(1).astype(float)
        cuts=[]
        if CUTS: cuts=[c-y0 for c in (COLCUTS.get((an,fi)) or CUTS)]      # measured once over the cleaner columns (same row layout in every column)
        else:
            for m in MIDS:      # narrowest row between two stacked characters, near the expected boundary
                lo,hi=m-y0-14,m-y0+14; cuts.append(lo+int(np.argmin(nd.uniform_filter1d(prof,5)[lo:hi])))
        edges=[0]+cuts+[fg.shape[0]]
        for r in range(8):   # each character owns everything clearly inside its own band; only +-OV px around a cut is contested
            y_a=edges[r]+(OV if r>0 else 0); y_b=edges[r+1]-(OV if r<7 else 0)
            markers[(Y>=y_a)&(Y<y_b)&fg]=r+1
        for k in CENTERLOW.get(an,[]):   # around this cut the head/hat (centre) is the lower character, the sides are the upper one's mop/puddle
            c=cuts[k]; zone=(Y>c-26)&(Y<c+26)&fg; cen=np.abs(X-(cx-xa))<46
            markers[zone&cen]=k+2; markers[zone&~cen]=k+1
        fgc=nd.binary_closing(fg,iterations=4)|fg          # bridge thin outline gaps (head vs body) so each body stays with its own head
        distc=nd.distance_transform_edt(fgc)
        lab_ws=watershed(-distc,markers,mask=fgc)*fg
        # mop heads and water puddles sit at foot level: inside the contested strip they belong to the row ABOVE the cut
        f=win.astype(float)/255; mx=f.max(-1); mn=f.min(-1); dd_=mx-mn+1e-6
        hh=np.where(mx==f[...,0],((f[...,1]-f[...,2])/dd_)%6,np.where(mx==f[...,1],(f[...,2]-f[...,0])/dd_+2,(f[...,0]-f[...,1])/dd_+4))*60; ss=dd_/np.maximum(mx,1e-6)
        mopc=((hh>31)&(hh<46)&(ss>0.15)&(ss<0.42)&(mx>0.8))|((hh>185)&(hh<215)&(ss>0.12)&(ss<0.55)&(mx>0.8))
        if DBG: print('cuts',fi,[c+y0 for c in cuts])
        for r,c in enumerate(cuts):
            zone=(Y>c-34)&(Y<c+30)
            cand=zone&mopc&(lab_ws==r+2)
            l,n=nd.label(cand)
            for i in range(1,n+1):
                piece=l==i
                if piece.sum()<25: continue
                grow=nd.binary_dilation(piece,iterations=3)&(lab_ws==r+2)&zone&~((hh>200)&(ss>0.5)&(mx<0.85))
                lab_ws[grow]=r+1
        # stray pieces: a part cut off from its label's main body (another row's mop head, a hat tip) goes to the row whose body it touches/nears
        mains={}
        for r in range(1,9):
            l,n=nd.label(lab_ws==r)
            if n: sz=nd.sum(l>0,l,range(1,n+1)); mains[r]=(l==1+int(np.argmax(sz)))
        for _ in range(STRAY):
            for r in range(1,9):
                l,n=nd.label(lab_ws==r)
                if n<2: continue
                sz=nd.sum(l>0,l,range(1,n+1)); mi=1+int(np.argmax(sz))
                for i in range(1,n+1):
                    if i==mi: continue
                    piece=l==i; best,bd=r,1e9
                    for q,mm in mains.items():
                        dt=nd.distance_transform_edt(~mm); d=dt[piece].min()
                        if d<bd: best,bd=q,d
                    lab_ws[piece]=best
        for r,d in enumerate(D):
            band=(lab_ws==r+1)
            lab,n=nd.label(band); 
            if n==0: continue
            sz=nd.sum(band,lab,range(1,n+1)); big=sz.max()
            keep=np.isin(lab,[i+1 for i,z in enumerate(sz) if z>=0.08*big])
            keep=nd.binary_closing(keep,iterations=1)&band|keep
            sub=rgba[y0:y1,xa:xb].copy(); sub[...,3]=np.where(keep,255,0)
            # soften the cut edge a little
            al=sub[...,3].astype(float); al=nd.gaussian_filter(al,0.5); sub[...,3]=np.where(keep,np.maximum(al,128),0).astype(np.uint8)
            im=Image.fromarray(sub); bb=im.getbbox(); im=im.crop(bb)
            # leftover mop head / puddle of the row above: mop-coloured blobs in the top corners of the frame
            ar=np.array(im); fa=ar[...,:3].astype(float)/255; mx_=fa.max(-1); dd2=mx_-fa.min(-1)+1e-6
            h_=np.where(mx_==fa[...,0],((fa[...,1]-fa[...,2])/dd2)%6,np.where(mx_==fa[...,1],(fa[...,2]-fa[...,0])/dd2+2,(fa[...,0]-fa[...,1])/dd2+4))*60; s_=dd2/np.maximum(mx_,1e-6)
            Hh,Ww=ar.shape[:2]; YY,XX=np.mgrid[0:Hh,0:Ww]
            corner=(YY<Hh*0.3)&((XX<Ww*0.28)|(XX>Ww*0.72))
            junk=corner&(ar[...,3]>0)&(((h_>31)&(h_<46)&(s_>0.15)&(s_<0.42)&(mx_>0.8))|((h_>185)&(h_<215)&(s_>0.12)&(s_<0.55)&(mx_>0.8)))
            if junk.sum()>30:
                jl,jn=nd.label(nd.binary_dilation(junk,iterations=2)&(ar[...,3]>0)&corner)
                for i in range(1,jn+1):
                    pc=jl==i
                    if (pc&junk).sum()>25: ar[...,3][nd.binary_dilation(pc,iterations=1)&corner]=0
                im=Image.fromarray(ar); bb=im.getbbox(); im=im.crop(bb)
            for (dd_,ff_,bx) in ERASE.get(an,[]):
                if dd_==d and ff_==fi:
                    ar=np.array(im); Hh,Ww=ar.shape[:2]; x0_,y0_,x1_,y1_=bx
                    ar[int(y0_*Hh):int(y1_*Hh),int(x0_*Ww):int(x1_*Ww),3]=0; im=Image.fromarray(ar); im=im.crop(im.getbbox())
            # hat tip of the character below sticking up between the feet: white, low-saturation bits in the bottom strip
            ar=np.array(im); Hh,Ww=ar.shape[:2]; fa=ar[...,:3].astype(float)/255; mx_=fa.max(-1); s_=(mx_-fa.min(-1))/np.maximum(mx_,1e-6)
            YY=np.arange(Hh)[:,None]
            wh=(ar[...,3]>0)&(YY>Hh*0.86)&(mx_>0.8)&(s_<0.16)
            body=(ar[...,3]>0)&~wh
            wl,wn=nd.label(nd.binary_dilation(wh,iterations=1)&(ar[...,3]>0)&(YY>Hh*0.84))
            for i in range(1,wn+1):
                pc=wl==i
                xs_=np.nonzero(pc)[1]
                if (pc&wh).sum()>=0.5*pc.sum() and pc.sum()<500 and abs(xs_.mean()-E.head_anchor(im)[0])<Ww*0.22: ar[...,3][pc]=0
            # thin slivers left at the very top/bottom edge after the cut
            al_=ar[...,3]>0; op=nd.binary_opening(al_,iterations=2)
            edge=(YY<4)|(YY>Hh-4)
            lab_,n_=nd.label(al_&~op)
            for i in range(1,n_+1):
                pc=lab_==i
                if (pc&edge).any() and pc.sum()<120: ar[...,3][pc]=0
            im=Image.fromarray(ar); im=im.crop(im.getbbox())
            hx,by=E.head_anchor(im)
            fn=f'{d}_{fi}.png'
            if out: im.save(f'{od}/{fn}')
            M[ch][an][d].append(dict(f=fn,w=im.width,h=im.height,ax=hx,ay=by))
            previews.append((r,fi,im))
    if out: json.dump(M,open('frames/meta.json','w'),indent=0)
    cw=max(p[2].width for p in previews)+6; chh=max(p[2].height for p in previews)+6
    pv=Image.new('RGBA',(cw*len(cols),chh*8),(200,225,200,255))
    for r,fi,im in previews: pv.alpha_composite(im,(fi*cw,r*chh))
    pv.save(f'{SC}/seam_{ch}_{an}.png'); print(ch,an,'ok',pv.size)
if __name__=='__main__':
    U=open('/home/claude/audit/uniq.txt').read().split()
    which=sys.argv[1]; out='--dry' not in sys.argv
    if which=='mop':  run(U[35],'cleaner','mop', [362,690,1015,1340],[180,295,405,512,625,740,848,955],150,108,1024,out=out,mids=[243,350,458,562,680,790,898],cuts=[255,363,471,575,691,803,903])
    if which=='walk': run(U[34],'cleaner','walk',[362,690,1015,1340],[170,285,392,505,612,728,838,948],150,100,1024,out=out,mids=[222,338,448,555,670,782,890])
