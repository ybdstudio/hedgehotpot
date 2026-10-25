"""Pack approved hedgehog cutouts; no generative editing or external paths.

Run from any directory with Python + Pillow. Missing directional walk drawings
use the matching idle drawing and are marked for runtime step animation.
"""
import json
import hashlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art' / 'hedgehog'
DIRECTIONS = dict(front=0, front_right=315, right=270, back_right=225,
                  back=180, back_left=135, left=90, front_left=45)
HEIGHT = 160


def pack(images, path):
    width = 2048
    placements, seen, unique, x, y, row = {}, {}, {}, 0, 0, 0
    for key, image in images.items():
        w, h = image.size
        digest = (w, h, hashlib.sha256(image.tobytes()).digest())
        if digest in seen:
            placements[key] = placements[seen[digest]]
            continue
        seen[digest] = key
        unique[key] = image
        if x + w > width:
            x, y, row = 0, y + row + 4, 0
        placements[key] = [x, y, w, h]
        x += w + 4
        row = max(row, h)
    atlas = Image.new('RGBA', (width, y + row + 4))
    for key, image in unique.items():
        atlas.alpha_composite(image, tuple(placements[key][:2]))
    atlas.save(path, lossless=True)
    return placements


def main():
    path = ROOT / 'js' / 'manifest.js'
    raw = path.read_text(encoding='utf-8')
    manifest = json.loads(raw[raw.index('{"atlases"'):].rstrip(';\n'))
    report = []
    for role, character in manifest['chars'].items():
        folder = SOURCE / role
        images, animations, procedural = {}, {}, []
        for animation in ['idle', 'walk', 'carry', 'sit', 'eat', 'inspect']:
            animations[animation] = {}
            for direction, angle in DIRECTIONS.items():
                frames = []
                for i in range(4 if animation in ['walk', 'carry', 'eat', 'inspect'] else 1):
                    candidates = []
                    if animation == 'carry':
                        candidates.append(f'cwalk{i + 1}_{angle}.png')
                    if animation in ['carry', 'walk']:
                        candidates.append(f'walk{i + 1}_{angle}.png')
                    if animation in ['sit', 'eat']:
                        # Both supplied seat views face inward toward a table;
                        # never mirror asymmetric clothing, bags or hairstyles.
                        stem = 'sit_eat_left' if 'left' in direction else 'sit_eat_seat'
                        candidates += [f'{stem}{i + 1}.png', f'sit{i + 1}.png', f'eat{i + 1}.png']
                    if animation == 'inspect':
                        candidates.append(f'tablet{i + 1}.png')
                    candidates += [f'idle_{angle}.png', 'idle_0.png']
                    selected = next(folder / name for name in candidates if (folder / name).exists())
                    image = Image.open(selected).convert('RGBA')
                    image = image.resize((round(image.width * HEIGHT / image.height), HEIGHT), Image.Resampling.LANCZOS)
                    key = f'{role}.{animation}.{direction}.{i}'
                    images[key] = image
                    frames.append([key, image.width / 2, HEIGHT])
                    fallback = animation in ['walk', 'carry'] and selected.stem.startswith('idle_')
                    if fallback and direction not in procedural:
                        procedural.append(direction)
                    report.append(dict(character=role, animation=animation, direction=direction,
                                       frame=i, source=str(selected.relative_to(ROOT)).replace('\\', '/'),
                                       proceduralStep=fallback))
                animations[animation][direction] = frames
        # Existing logic names stay compatible; all resolve to hedgehog frames.
        for alias in ['bench_sit', 'counter_sit', 'sit_cat']:
            animations[alias] = animations['sit']
        for alias in ['counter_eat', 'drink', 'drink_cat']:
            animations[alias] = animations['eat']
        for alias in ['prepare', 'wash', 'mop', 'wipe', 'rest', 'sleep', 'emote', 'emote2', 'happy', 'serve', 'checkout']:
            animations[alias] = animations['idle']
        atlas = manifest['atlases'][character['atlas']]
        atlas['frames'] = pack(images, ROOT / atlas['file'])
        character['anims'] = animations
        character['proceduralWalkDirections'] = procedural
        character['displayHeight'] = HEIGHT

    # Remove obsolete sprites containing furniture/guest composites. Furniture,
    # diners, chefs and food are now separate layers in the renderer.
    props = manifest['atlases']['props']
    original = Image.open(ROOT / props['file']).convert('RGBA')
    images = {}
    removed = []
    for key, (x, y, w, h) in props['frames'].items():
        if key.startswith(('dine_pair_', 'dine_solo_', 'chefst_')) or (key.startswith('dine_one_') and key != 'dine_one_empty'):
            removed.append(key)
            continue
        images[key] = original.crop((x, y, x + w, y + h))
    props['frames'] = pack(images, ROOT / props['file'])
    path.write_text('/* Generated by tools/build_hedgehog_assets.py */\nwindow.CST=window.CST||{};CST.MANIFEST=' + json.dumps(manifest, separators=(',', ':')) + ';\n', encoding='utf-8')
    (ROOT / 'docs/hedgehog_replacement_map.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'Packed {len(report)} hedgehog frames; removed {len(removed)} obsolete composite props.')


if __name__ == '__main__':
    main()
