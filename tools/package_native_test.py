"""Package the native offline test build at ZIP root, with credentials deferred.

This is intentionally not the official upload packer: it does not declare a
blank-App-ID build upload-ready. Use --release --zip after configuration.
"""
import hashlib
import argparse
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / 'dist/tiktok-test/hedgehotpot'
OUTPUT = ROOT.parent / 'HedgeHotpot_TikTok_Native_Test.zip'


def main():
    global PACKAGE, OUTPUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', type=Path, default=PACKAGE)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    PACKAGE = args.package.resolve()
    OUTPUT = args.output.resolve()
    report = json.loads((ROOT / 'docs/qa/hs-sdk-1.1.3.json').read_text(encoding='utf-8'))
    if not report['ok']:
        raise SystemExit('HS checker must pass before packaging')
    for name in ['game.js', 'game.json', 'project.config.json', 'hs-game.js', 'hs-sdk.min.js']:
        if not (PACKAGE / name).is_file():
            raise SystemExit('Missing native entry file: ' + name)
    for name in ['hs-game.js', 'hs-sdk.min.js']:
        digest = hashlib.sha256((PACKAGE / name).read_bytes()).hexdigest()
        if digest != report['sdkFiles'][name]['original']:
            raise SystemExit('SDK integrity mismatch: ' + name)
    files = sorted(file for file in PACKAGE.rglob('*') if file.is_file())
    for file in files:
        if file.is_symlink() or not file.stat().st_size:
            raise SystemExit('Symlink or empty file in native package: ' + str(file))
        if file.suffix.lower() in ['.html', '.env', '.pem', '.key', '.keystore'] or file.name.endswith('.hs-dashboard.json'):
            raise SystemExit('Unexpected upload content: ' + str(file))
    with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, file.relative_to(PACKAGE).as_posix())
    with zipfile.ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        assert 'game.js' in archive.namelist() and 'game.json' in archive.namelist()
    print(f'{OUTPUT} ({OUTPUT.stat().st_size / 1048576:.2f} MB, {len(files)} files)')
    print('Offline test build. App ID is still required for actual TikTok upload.')


if __name__ == '__main__':
    main()
