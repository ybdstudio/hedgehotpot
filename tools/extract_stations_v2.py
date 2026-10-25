"""v2 prep counters (empty lower shelf so it is not mistaken for finished sushi) + dish-return sink with auto-wash states.
   salmon + sink sheets have a baked checker background; the tuna sheet is already transparent."""
import numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0,'/home/claude/pipe'); 
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'
O='/home/claude/new2'
def cut(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=np.max(a,2).astype(int)-np.min(a,2)
    bg=(lum>150)&(sat<28)
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
    lab,n=nd.label(fg)
    if n>1:
        sz=nd.sum(fg,lab,range(1,n+1)); fg=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>max(250,0.004*sz.max())])
    al=(fg*255).astype(np.uint8); edge=fg&~nd.binary_erosion(fg); al[edge&(lum>200)]=120
    return al
for k,f,mode in [('st3_salmon','4c2f8511-image.png','chk'),('st3_tuna','84cb831a-image.png','alpha'),('sink2','6bce497f-image.png','chk')]:
    im=Image.open(U+f); W=im.width; q=W//4
    for i in range(4):
        if mode=='alpha':
            sub=np.array(im.convert('RGBA'))[:,i*q:(i+1)*q]; al=sub[...,3]; rgb=sub[...,:3]
            m=al>20; lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); keep=np.isin(lab,[j+1 for j,s in enumerate(sz) if s>max(250,0.004*sz.max())]); al=np.where(keep,al,0).astype(np.uint8)
        else:
            rgb=np.array(im.convert('RGB'))[:,i*q:(i+1)*q]; al=cut(rgb)
        ys,xs=np.where(al>0); out=Image.fromarray(np.dstack([rgb,al])).crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
        out.save(f'{O}/{k}_{i}.png'); print(k,i,out.size)

# normalise each set to one canvas: the table body (largest component) bottom-centre aligned, so a fixed draw width keeps
# the counter perfectly still between states (only the knife / slices / bubbles change)
for k in ['st3_salmon','st3_tuna','sink2']:
    ims=[Image.open(f'{O}/{k}_{i}.png') for i in range(4)]; boxes=[]
    for im in ims:
        m=np.array(im)[...,3]>40; lab,n=nd.label(m); sz=nd.sum(m,lab,range(1,n+1)); body=lab==(np.argmax(sz)+1)
        ys,xs=np.where(body); boxes.append((xs.min(),ys.min(),xs.max(),ys.max()))
    bw=max(b[2]-b[0] for b in boxes)
    up=max(b[3] for b in boxes)                     # extent above the body bottom incl. effects
    W=bw+40; H=up+12
    tw=int(np.median([b[2]-b[0] for b in boxes]))
    for i,(im,b) in enumerate(zip(ims,boxes)):
        sc=tw/(b[2]-b[0]); im=im.resize((round(im.width*sc),round(im.height*sc)),Image.LANCZOS); b=[v*sc for v in b]
        cx=(b[0]+b[2])/2; can=Image.new('RGBA',(W,H),(0,0,0,0))
        can.alpha_composite(im,(int(round(W/2-cx)),int(round(H-6-b[3]))))
        can.save(f'{O}/{k}_{i}.png')
    print(k,'canvas',W,H,[b[2]-b[0] for b in boxes])
