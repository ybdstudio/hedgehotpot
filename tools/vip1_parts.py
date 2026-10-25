import numpy as np
from PIL import Image
from scipy import ndimage as nd
SC='/tmp/claude-0/-home-claude/765e8b27-24a2-5c8f-bc7f-fe3327a73871/scratchpad'
im=Image.open('/root/.claude/uploads/765e8b27-24a2-5c8f-bc7f-fe3327a73871/d875a804-image.png').convert('RGB')
c=np.array(im.crop((485,735,665,945))).astype(int)
bg=np.median(np.concatenate([c[:3].reshape(-1,3),c[-3:].reshape(-1,3),c[:,:3].reshape(-1,3),c[:,-3:].reshape(-1,3)]),0); print(bg)
d=np.abs(c-bg).sum(-1)
cand=d<28
lab,n=nd.label(cand)
edge=set(lab[0])|set(lab[-1])|set(lab[:,0])|set(lab[:,-1]); edge.discard(0)
bgm=np.isin(lab,list(edge))
fg=~bgm
fg=nd.binary_opening(fg,iterations=1)
l2,n2=nd.label(fg); sz=nd.sum(fg,l2,range(1,n2+1)); fg=l2==(1+int(np.argmax(sz)))
fg=nd.binary_fill_holes(fg)
a=np.dstack([c.astype(np.uint8),(fg*255).astype(np.uint8)])
o=Image.fromarray(a,'RGBA'); bb=o.getbbox(); o=o.crop(bb); print(o.size)
o.save('vip1_parts_cat.png')
bgc=Image.new('RGBA',o.size,(120,180,120,255)); bgc.alpha_composite(o); bgc.resize((o.width*3,o.height*3)).save(f'{SC}/parts_cut.png')
