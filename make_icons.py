
from PIL import Image, ImageDraw, ImageFont
import os, math
os.makedirs('icons', exist_ok=True)
for s in [16,32,48,128]:
    im=Image.new('RGBA',(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    # rounded bg
    d.rounded_rectangle([1,1,s-1,s-1], radius=max(3,s//5), fill=(22,119,255,255))
    # image card
    m=max(3,s//5); y=s//4
    d.rounded_rectangle([m,y,s-m,int(s*0.63)], radius=max(1,s//18), fill=(255,255,255,245))
    d.polygon([(m+2,int(s*.57)),(int(s*.4),int(s*.42)),(int(s*.58),int(s*.55)),(int(s*.7),int(s*.48)),(s-m-2,int(s*.58))], fill=(25,167,206,255))
    d.ellipse([int(s*.65),int(s*.32),int(s*.78),int(s*.45)], fill=(255,209,102,255))
    # download arrow
    w=max(2,s//10); cx=s//2
    d.line([(cx,int(s*.34)),(cx,int(s*.73))], fill=(255,255,255,255), width=w)
    d.line([(int(s*.36),int(s*.60)),(cx,int(s*.74)),(int(s*.64),int(s*.60))], fill=(255,255,255,255), width=w, joint='curve')
    d.rounded_rectangle([int(s*.3),int(s*.78),int(s*.7),int(s*.86)], radius=max(1,s//30), fill=(255,255,255,240))
    im.save(f'icons/icon{s}.png')
print('pillow icons generated')
