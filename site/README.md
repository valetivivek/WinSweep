# WinSweep Website

This folder contains the static single-page website for WinSweep. It is
intended for GitHub Pages or any static host.

## Files

- `index.html`: the full single-page website.
- `styles.css`: visual system, responsive layout, light and dark themes.
- `script.js`: theme toggle, mobile navigation, and product preview tabs.
- `assets/`: copied website assets, including the WinSweep app icon.
- `docs/`: policy, license, safety, deployment, and third-party notes.
  Designed HTML pages live beside the raw Markdown notes.

## Local preview

From this folder:

```powershell
node local-server.cjs
```

Then open `http://localhost:4173`.

You can also open `index.html` directly in a browser because the site has no
build step and no external runtime dependencies.

## GitHub Pages

Use a GitHub Actions Pages workflow that uploads this `site` folder as the
artifact, or copy the contents of this folder to a Pages branch. See
`docs/deployment.md` for a fuller checklist.
