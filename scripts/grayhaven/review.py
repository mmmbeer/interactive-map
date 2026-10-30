"""Render geometry QA sheets without changing the map artwork.
Usage: python scripts/grayhaven/review.py /absolute/output/directory
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
m=json.loads((ROOT/'public/data/maps/grayhaven.json').read_text())
image=Image.open(ROOT/'public'/m['image']).convert('RGB')
out=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'docs/grayhaven-review'
out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
colors={'street':'#ee2889','water':'#2c86f4','terrain':'#17a44b','harbor':'#00a6bc','home':'#e03b2f','landmark':'#913bea','temple':'#913bea','guild':'#913bea','shop':'#e27600','workshop':'#e27600','tavern':'#e27600'}


def trace(draw,p,color,width=2):
    shape=p.get('shape',{})
    if shape.get('kind')=='polyline':
        draw.line([tuple(v) for v in shape['points']],fill=color,width=width,joint='curve')
    elif shape.get('kind')=='polygon':
        for ring in [shape['points'],*shape.get('holes',[])]:
            draw.line([tuple(v) for v in ring+[ring[0]]],fill=color,width=width,joint='curve')
    elif 'bounds' in p:
        x,y,w,h=p['bounds'];draw.rectangle((x,y,x+w,y+h),outline=color,width=width)


for name,categories in [('roads',{'street'}),('parcels',{'terrain','water'})]:
    im=image.copy();d=ImageDraw.Draw(im)
    for p in m['locations']:
        if p['category'] in categories:
            trace(d,p,colors[p['category']],3)
    im.save(out/f'{name}.jpg',quality=93)
im=image.copy().convert('RGBA');overlay=Image.new('RGBA',im.size);d=ImageDraw.Draw(overlay)
for i,district in enumerate(m['districts']):
    color=(40+(i*67)%190,40+(i*131)%190,40+(i*97)%190,65)
    for shape in district['boundaries']:
        d.polygon([tuple(v) for v in shape['points']],fill=color)
        for hole in shape.get('holes',[]):d.polygon([tuple(v) for v in hole],fill=(0,0,0,0))
        trace(d,{'shape':shape},(*color[:3],255),3)
    x,y=district['label'].values();d.text((x,y),district['name'],font=font,anchor='mm',fill='black',stroke_width=2,stroke_fill='white')
Image.alpha_composite(im,overlay).convert('RGB').save(out/'districts.jpg',quality=93)
im=image.copy();d=ImageDraw.Draw(im)
for p in m['locations']:
    if p['category'] not in ['street','terrain','water']:
        trace(d,p,colors[p['category']],2)
for row in range(3):
    for col in range(4):
        x0=col*900;y0=row*600;x1=min(m['width'],x0+900);y1=min(m['height'],y0+600)
        if x0>=x1 or y0>=y1:continue
        tile=im.crop((x0,y0,x1,y1));draw=ImageDraw.Draw(tile)
        draw.rectangle((0,0,min(tile.width,440),28),fill='white')
        draw.text((4,2),f'Image pixels x={x0}..{x1}, y={y0}..{y1}',font=font,fill='black')
        tile.save(out/f'roofs-{row+1}-{col+1}.jpg',quality=95)
print(out)
