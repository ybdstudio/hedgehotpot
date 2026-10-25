"""HD drink / dessert counters: every piece is super-resolved first (EDSR), then composited at 2x, so nothing is upscaled after."""
import os, sys
from PIL import Image
sys.path.insert(0,'.')
from icon_sr import sharpen_icon
import drink_dessert as DD   # noqa: rebuilds the 1x composites (drink top items cut-out)
base=sharpen_icon(Image.open('stations/st4_maki_0.png'))            # 2x
W,H=base.size
def sr_item(im, w):
    im=im.crop(im.getbbox()); hd=sharpen_icon(im, out_scale=4.0); return hd.resize((w,round(hd.height*w/hd.width)),Image.LANCZOS)
# drink: register + dispenser cut from the old counter
it=DD.items('env/71.png',24,'wood'); it=sr_item(it,round(W*0.62))
cv=Image.new('RGBA',(W,H),(0,0,0,0)); cv.alpha_composite(base); cv.alpha_composite(it,(int(W*0.5-it.width/2),int(H*0.17-it.height*0.75)))
cv.save('stations_hd/st5_drink.png')
pad=24; cv=Image.new('RGBA',(W,H+pad),(0,0,0,0)); cv.alpha_composite(base,(0,pad))
for p,w,(cx,by) in [('env/67.png',0.247,(0.36,0.30)),('env/69.png',0.173,(0.60,0.24)),('env/68.png',0.21,(0.80,0.33))]:
    im=sr_item(Image.open(p).convert('RGBA'),round(W*w)); cv.alpha_composite(im,(int(W*cx-im.width/2),int(H*by+pad-im.height)))
cv.save('stations_hd/st5_dessert.png'); print('ok',W,H)
