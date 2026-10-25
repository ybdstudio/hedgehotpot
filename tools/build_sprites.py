import json, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
import extract as E
U=open('/home/claude/audit/uniq.txt').read().split()
D=['front','front_right','right','back_right','back','back_left','left','front_left']
OUT='/home/claude/pipe/frames'; os.makedirs(OUT,exist_ok=True)

def blobs_centers(a,roi,nr,nc,dark=95):
    x0,y0,x1,y1=roi
    win=a[y0:y1,x0:x1]
    lum=(win[...,0]*30+win[...,1]*59+win[...,2]*11)/100
    bar=ndi.binary_dilation(lum<dark,iterations=2)
    lab,n=ndi.label(~bar)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fg=~np.isin(lab,list(border))
    lab,n=ndi.label(fg)
    pts=[]
    for i,sl in enumerate(ndi.find_objects(lab)):
        h=sl[0].stop-sl[0].start; w=sl[1].stop-sl[1].start
        area=(lab[sl]==i+1).sum()
        if area>1500 and h>45 and w>35: pts.append(((sl[1].start+sl[1].stop)/2+x0,(sl[0].start+sl[0].stop)/2+y0))
    pts=np.array(pts)
    def km(v,k):
        c=np.quantile(v,np.linspace(0.02,0.98,k))
        for _ in range(50):
            l=np.argmin(abs(v[:,None]-c[None]),1)
            c=np.array([v[l==j].mean() if (l==j).any() else c[j] for j in range(k)])
        return sorted(c)
    return km(pts[:,1],nr), km(pts[:,0],nc)

def grid(a,spec):
    if 'rows' in spec and 'cols' in spec: return spec['rows'],spec['cols']
    if spec.get('auto'):
        return blobs_centers(a,spec['auto'],spec['nr'],spec['nc'])
    r,c=E.detect_grid(a)
    r=[y for y in r if y>spec.get('miny',140)]
    c=[x for x in c if x>spec.get('minx',250)]
    c=sorted(set(int(x/12) for x in c)); c=[x*12+6 for x in c]
    if 'rows' in spec: r=spec['rows']
    if 'cols' in spec: c=spec['cols']
    return r,c

# anims: (char, anim, sheet, layout, spec)
# layout 'R' = rows are dirs (D order), cols frames; 'C' = cols are dirs, rows frames
A=[]
def add(ch,an,sh,lay,**spec): A.append((ch,an,sh,lay,spec))
RB_COLS=[190,372,550,727,904,1082,1260,1438]
# Player = red beret Waiter cat
add('player','idle',20,'C',cols=RB_COLS,rows=[253,469,687,903],frames=[0])
add('player','walk',9,'R',rows=[158,264,376,488,600,719,829,945],cols=[351,654,956,1242],dark=55)
add('player','carry_plates',3,'C',cols=RB_COLS,rows=[251,469,687,902])
add('player','carry_tray',8,'C',cols=RB_COLS,rows=[252,469,687,903])
# Chef
add('chef','carry',4,'C',cols=[181,361,538,719,895,1072,1255,1436],rows=[232,456,672,889],dark=60)
add('chef','place',12,'C',rows=[229,441,654,878],cols=[195,378,555,732,909,1084,1261,1437])
add('chef','rest',13,'C',rows=[248],cols=[112,304,490,672,860,1058,1240,1428])
add('chef','emote',13,'R',rows=[600],cols=[105,293,481,678,866,1053,1238,1430],single_dir=True,w=185,h=210)
add('chef','emote2',13,'R',rows=[875],cols=[105,293,481,678,866,1053,1238,1430],single_dir=True,w=185,h=210)
# Waitress (Waiter employee)
for an,sh in [('idle',28),('walk',19),('carry',37),('serve',36),('collect',25),('sleep',29)]:
    add('waitress',an,sh,'R', **({'cols':[374,627,896,1152],'miny':100} if sh==28 else {}))
for an,sh in [('idle_counter',31),('walk',32),('checkout',24),('rest',23)]:
    add('cashier',an,sh,'R')
for an,sh in [('walk',34),('mop',35)]:
    add('cleaner',an,sh,'R')
add('cleaner','sleep',26,'R',rows=[178,287,400,510,622,736,848,957],cols=[145,250,355,459],w=104)
add('cleaner','wipe',26,'R',rows=[189,298,409,523,638,749,860,965],cols=[709,822,919,1027],w=112)
add('cleaner','collect',26,'R',rows=[190,298,409,522,638,748,859,965],cols=[1189,1277,1384,1475],w=100)
for an,sh in [('idle',38),('walk',40),('sit',33),('eat',21)]:
    add('cust_orange',an,sh,'R',**({'cols':[279,434,589,748,907,1072,1234,1395],'miny':100} ))
