"""Package the offline review candidate, clearly distinct from an upload ZIP."""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist/tiktok-native'
GAME = OUT / 'hedgehotpot'
REPORT = ROOT / 'docs/qa/hs-sdk-1.1.3.json'


def main():
    report = json.loads(REPORT.read_text(encoding='utf-8'))
    if not report['ok'] or not all(f['unchanged'] for f in report['sdkFiles'].values()):
        raise SystemExit('Review archive blocked: checker failed or SDK integrity mismatch')
    browser = json.loads((ROOT / 'docs/qa/native-release-browser.json').read_text(encoding='utf-8'))
    if not browser.get('pass'):
        raise SystemExit('Review archive blocked: native browser review failed')
    target = OUT / 'HedgeHotpot_TikTok_native_review_draft.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in GAME.rglob('*'):
            if file.is_file():
                archive.write(file, file.relative_to(OUT).as_posix())
        archive.write(OUT / 'hedgehotpot.hs-dashboard.json', 'hedgehotpot.hs-dashboard.json')
        archive.write(REPORT, 'review/hs-check.json')
        archive.write(ROOT / 'docs/qa/native-release-browser.json', 'review/browser-tests.json')
        archive.write(ROOT / 'docs/NATIVE_RELEASE.md', 'REVIEW_README.md')
    with zipfile.ZipFile(target) as archive:
        if archive.testzip():
            raise SystemExit('Archive integrity check failed')
    print(f'{target} ({target.stat().st_size / 1048576:.2f} MB)')
    print('REVIEW DRAFT ONLY: real IDs/credentials are still required for official TikTok packaging.')


if __name__ == '__main__':
    main()
