import numpy as np, json, os, sys
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
def seg(path,out,thr=110,dil=1,minA=600):
    a=np.array(Image.open(path).convert('RGB')).astype(np.int16)
    lum=(a[...,0]*30+a[...,1]*59+a[...,2]*11)/100
    sat=a.max(-1)-a.min(-1)
    # background: light & low-ish saturation
    bgc=(lum>215)&(sat<60)
    bar=ndi.binary_dilation(lum<thr,iterations=dil)
    free=bgc&~bar
    lab,n=ndi.label(free)
    big=np.zeros(n+1,bool); s=ndi.sum(free,lab,range(1,n+1)); big[1:]=s>3000
    bg=big[lab]
    bg=ndi.binary_dilation(bg,iterations=1)&~bar | bg
    fg=~bg
    fg=ndi.binary_opening(fg,iterations=1)
    fg=ndi.binary_fill_holes(fg)
    l2,n2=ndi.label(fg)
    os.makedirs(out,exist_ok=True)
    info=[]
    ov=Image.open(path).convert('RGB'); d=ImageDraw.Draw(ov)
    k=0
    for i,sl in enumerate(ndi.find_objects(l2)):
        m=(l2[sl]==i+1)
        if m.sum()<minA: continue
        rgba=np.zeros(m.shape+(4,),np.uint8); rgba[...,:3]=a[sl]; rgba[...,3]=m*255
        Image.fromarray(rgba).save(f'{out}/{k}.png')
        info.append(dict(id=k,x=sl[1].start,y=sl[0].start,w=m.shape[1],h=m.shape[0]))
        d.rectangle([sl[1].start,sl[0].start,sl[1].stop,sl[0].stop],outline='blue')
        d.text((sl[1].start+2,sl[0].start+2),str(k),fill='blue')
        k+=1
    ov.save(out+'_ov.png'); json.dump(info,open(out+'.json','w'))
    print(out,k)
U=open('/home/claude/audit/uniq.txt').read().split()
seg(U[7],'env'); seg(U[18],'cprops')
