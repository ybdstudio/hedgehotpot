"""Maki (cucumber & nori) and ikura station state sprites, VIP sofa, VIP side table and lounge rug -> cut-outs."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/'; O='/home/claude/new6'
def cut(rgb, lum_t=200, sat_t=30, min_frac=0.02):
    r,g,b=[rgb[...,i].astype(int) for i in range(3)]
    lum=(r*30+g*59+b*11)/100; sat=rgb.max(-1).astype(int)-rgb.min(-1)
    corner=np.median(np.concatenate([rgb[:4,:4].reshape(-1,3),rgb[-4:,-4:].reshape(-1,3),rgb[:4,-4:].reshape(-1,3)]),0)
    near=np.abs(rgb.astype(int)-corner).max(-1)<26
    bg=((lum>lum_t)&(sat<sat_t))|near
    lab,n=nd.label(bg); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border)); fg=nd.binary_opening(fg,iterations=1)
    lab,n=nd.label(fg); sz=nd.sum(fg,lab,range(1,n+1)); fg=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>min_frac*sz.max()])
    al=(fg*255).astype(np.uint8); edge=fg&~nd.binary_erosion(fg); al[edge&(lum>215)]=110
    ys,xs=np.where(fg); return Image.fromarray(np.dstack([rgb,al])).crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
st=np.array(Image.open(U+'f079fa9e-image.png').convert('RGB'))
for name,boxes in [('maki',[(12,806,185,968),(190,806,365,968),(368,806,548,968),(560,806,750,968)]),
                   ('ikura',[(772,806,955,968),(958,806,1148,968),(1150,806,1340,968),(1345,806,1530,968)])]:
    for i,(x0,y0,x1,y1) in enumerate(boxes):
        im=cut(st[y0:y1,x0:x1],lum_t=225,sat_t=40); im.save(f'{O}/st4_{name}_{i}.png'); print(name,i,im.size)
so=np.array(Image.open(U+'4a2a7091-image.png').convert('RGB')); im=cut(so[45:165,0:150],lum_t=215,sat_t=45); im.save(f'{O}/vip_sofa.png'); print('sofa',im.size)
tb=np.array(Image.open(U+'0e0a402e-image.png').convert('RGB')); im=cut(tb[0:118,0:132],lum_t=215,sat_t=45); im.save(f'{O}/vip_table.png'); print('table',im.size)
rg=np.array(Image.open(U+'2290447c-image.png').convert('RGB')); im=cut(rg[45:205,0:215],lum_t=225,sat_t=45); im.save(f'{O}/vip_rug.png'); print('rug',im.size)
