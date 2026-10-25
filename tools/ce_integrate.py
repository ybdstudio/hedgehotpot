"""Install the new conveyor-counter eat frames (cat + its stool, facing back_right = toward the belt) as
   counter_sit / counter_eat for cust_gray & cust_orange. The previous stool-less seated frames become 'bench_sit'
   (used on the waiting bench). Frames are scaled so the head matches the customer's own walk head size and
   anchored at the stool's foot centre."""
import json, os, shutil, numpy as np
from PIL import Image
F='frames'; M=json.load(open(f'{F}/meta.json')); D='/home/claude/new2'
def headw(im, frac=0.38):
    a=np.array(im)[...,3]>40; ys=np.where(a.any(1))[0]; top=ys.min(); h=ys.max()-top
    band=a[top:top+int(h*frac)]; xs=np.where(band.any(0))[0]; return xs.max()-xs.min()
for ch in ['cust_gray','cust_orange']:
    # keep the old seated frames for the queue bench
    if 'bench_sit' not in M[ch]:
        os.makedirs(f'{F}/{ch}/bench_sit',exist_ok=True)
        for fr in M[ch]['counter_sit']['back_right']: shutil.copy(f'{F}/{ch}/counter_sit/{fr["f"]}',f'{F}/{ch}/bench_sit/{fr["f"]}')
        M[ch]['bench_sit']=json.loads(json.dumps(M[ch]['counter_sit']))
    w0=M[ch]['walk']['back_right'][0]; walk=Image.open(f'{F}/{ch}/walk/back_right/'+w0['f']) if os.path.exists(f'{F}/{ch}/walk/back_right/'+w0['f']) else Image.open(f'{F}/{ch}/walk/'+w0['f'])
    hw=headw(walk)
    frames=[Image.open(f'{D}/{ch}_ces_{i}.png').convert('RGBA') for i in range(5)]
    s=hw/np.median([headw(f) for f in frames])
    for an in ['counter_sit','counter_eat']:
        shutil.rmtree(f'{F}/{ch}/{an}',ignore_errors=True); os.makedirs(f'{F}/{ch}/{an}')
    out=[]
    for i,f in enumerate(frames):
        im=f.resize((max(1,round(f.width*s)),max(1,round(f.height*s))),Image.LANCZOS)
        a=np.array(im); al=a[...,3]>60
        r,g,b=[a[...,k].astype(int) for k in range(3)]
        red=al&(r>170)&(g<90)&(b<90)                     # the red stool seat
        ys,xs=np.where(red); ax=float(np.median(xs)); ay=float(np.where(al.any(1))[0].max())
        im.save(f'{F}/{ch}/counter_eat/back_right_{i}.png'); out.append({'f':f'back_right_{i}.png','w':im.width,'h':im.height,'ax':ax,'ay':ay})
    M[ch]['counter_eat']={'back_right':out}
    shutil.copy(f'{F}/{ch}/counter_eat/back_right_0.png',f'{F}/{ch}/counter_sit/back_right_0.png')
    M[ch]['counter_sit']={'back_right':[dict(out[0])]}
    print(ch,'scale',round(s,3),'walk head',hw,[ (o['w'],o['h']) for o in out])
json.dump(M,open(f'{F}/meta.json','w'))
