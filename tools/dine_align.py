import numpy as np, sys, json
from PIL import Image
S='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
Z=4  # supersample
def render(key, x, y, w, W=160, H=150, ox=80, oy=110):
    im=Image.open(f'stations/{key}.png').convert('RGBA')
    h=w*im.height/im.width
    cv=Image.new('RGBA',(W*Z,H*Z),(0,0,0,0))
    r=im.resize((max(1,round(w*Z)),max(1,round(h*Z))),Image.LANCZOS)
    cv.alpha_composite(r,(round((ox+x-w/2)*Z),round((oy+y-h)*Z)))
    return cv
D=dict(tw=85,tx=0,ty=22,w=92*204/196,px=0.8,py=19.8,one=dict(w=95.7,dx=-2.4,dy=23.6))
if __name__=='__main__':
    e=render('dine_table',D['tx'],D['ty'],D['tw'])
    p=render('dine_pair_0',D['px'],D['py'],D['w'])
    oL=render('dine_one_L_0',D['one']['dx'],D['one']['dy'],D['one']['w'])
    oR=render('dine_one_R_0',D['one']['dx'],D['one']['dy'],D['one']['w'])
    bg=(200,225,200,255)
    out=Image.new('RGBA',(e.width*4+30,e.height),(255,255,255,255))
    for i,im in enumerate([e,p,oL,oR]):
        c=Image.new('RGBA',im.size,bg); c.alpha_composite(im)
        # draw guide lines
        a=np.array(c); a[110*Z,:,:3]=0; a[:,80*Z,:3]=0
        out.paste(Image.fromarray(a),(i*(e.width+10),0))
    out.resize((out.width//2,out.height//2)).save(f'{S}/dine_now.png')
