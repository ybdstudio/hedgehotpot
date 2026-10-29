# Hedge Tasco project rules

- Before changing this game, read `D:\Workspace\gamekit\GAME-RULES.md` and the
  README/INTEGRATE-WITH-AI guide in its highest-version kit, excluding Copy folders.
- This is an existing HS integration upgraded from kit 3.0. Follow the kit's
  upgrade exception: do not migrate the legacy save API as part of packaging.
- Repository: `ybdstudio/hedgetasco`. Manual builds use `native/tiktok-release`; autoplay QA uses `native/tiktok-autoplay-test`.
- Work locally. Push only when the owner explicitly requests a push.
- Preserve the existing hedgehog art and restaurant design.
- Native build: `node tools/build_native.js dist/tiktok-autoplay`.
  Check: `node tools/check_native.mjs dist/tiktok-autoplay/hedgetasco`.
- Keep kit tools and dashboard JSON outside the generated native game folder.
- The owner will supply parameters later. Leave credentials empty; never invent
  an App ID or claim that a blank-App-ID test archive is ready for upload.
- Update `docs/PROGRESS.md` at the end of each session.
