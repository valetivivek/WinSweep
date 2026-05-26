# Website Deployment Notes

The `site` folder is a static website. There is no build step.

## Manual preview

```powershell
cd site
node local-server.cjs
```

Open `http://localhost:4173`.

## GitHub Pages with Actions

Use a GitHub Pages workflow that uploads the `site` folder as the Pages
artifact. A typical workflow:

1. Check out the repository.
2. Upload `site` as the static artifact.
3. Deploy the artifact with the official GitHub Pages deploy action.

## Manual branch deployment

You can also copy the contents of `site` to a `gh-pages` branch and configure
GitHub Pages to serve that branch.

## Required checks before publishing

- Confirm release links point to the intended repository.
- Replace HTML-rendered preview frames with real app screenshots if desired.
- Review privacy, license, safety, and third-party notices.
- Verify the site at desktop and mobile widths.
