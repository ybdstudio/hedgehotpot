"""Cut the new salmon/tuna station sheets (+ chef-at-salmon-station sheet) out of their baked checker background."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'
SRC={'st_tuna':'985f370b-image.png','st_salmon':'c4aab726-image.png','st_chef':'f8d97d06-image.png'}
O='/home/claude/new2'
def cut(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=np.max(a,2).astype(int)-np.min(a,2)
    bg=(lum>150)&(sat<28)
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bgm=np.isin(lab,list(border))
    fg=~bgm
    fg=nd.binary_opening(fg,iterations=1)
    lab,n=nd.label(fg)
    if n>1:
        sz=nd.sum(fg,lab,range(1,n+1))
        keep=[i+1 for i,s in enumerate(sz) if s>max(400,0.02*sz.max())]
        fg=np.isin(lab,keep)
    fg=nd.binary_fill_holes(fg)|fg
    # soften 1px edge
    al=(fg*255).astype(np.uint8)
    edge=fg&~nd.binary_erosion(fg)
    al[edge&(lum>200)]=120
    return al
for k,f in SRC.items():
    a=np.array(Image.open(U+f).convert('RGB'))
    H,W=a.shape[:2]; q=W//4
    for i in range(4):
        sub=a[:,i*q:(i+1)*q]; al=cut(sub)
        ys,xs=np.where(al>0); box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
        im=Image.fromarray(np.dstack([sub,al])).crop(box); im.save(f'{O}/{k}_{i}.png'); print(k,i,box,im.size)
