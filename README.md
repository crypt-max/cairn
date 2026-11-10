# CAIRN — crypto signals site (static)

Plain HTML/CSS/JS, no build step. All paths are relative, so it works on GitHub Pages under a sub-path.

## Local preview
    cd site && python3 -m http.server 8787   →  http://127.0.0.1:8787/

## Deploy to GitHub Pages
1. Create a repo and push the contents of this `site/` folder to `main` (root).
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. `.nojekyll` is already here so files are served as-is.

## Before launch — replace placeholders
- `js/main.js` → `TG_URL` — the real Telegram link (all "Join" buttons use it).
- Journal, tape, hero demo trades, prices — all marked DEMO (`js/main.js` → `J`, `index.html` plans).
- Official addresses block (`@cairn_signals` placeholder) and the brand name if CAIRN changes.
- Videos in `media/` are rendered from `../video/*` (HyperFrames): `../tools/render_all.sh`.
