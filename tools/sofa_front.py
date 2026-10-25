"""Front part of the VIP sofa (left armrest + seat front + base) drawn over the seated VIP so it sits *in* the sofa."""
import numpy as np
from PIL import Image
a=np.array(Image.open('stations/vip_sofa.png').convert('RGBA')); H,W=a.shape[:2]
Y=np.arange(H)[:,None].repeat(W,1); X=np.arange(W)[None,:].repeat(H,0)
arm=(X<46)&(Y>27)
seat=(Y>74)|((Y>70)&(X>44)&(X<100))
o=a.copy(); o[...,3]=np.where(arm|seat,a[...,3],0)
Image.fromarray(o).save('stations/vip_sofa_front.png'); print('ok')
