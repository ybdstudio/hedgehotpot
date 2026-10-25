"""Empty bar stool matching the stool baked into the counter-eat sprites: red cushion, chrome legs, black feet."""
from PIL import Image, ImageDraw
S=4; W,H=80*S,70*S
im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
OL=(40,22,18,255)
def leg(x,ytop,ybot):
    d.rounded_rectangle([x-4*S,ytop,x+4*S,ybot],radius=2*S,fill=(205,205,210,255),outline=OL,width=int(1.5*S))
    d.line([x-1*S,ytop+2*S,x-1*S,ybot-3*S],fill=(250,250,252,255),width=S)
    d.ellipse([x-6*S,ybot-4*S,x+6*S,ybot+4*S],fill=(30,26,26,255),outline=OL,width=S)
cx=40*S
# back legs first
leg(cx-14*S,30*S,58*S); leg(cx+14*S,30*S,58*S)
# front legs
leg(cx-22*S,34*S,63*S); leg(cx+20*S,34*S,64*S); leg(cx,36*S,66*S)
# cushion side band
d.rounded_rectangle([cx-34*S,18*S,cx+34*S,34*S],radius=8*S,fill=(196,30,32,255),outline=OL,width=int(2*S))
# cushion top
d.ellipse([cx-34*S,8*S,cx+34*S,28*S],fill=(232,58,52,255),outline=OL,width=int(2*S))
d.ellipse([cx-26*S,11*S,cx+10*S,20*S],fill=(246,110,98,255))
im=im.resize((W//2,H//2),Image.LANCZOS)
im.save('stations/stool_bar.png'); print(im.size)
