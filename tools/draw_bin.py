"""Kitchen trash bin prop (green pedal bin with lid), matching the chunky outlined style of the other props."""
from PIL import Image, ImageDraw
S=4; W,H=60*S,76*S
im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im); OL=(46,30,22,255)
cx=30*S
# body (tapered)
d.polygon([(cx-20*S,22*S),(cx+20*S,22*S),(cx+16*S,70*S),(cx-16*S,70*S)],fill=(70,150,96,255),outline=OL)
d.line([(cx-20*S,22*S),(cx-16*S,70*S)],fill=OL,width=2*S); d.line([(cx+20*S,22*S),(cx+16*S,70*S)],fill=OL,width=2*S)
d.ellipse([cx-16*S,64*S,cx+16*S,74*S],fill=(56,124,78,255),outline=OL,width=2*S)
for x in (-9,0,9): d.line([(cx+x*S,28*S),(cx+x*0.8*S,64*S)],fill=(52,118,74,255),width=2*S)
d.polygon([(cx-17*S,26*S),(cx-12*S,26*S),(cx-10*S,62*S),(cx-14*S,62*S)],fill=(120,196,138,255))
# lid
d.ellipse([cx-23*S,14*S,cx+23*S,28*S],fill=(92,176,116,255),outline=OL,width=2*S)
d.ellipse([cx-17*S,16*S,cx+12*S,22*S],fill=(150,214,164,255))
d.rounded_rectangle([cx-7*S,8*S,cx+7*S,17*S],radius=3*S,fill=(92,176,116,255),outline=OL,width=2*S)
# recycle-ish leaf mark
d.ellipse([cx-6*S,40*S,cx+6*S,52*S],fill=(240,248,236,255),outline=OL,width=S)
d.line([(cx-3*S,49*S),(cx+3*S,43*S)],fill=(70,150,96,255),width=2*S)
im=im.resize((W//2,H//2),Image.LANCZOS); im.save('stations/trash_bin.png'); print(im.size)
