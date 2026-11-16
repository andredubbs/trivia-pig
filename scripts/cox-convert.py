#!/usr/bin/env python3
"""Convert the canonical self-contained Cox game to Trivia Pig's media-aware JSON.

Standard-library only. Run from any directory; use --source for a relocated base.
Composite SVGs preserve the original gameData figure geometry, crops and labels.
The source arrays and unadjusted geometry remain in source-manifest.json.
"""
import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TITLE = 'Plant Pathology · PLSCI 3010 / 5010'
CATEGORY_NOTE = ('The supplied PowerPoint board labels its fifth category MANAGEMENT; '
                 'the canonical gameData labels it Defense. Defense is retained without '
                 'changing the original deck or any clue/answer wording.')


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def composite(side, media):
    """Preserve original slide positions, including every unadjusted label."""
    images = side['images']
    labels = side['labels']
    elements = images + labels
    x0, y0 = min(e['x'] for e in elements), min(e['y'] for e in elements)
    width = max(e['x']+e['w'] for e in elements)-x0
    height = max(e['y']+e['h'] for e in elements)-y0
    # Work in screen pixels; base's figure container is at most 850 px wide.
    scale = 1200 / width
    f = lambda n: f'{n*scale:.6f}'
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="{f(height)}" viewBox="0 0 1200 {f(height)}">',
             f'<title>Original course figures · source slide {side["slide"]}</title>',
             '<rect width="100%" height="100%" fill="white"/>']
    for n, image in enumerate(images):
        crop = image['crop']
        l, r, t, b = (crop.get(k, 0) for k in ('l', 'r', 't', 'b'))
        if min(l, r, t, b) < 0 or l+r >= 1 or t+b >= 1:
            raise ValueError(f'Invalid crop on source slide {side["slide"]}')
        x, y, w, h = image['x']-x0, image['y']-y0, image['w'], image['h']
        iw, ih = w/(1-l-r), h/(1-t-b)
        parts += [f'<defs><clipPath id="crop{n}"><rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"/></clipPath></defs>',
                  f'<image href="{html.escape(media[image["src"]], quote=True)}" x="{f(x-l*iw)}" y="{f(y-t*ih)}" width="{f(iw)}" height="{f(ih)}" preserveAspectRatio="none" clip-path="url(#crop{n})"/>']
    for label in labels:
        # Equivalent to a 20 px label at the base's 850 px desktop width.
        parts.append(f'<text x="{f(label["x"]-x0+label["w"]/2)}" y="{f(label["y"]-y0+label["h"]/2)}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="28.235294" font-weight="700" fill="#101c22">{html.escape(label["text"])}</text>')
    parts.append('</svg>')
    return '\n'.join(parts)+'\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=(ROOT.parent/'base/index.codex.html' if (ROOT.parent/'base/index.codex.html').exists() else ROOT/'scripts/cox-data/offline.html'))
    parser.add_argument('--output', type=Path, default=ROOT/'private/cox-build', help='Private intermediate figures/SVGs; never serve this directory')
    parser.add_argument('--data-output', type=Path, default=ROOT/'scripts/cox-data', help='Private board and source manifest directory')
    parser.add_argument('--media-base', default='/cox', help='URL prefix for deployed composite figures')
    parser.add_argument('--media-format', choices=['svg', 'png'], default='svg', help='PNG requires cox-render.mjs after conversion')
    args = parser.parse_args()
    source = args.source.read_bytes()
    match = re.search(r'<script\b[^>]*\bid=["\']gameData["\'][^>]*>(.*?)</script>', source.decode(), re.S)
    if not match:
        raise ValueError('Canonical gameData JSON script was not found')
    data = json.loads(match[1])
    if len(data['categories']) != 5 or len(data['clues']) != 25 or len(data['media']) != 15:
        raise ValueError('Expected the canonical 5 categories, 25 clues and 15 figures')
    output = args.output
    (output/'figures').mkdir(parents=True, exist_ok=True)
    (output/'composites').mkdir(exist_ok=True)
    figures = []
    for key, uri in data['media'].items():
        mime, encoded = uri.split(';base64,', 1)
        ext = {'data:image/jpeg': 'jpeg', 'data:image/png': 'png'}[mime]
        filename = Path(key).stem+'.'+ext
        image = base64.b64decode(encoded, validate=True)
        (output/'figures'/filename).write_bytes(image)
        figures.append({'sourceKey': key, 'path': 'figures/'+filename, 'sha256': hashlib.sha256(image).hexdigest()})
    categories = []
    slides = []
    count = 0
    for cat_index, name in enumerate(data['categories']):
        clues = []
        for row, value in enumerate([100, 200, 300, 400, 500]):
            candidates = [c for c in data['clues'] if c['cat'] == cat_index and c['value'] == value]
            if len(candidates) != 1 or candidates[0]['id'] != f'{cat_index}-{row}':
                raise ValueError(f'Missing or duplicate clue {cat_index}-{row}')
            source_clue = candidates[0]
            clue = {'id': 'cox-'+source_clue['id'], 'text': '\n\n'.join(source_clue['q']['text']),
                    'answer': '\n\n'.join(source_clue['a']['text']), 'media': None, 'answerMedia': None,
                    'dailyDouble': False}
            if len(clue['text']) > 2000 or len(clue['answer']) > 1000:
                raise ValueError('Source text exceeds upstream BoardContent limits')
            for key, field in [('q', 'media'), ('a', 'answerMedia')]:
                side = source_clue[key]
                if side['images']:
                    stem = f'{source_clue["id"]}-{key}'
                    (output/'composites'/f'{stem}.svg').write_text(composite(side, data['media']))
                    clue[field] = {'type': 'image', 'url': f'{args.media_base.rstrip("/")}/composites/{stem}.{args.media_format}'}
                    count += 1
                slides.append({'clueId': clue['id'], 'side': key, **side})
            clues.append(clue)
        categories.append({'id': f'cox-category-{cat_index}', 'name': name, 'clues': clues})
    board = {'format': 'jeppidy-board', 'title': TITLE,
             'description': '25 original course clues and answers from Kerik’s supplied 51-slide deck. '+CATEGORY_NOTE,
             'tags': ['plant-pathology', 'plsci-3010', 'plsci-5010', 'cox'],
             'content': {'rounds': [{'id': 'cox-round-1', 'kind': 'single', 'name': 'Plant Pathology',
                                     'values': [100, 200, 300, 400, 500], 'categories': categories}], 'final': None}}
    args.data_output.mkdir(parents=True, exist_ok=True)
    dump(args.data_output/'board.json', board)
    dump(args.data_output/'source-manifest.json', {'source': ('scripts/cox-data/offline.html' if args.source.resolve() == (ROOT/'scripts/cox-data/offline.html').resolve() else 'base/index.codex.html')+'#gameData',
        'sourceSha256': hashlib.sha256(source).hexdigest(), 'gameDataSha256': hashlib.sha256(match[1].encode()).hexdigest(),
        'categoryNote': CATEGORY_NOTE, 'categories': data['categories'], 'figures': figures, 'slides': slides,
        'compositePolicy': 'Original figure and label coordinates and crops from gameData, with no label repositioning. Bounding box removes only whitespace around figures and labels. Text arrays joined with two newlines; their wording is unchanged.',
        'dailyDoublePolicy': 'Off, matching the canonical game default. Canonical optional random wager mode is a gameplay setting, not source content.'})
    print(f'Converted 25 clues, 50 text sides, 15 original figures and {count} composite sides to {output}')
    print('Category note: '+CATEGORY_NOTE)


if __name__ == '__main__':
    main()
