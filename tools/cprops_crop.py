import extract as E, os
from PIL import Image, ImageDraw
U=open('/home/claude/audit/uniq.txt').read().split()
a=E.load(U[18])
crops={'ing_salmon':(75,150,120,90),'ing_tuna':(190,150,110,90),'ing_cucumber':(205,240,110,80),'nori':(1355,262,140,90),'rice_bowl':(1230,165,130,100),
'su_salmon':(75,415,120,90),'su_tuna':(185,415,115,90),'su_shrimp':(290,415,110,100),'su_tamago':(385,415,110,90),'su_ikura':(575,415,85,100),'su_maki':(745,415,80,100),'su_cali':(905,415,90,100),
'plate_blue':(1195,390,100,60),'plate_pink':(1295,390,100,60),'plate_yellow':(1392,390,100,60),'plate_green':(1485,390,95,60),'plate_white':(1195,465,100,60),'stack_blue':(1295,462,100,75),'stack_pink':(1392,462,100,85),
'tray_empty':(90,610,150,110),'tray_sushi':(235,605,150,110),'tray_maki':(385,600,140,110),
'box_fish':(665,595,125,110),'box_salmon':(795,595,125,110),'box_veg':(930,595,125,120),'box_rice':(1062,595,125,110),
'soy':(780,765,60,100),'fx_heart':(396,955,45,45),'fx_zzz':(525,950,60,50),'fx_drop':(350,952,40,50),'lantern_sushi':(1125,940,95,130),'chalk':(1470,940,105,140),'noren':(1295,945,240,130)}
os.makedirs('cp',exist_ok=True)
for k,(x,y,w,h) in crops.items():
    r=E.extract(a,x,y,w,h,dark_thr=80,dil=1,bgsat=26,bglum=175,fill_max=6000)
    if r is None: print('fail',k); continue
    r[0].save(f'cp/{k}.png')
ims=[(k,Image.open(f'cp/{k}.png')) for k in crops if os.path.exists(f'cp/{k}.png')]
S=Image.new('RGB',(1400,600),(60,140,90)); x=y=0
d=ImageDraw.Draw(S)
for k,im in ims:
    im.thumbnail((120,120))
    if x+130>1400: x=0;y+=145
    S.paste(im,(x,y+12),im); d.text((x,y),k,fill='yellow'); x+=135
S.save('cp_contact.png')
