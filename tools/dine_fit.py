import numpy as np
from PIL import Image
from scipy.signal import fftconvolve
from dine_align import D
Z=2; W,H,OX,OY=200,170,100,130
def hsvmask(a):
    f=a[...,:3].astype(float)/255; mx=f.max(-1); mn=f.min(-1); d=mx-mn+1e-6; r,g,b=f[...,0],f[...,1],f[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60; s=d/np.maximum(mx,1e-6)
    al=a[...,3]>128
    red=al&((h<14)|(h>340))&(s>0.55)&(mx>0.35)        # chairs
    dark=al&(mx<0.35)&(h>5)&(h<45)&(s>0.3)             # pedestal / legs shadow-brown
    return (red|dark).astype(float)
def render(key,x,y,w):
    im=Image.open(f'stations/{key}.png').convert('RGBA'); h=w*im.height/im.width
    cv=Image.new('RGBA',(W*Z,H*Z),(0,0,0,0)); r=im.resize((max(1,round(w*Z)),max(1,round(h*Z))),Image.LANCZOS)
    cv.alpha_composite(r,(round((OX+x-w/2)*Z),round((OY+y-h)*Z))); return np.array(cv)
def fit(key,ref,x0,y0,w0):
    best=None
    for w in np.arange(w0*0.75,w0*1.3,0.5):
        m=hsvmask(render(key,x0,y0,w))
        cc=fftconvolve(ref,m[::-1,::-1],mode='same')
        iy,ix=np.unravel_index(np.argmax(cc),cc.shape); sy,sx=iy-ref.shape[0]//2,ix-ref.shape[1]//2
        ms=np.roll(np.roll(m,sy,0),sx,1); iou=(ms*ref).sum()/np.maximum(((ms+ref)>0).sum(),1)
        if best is None or iou>best[0]: best=(iou,w,x0+sx/Z,y0+sy/Z)
    return best
ref=hsvmask(render('dine_one_L_0',D['one']['dx'],D['one']['dy'],D['one']['w']))
print('table',fit('dine_table',ref,D['tx'],D['ty'],D['tw']))
print('pair',fit('dine_pair_0',ref,D['px'],D['py'],D['w']))
print('oneR',fit('dine_one_R_0',ref,D['one']['dx'],D['one']['dy'],D['one']['w']))
print('oneL self',fit('dine_one_L_0',ref,D['one']['dx'],D['one']['dy'],D['one']['w']))
