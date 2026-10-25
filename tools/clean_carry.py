"""Clean chef carry/place frames: carry frame 3 had a dark ground blob baked in -> use frame 1 (cycle 0,1,2,1);
place frames had conveyor belt pieces below the feet -> strip belt-grey + thin rods in the bottom band."""
import numpy as np, json, shutil
from PIL import Image
from scipy import ndimage as nd
B='/home/claude/pipe/bak_chef'; O='/home/claude/pipe/frames/chef'
D=['front','front_right','right','back_right','back','back_left','left','front_left']
meta=json.load(open('/home/claude/pipe/frames/meta.json'))
for d in D:
    shutil.copy(f'{B}/carry/{d}_1.png', f'{O}/carry/{d}_3.png')
    m=meta['chef']['carry'][d]; m[3]=dict(m[1]); m[3]['f']=f'{d}_3.png'
def clean_place(im):
    a=np.array(im.convert('RGBA')).astype(int); H=a.shape[0]
    r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
    mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b); sat=(mx-mn)/np.maximum(mx,1)
    band=np.zeros_like(al,bool); band[int(H*0.72):]=True
    belt=(b>=r-5)&(sat<0.35)&(mx<200)&(mx>85)          # grey-blue belt surface
    rod=(sat>0.25)&(r>g)&(g>b)&(mx<230)&(r-b<140)  # tan rails (thin)
    gold=(g>0.74*r)&(b<0.72*g)&(sat>0.22)&(r>90)
    #gm=band&(al>0)&gold; gold_thin=gm&~nd.binary_opening(gm,structure=np.ones((6,6)))
    #gold_thin=nd.binary_dilation(gold_thin,iterations=1)&band&~nd.binary_opening(band&(al>0)&~belt,structure=np.ones((9,9)))
    kill=band&(al>0)&belt
    a[kill,3]=0
    # remove thin strokes (rails) in band: keep only thick shapes, re-grown by 3px to restore outlines
    m=a[...,3]>40
    yy,xx=np.mgrid[-5:6,-5:6]; disk=(xx*xx+yy*yy)<=25
    thick=nd.binary_dilation(nd.binary_opening(m,structure=disk),iterations=3)
    a[band&m&~thick,3]=0
    a[band&(a[...,3]<=40),3]=0
    # rails stick out sideways: drop band pixels outside the body's horizontal extent (torso rows)
    tor=a[int(H*0.35):int(H*0.72),:,3]>40; cols=np.where(tor.any(0))[0]
    if len(cols):
        x0,x1=cols.min()-4,cols.max()+4; X=np.arange(a.shape[1])[None,:].repeat(H,0)
        a[band&((X<x0)|(X>x1)),3]=0
    # leftover gold rail pixels (thin, olive-gold) below the shoes
    gm=band&(a[...,3]>0)&gold
    a[gm&~nd.binary_opening(gm,structure=np.ones((5,5))),3]=0
    # keep only components touching the body (largest)
    lab,n=nd.label(a[...,3]>20)
    if n>1:
        sz=nd.sum(np.ones_like(lab),lab,range(1,n+1)); keep=np.argmax(sz)+1
        # keep comps big enough (plate) too
        for i,s in enumerate(sz,1):
            if i!=keep and s<1500: a[lab==i,3]=0
    return Image.fromarray(a.astype(np.uint8))
for d in D:
    for j in range(4):
        clean_place(Image.open(f'{B}/place/{d}_{j}.png')).save(f'{O}/place/{d}_{j}.png')
json.dump(meta,open('/home/claude/pipe/frames/meta.json','w'))
