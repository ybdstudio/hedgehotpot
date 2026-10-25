"""UI art for the Minis popups / side buttons / loading screen, cut from the user's mock-ups.
   Baked numbers (+300, x300) and captions are inpainted away: the game prints the real reward on top."""
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'; O='/home/claude/game/assets/ui/'; S='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad/'
share=np.array(Image.open(U+'abfbbbd5-image.png').convert('RGB')); launch=np.array(Image.open(U+'504e1c47-image.png').convert('RGB'))
side=np.array(Image.open(U+'be205d10-image.png').convert('RGB')); load=Image.open(U+'cef5462d-image.png').convert('RGB')
def text_mask(a):   # dark outlined lettering + the cream/white fill inside it
    f=a.astype(int); lum=f.mean(-1); dark=lum<95
    m=nd.binary_dilation(dark,iterations=2)
    m=nd.binary_fill_holes(m)
    return nd.binary_dilation(m,iterations=3)
def inpaint(a,boxes):
    a=a.copy(); M=np.zeros(a.shape[:2],np.uint8)
    for (x0,y0,x1,y1) in boxes:
        sub=a[y0:y1,x0:x1]; M[y0:y1,x0:x1]=text_mask(sub)*255
    return cv2.inpaint(a,M,9,cv2.INPAINT_TELEA)
def save(a,name,q=88): Image.fromarray(a).save(O+name,quality=q,method=6); print(name,a.shape)
# share art panel: chef + coins, '+300' and the caption removed
p=share[478:925,118:905]; p=inpaint(p,[(470,340,720,450)]); save(p,'share_art.webp')
# launch popup: phone strip (step 2) and coin strip (step 3, 'x300' removed)
save(launch[617:843,178:852],'launch_phone.webp')
c=launch[940:1190,232:852]; c=inpaint(c,[(170,160,400,252)]); save(c,'launch_coins.webp')
# loading screen without the baked bar + caption: keep the art above them
L=np.array(load); save(L[:1420],'loading.webp',90)
# app icon (step art for revisit / share image)
save(np.array(Image.open(U+'b5c6fe26-image.png').convert('RGB').resize((512,512),Image.LANCZOS)),'app_icon.webp')
# side-button icons: cut the art off the cream card
def cut(a,x0,y0,x1,y1,name):
    sub=a[y0:y1,x0:x1].astype(int); bg=np.array([253,248,238]); d=np.abs(sub-bg).sum(-1)
    near=d<40; lab,n=nd.label(near); edge=set(lab[0])|set(lab[-1])|set(lab[:,0])|set(lab[:,-1]); edge.discard(0)
    al=~np.isin(lab,list(edge)); al=nd.binary_opening(al,iterations=1)
    l2,n2=nd.label(al); sz=nd.sum(al,l2,range(1,n2+1)); al=l2==(1+int(np.argmax(sz))); al=nd.binary_fill_holes(al)
    im=np.dstack([sub.astype(np.uint8),(nd.gaussian_filter(al.astype(float),0.6)*255).astype(np.uint8)])
    o=Image.fromarray(im,'RGBA'); o=o.crop(o.getbbox()); o.save(O+name,quality=92,method=6); print(name,o.size)
cut(side,40,240,130,320,'ico_add.webp'); cut(side,40,410,130,495,'ico_revisit.webp'); cut(side,40,585,130,665,'ico_share.webp')
# header icons
def cuthdr(a,box,name):
    x0,y0,x1,y1=box; sub=a[y0:y1,x0:x1].astype(int)
    f=sub/255; mx=f.max(-1); mn=f.min(-1); s=(mx-mn)/np.maximum(mx,1e-6)
    h=np.where(mx==f[...,0],((f[...,1]-f[...,2])/(mx-mn+1e-6))%6,np.where(mx==f[...,1],(f[...,2]-f[...,0])/(mx-mn+1e-6)+2,(f[...,0]-f[...,1])/(mx-mn+1e-6)+4))*60
    bgc=((h>330)|(h<15))&(s>0.15)&(s<0.6)&(mx>0.85)   # header pink
    bgc|=(s<0.12)&(mx>0.9)&False
    lab,n=nd.label(bgc|((mx>0.93)&(s<0.25))); edge=set(lab[0])|set(lab[-1])|set(lab[:,0])|set(lab[:,-1]); edge.discard(0)
    al=~np.isin(lab,list(edge)); l2,n2=nd.label(al); sz=nd.sum(al,l2,range(1,n2+1)); al=l2==(1+int(np.argmax(sz))); al=nd.binary_fill_holes(al)
    im=np.dstack([sub.astype(np.uint8),(nd.gaussian_filter(al.astype(float),0.6)*255).astype(np.uint8)])
    o=Image.fromarray(im,'RGBA'); o=o.crop(o.getbbox()); o.save(O+name,quality=92,method=6); print(name,o.size)
cuthdr(share,(122,268,300,452),'hdr_share.webp'); cuthdr(launch,(135,140,318,300),'hdr_mega.webp')