add('cust_orange','happy',30,'R',rows=[179,290,397,507,618,730,833,943],cols=[170,249,322,410,492,571,648,727],w=80)
add('cust_orange','angry',30,'R',rows=[179,290,397,507,618,730,833,943],cols=[933,1012,1091,1175,1256,1331,1415,1495],w=80)
add('cust_gray','walk',5,'R',cols=[269,427,586,744,904,1068,1230,1392])
add('cust_gray','eat',15,'R4',rows=[159,260,363,464],cols=[268,494,718,942,1166])
add('cust_gray','drink',15,'R4',rows=[681,780,874,971],cols=[270,495,719,944,1168])
add('cust_calico','idle',16,'R')
# VIP1 (4 dirs: front,right,back,left)
add('vip1','walk',0,'R4',rows=[115,366,614,868],cols=[445,684,922,1155])
add('vip1','sit',6,'R4',rows=[146,392,645,891],cols=[610,868,1129])
add('vip1','idle',1,'R4',rows=[498],cols=[215,588,968,1341],frames_as_dirs=True)
add('manager','idle',10,'C4',rows=[298,567,843],cols=[200,584,960,1344])
# VIP2
add('vip2','idle',14,'C',rows=[131],cols=[100,276,461,653,845,1060,1244,1428])
add('vip2','sit',14,'C',rows=[929],cols=[77,200,323,445,568,676,791,914])
add('vip2','drink',14,'R',rows=[929],cols=[1098,1221,1344,1459],single_dir=True)
VX=[90,232,377,522,672,843,990,1140,1292,1442]; VY=[330,465,610,750]
add('vip2','walk',14,'VIP2W')

def cells(a,ch,an,lay,spec):
    """returns dict dir->list of (cx,cy,w,h)"""
    out={}
    if lay=='VIP2W':
        w,h=145,140
        for ri,(d1,d2) in enumerate([('front','front_right'),('right','back_right'),('back','back_left'),('left','front_left')]):
            out[d1]=[(VX[i],VY[ri],w,h) for i in range(4)]
            out[d2]=[(VX[5+i],VY[ri],w,h) for i in range(4)]
        out['back_left']=out['back']  # generator mislabeled; use back
        return out
    r,c=grid(a,spec)
    sx=np.median(np.diff(c)) if len(c)>1 else 150
    sy=np.median(np.diff(r)) if len(r)>1 else 150
    w,h=spec.get('w',sx*0.98),spec.get('h',min(sy*1.12,sx*1.3) if len(r)>1 else sx*1.2)
    if ch=='vip1' and an=='idle': w,h=380,420
    if spec.get('single_dir'):
        out['all']=[(x,r[0],w,h) for x in c]; return out
    if lay=='R':
        assert len(r)==8, (ch,an,len(r),r)
        for di,y in enumerate(r):
            fr=[(x,y,w,h) for x in c]
            out[D[di]]=fr
    elif lay=='C':
        assert len(c)==8,(ch,an,len(c),c)
        for di,x in enumerate(c):
            out[D[di]]=[(x,y,w,h) for y in r]
    elif lay=='R4':
        names=['front','right','back','left']
        if spec.get('frames_as_dirs'):
            for i,x in enumerate(c): out[names[i]]=[(x,r[0],w,h)]
        else:
            for i,y in enumerate(r): out[names[i]]=[(x,y,w,h) for x in c]
    elif lay=='C4':
        names=['front','right','back','left']
        for i,x in enumerate(c): out[names[i]]=[(x,y,w,h) for y in r]
    if 'frames' in spec:
        out={k:[v[i] for i in spec['frames']] for k,v in out.items()}
    return out

meta={}
cache={}
for ch,an,sh,lay,spec in A:
    if sh not in cache: cache[sh]=E.load(U[sh])
    a=cache[sh]
    cs=cells(a,ch,an,lay,spec)
    od=f'{OUT}/{ch}/{an}'; os.makedirs(od,exist_ok=True)
    m={}
    for d,lst in cs.items():
        m[d]=[]
        for fi,(x,y,w,h) in enumerate(lst):
            res=E.extract(a,x,y,w,h,dark_thr=spec.get('dark',95),dil=spec.get('dil',3),tight=spec.get('tight',0.25 if ch in ('waitress','cashier','cleaner') else 0))
            if res is None: print('FAIL',ch,an,d,fi); continue
            img,_=res
            hx,by=E.head_anchor(img)
            fn=f'{d}_{fi}.png'; img.save(f'{od}/{fn}')
            m[d].append(dict(f=fn,w=img.width,h=img.height,ax=hx,ay=by))
    meta.setdefault(ch,{})[an]=m
    print(ch,an,{k:len(v) for k,v in m.items()})
json.dump(meta,open(f'{OUT}/meta.json','w'),indent=0)
