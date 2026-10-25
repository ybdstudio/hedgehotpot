"""1) customer walk back_right frames had the legs cropped off -> mirror of the complete back_left frames
   2) chef idle front_right/right used a winking frame -> first frame of the chef's own walk in that direction (eyes open)"""
import json, shutil
from PIL import Image, ImageOps
F='frames'; M=json.load(open(f'{F}/meta.json'))
for ch in ['cust_orange','cust_gray']:
    src=M[ch]['walk']['back_left']; out=[]
    for i,fr in enumerate(src):
        im=ImageOps.mirror(Image.open(f'{F}/{ch}/walk/{fr["f"]}')); fn=f'back_right_{i}.png'; im.save(f'{F}/{ch}/walk/{fn}')
        out.append(dict(fr,f=fn,ax=im.width-fr['ax']))
    M[ch]['walk']['back_right']=out
for d in ['front_right','right']:
    w=M['chef']['walk'][d][0]; fn=f'{d}_0.png'
    shutil.copy(f'{F}/chef/walk/{w["f"]}',f'{F}/chef/idle/{fn}'); M['chef']['idle'][d]=[dict(w,f=fn)]
json.dump(M,open(f'{F}/meta.json','w')); print('ok')
