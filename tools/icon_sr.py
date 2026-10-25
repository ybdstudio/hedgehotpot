"""Sharper icons: EDSR x4 super-resolution on the colour, alpha upscaled + hardened, then down to 2x the source size.
   Used for the small food / item icons that get drawn large inside bubbles, cards and UI panels."""
import numpy as np, cv2, sys, os
from PIL import Image, ImageFilter
SR=None
def sr4(rgb):
    global SR
    if SR is None:
        SR=cv2.dnn_superres.DnnSuperResImpl_create(); SR.readModel('/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad/sr/EDSR_x4.pb'); SR.setModel('edsr',4)
    return SR.upsample(rgb)
def sharpen_icon(im, out_scale=2.0):
    im=im.convert('RGBA'); a=np.array(im); W,H=im.size
    al=a[...,3].astype(float)/255
    # bleed colour into transparent pixels so SR does not pull dark/white fringe in from the background
    rgb=a[...,:3].copy(); m=al>0.5
    from scipy import ndimage as nd
    idx=nd.distance_transform_edt(~m,return_distances=False,return_indices=True); rgb=rgb[idx[0],idx[1]]
    pad=4; rgbp=cv2.copyMakeBorder(np.ascontiguousarray(rgb[...,::-1]),pad,pad,pad,pad,cv2.BORDER_REPLICATE)
    up=sr4(rgbp)[pad*4:-pad*4,pad*4:-pad*4,::-1]
    A=np.array(Image.fromarray(a[...,3]).resize((W*4,H*4),Image.LANCZOS)).astype(float)/255
    A=np.clip((A-0.5)*1.8+0.5,0,1)                      # crisper silhouette
    out=Image.fromarray(np.dstack([up,(A*255).astype(np.uint8)]),'RGBA')
    tw,th=max(1,round(W*out_scale)),max(1,round(H*out_scale))
    out=out.resize((tw,th),Image.LANCZOS)
    return out.filter(ImageFilter.UnsharpMask(radius=1.0,percent=60,threshold=2))
if __name__=='__main__' and '--one' in sys.argv:
    i=sys.argv.index('--one'); sharpen_icon(Image.open(sys.argv[i+1])).save(sys.argv[i+2]); sys.exit(0)
if __name__=='__main__':
    S='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
    tests=['cp/stack_blue.png','cp/ing_salmon.png','env/30.png','env/29.png','cp/rice_bowl.png']
    row=[]
    for t in tests:
        im=Image.open(t).convert('RGBA'); W,H=im.size
        a=im.resize((W*2,H*2),Image.LANCZOS); b=sharpen_icon(im)
        c=Image.new('RGBA',(W*4+10,H*2),(255,253,246,255)); c.alpha_composite(a,(0,0)); c.alpha_composite(b,(W*2+10,0)); row.append(c)
    Wt=max(r.width for r in row); Ht=sum(r.height for r in row)
    o=Image.new('RGBA',(Wt,Ht),(255,255,255,255)); y=0
    for r in row: o.paste(r,(0,y)); y+=r.height
    o.save(f'{S}/sr_cmp.png'); print(o.size)
