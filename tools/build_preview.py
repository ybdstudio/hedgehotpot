"""Build one self-contained offline HTML file. Requires only Python."""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'dist'


def inline_script(match):
    source = match.group(1)
    code = (ROOT / source).read_text(encoding='utf-8')
    if source == 'js/manifest.js':
        def embed(asset):
            data = base64.b64encode((ROOT / asset.group(1)).read_bytes()).decode('ascii')
            return '"file":"data:image/webp;base64,' + data + '"'
        code = re.sub(r'"file":"(assets/[^"\n]+\.webp)"', embed, code)
    code = re.sub(r'</script', r'<\\/script', code, flags=re.I)
    return '<script>\n' + code + '\n</script>'


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
    if re.search(r'<script[^>]+src=|<link[^>]+rel="stylesheet"', html):
        raise RuntimeError('The preview still contains external code dependencies')
    target = OUTPUT / 'hedge-hotpot-preview.html'
    target.write_text(html, encoding='utf-8')
    print(f'{target} ({target.stat().st_size / 1048576:.2f} MB, standalone/offline)')


if __name__ == '__main__':
    main()
