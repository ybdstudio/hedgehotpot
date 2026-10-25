"""Extract imagegen-edited prop cells and pack the game's environment atlas.

The generated artwork replaces all remaining paw-branded kitchen counters and
armchairs. Original frame dimensions/transparent padding are kept for alignment.
"""
import json
from pathlib import Path
from PIL import Image, ImageChops
from build_hedgehog_assets import pack

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art/environment'


def main():
    path = ROOT / 'js/manifest.js'
    raw = path.read_text(encoding='utf-8')
    manifest = json.loads(raw[raw.index('{"atlases"'):].rstrip(';\n'))
    props = manifest['atlases']['props']
    original = Image.open(ROOT / props['file']).convert('RGBA')
    sheet = Image.open(ART / 'hedgehog_props_sheet.png').convert('RGBA')
    geometry = json.loads((ART / 'props_geometry.json').read_text(encoding='utf-8'))
    names = ['st3_salmon_0', 'st3_tuna_0', 'st4_maki_0', 'st4_ikura_0',
             'st5_drink', 'st5_dessert', 'st_premium', 'st_maki',
             'armchair', 'vip_sofa', 'st_salmon', 'st_tuna']
    cells = {}
    for i, name in enumerate(names):
        x, y = i % 4, i // 4
        cell = sheet.crop((round(x * sheet.width / 4), round(y * sheet.height / 3),
                           round((x+1) * sheet.width / 4), round((y+1) * sheet.height / 3)))
        # Ignore almost-transparent generation residue outside each prop;
        # otherwise that residue changes the crop and shrinks the furniture.
        bounds = cell.getchannel('A').point(lambda a: 255 if a >= 16 else 0).getbbox()
        cells[name] = cell.crop(bounds)
    images, replaced = {}, []
    for key, (x, y, w, h) in props['frames'].items():
        source = key if key in cells else next((n for n in names[:4] if key.startswith(n[:-1])), None)
        if key == 'vip_sofa_front':
            source = 'vip_sofa'
        if not source:
            images[key] = original.crop((x,y,x+w,y+h)); continue
        base = Image.new('RGBA', (w,h))
        # Use the full sofa's geometry for both layers so they coincide.
        geo = geometry['vip_sofa'] if key == 'vip_sofa_front' else geometry[key]
        bx, by, ex, ey = geo['bbox']
        asset = cells[source].resize((ex-bx, ey-by), Image.Resampling.LANCZOS)
        base.alpha_composite(asset, (bx,by))
        if key == 'vip_sofa_front':
            mask = Image.open(ART / 'vip_front_mask.png').convert('L')
            base.putalpha(ImageChops.multiply(base.getchannel('A'), mask))
        images[key] = base
        replaced.append(key)
    props['frames'] = pack(images, ROOT / props['file'])
    path.write_text('/* Generated hedgehog character and environment atlas */\nwindow.CST=window.CST||{};CST.MANIFEST=' + json.dumps(manifest,separators=(',',':')) + ';\n',encoding='utf-8')
    (ROOT / 'docs/hedgehog_environment_map.json').write_text(json.dumps(replaced,indent=2),encoding='utf-8')
    print(f'Replaced {len(replaced)} remaining paw-branded prop frames with hedgehog artwork.')


if __name__ == '__main__':
    main()
