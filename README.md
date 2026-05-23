# WinSweep

A modern Windows app for managing installed software, keeping it updated, and
cleaning up leftover files. Built with Tauri 2, React, TypeScript, Vite,
Tailwind CSS, and Rust.

## Features

- **Installed Apps**: list everything installed, search by name or publisher,
  filter by category, and sort by name, size, or install date. Open an app's
  folder, launch its uninstaller, or select several apps for a bulk uninstall.
  Rows show the app icon, publisher metadata, install details, and a last-used
  indicator derived from Windows launch history when available.
- **Updates**: detect outdated software with winget and update apps one at a
  time or all at once, with inline progress. Microsoft Store apps are surfaced
  alongside regular winget packages and get a `Store` badge so origin stays
  visible without splitting the list.
- **Cleanup**: auto-scan `%AppData%`, `%LocalAppData%`, `%ProgramData%`,
  `%Temp%`, and the registry for residual data, review the results, and remove
  them after an explicit confirmation. Each leftover is tagged with a category
  (Logs, Cache, Config, Data, Crashes, Installer, Other), grouped by the app
  it appears to belong to, and filterable from a chip row at the top. Cleanup
  results can be searched by file name, path, extension, location, kind, size,
  and related app metadata. Deleted files and folders are sent to the Recycle
  Bin (registry keys are removed permanently), and any item can be added to a
  persistent ignore list so future scans skip it. Nothing is ever deleted
  automatically.
- **App Data**: list `%AppData%`, `%LocalAppData%`, and `%ProgramData%`
  folders that map to a currently installed app so you can prune data for
  software you still have but no longer use. Folders go to the Recycle Bin
  after explicit confirmation, with a one-click reveal in Explorer first.
- **Settings**: pick a day of the week and time for an unattended weekly
  sweep of `%Temp%`, the Recycle Bin, and app caches. WinSweep registers a
  Windows Scheduled Task that re-launches the app with `--scheduled-clean`
  and runs the selected categories headlessly.

## Development status

WinSweep is still in development. Some features may not work properly on every
Windows installation. Review uninstall and cleanup actions carefully before
changing software or deleting files.

## Download

Tagged releases publish Windows installers (`.msi` and `.exe`) to the
[Releases page](https://github.com/valetivivek/WinSweep/releases). No code
signing certificate is in use yet, so Windows SmartScreen will warn the
publisher is unverified — click **More info → Run anyway** to install.

## Prerequisites

- Windows 11 (WebView2 is built in)
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable, MSVC toolchain)
- Visual Studio Build Tools with the "Desktop development with C++" workload

## Development

```bash
npm install        # install frontend dependencies
npm run dev        # run the frontend only in a browser (uses mock data)
npm run tauri dev  # run the full desktop app against the real backend
```

The frontend talks to the backend exclusively through `src/lib/api.ts`. When
run outside Tauri (`npm run dev`), that layer falls back to mock data so the UI
stays fully clickable without compiling Rust.

## Cleanup search

Open the Cleanup page and wait for the automatic scan to finish. Use the search
box above the results to filter orphan items live. Search checks:

- File or folder name
- Full path or registry key
- Extension such as `.log`
- Location such as `Temp` or `Registry`
- Kind such as `file`, `folder`, or `registry`
- Related app label and formatted size

Search only filters the review list. It does not delete, move, or modify files.
Hidden selected items stay selected, and the UI warns when selected items are
outside the current search.

## Last used indicators

Installed app rows display a friendly last-used value when reliable metadata is
available, for example `Today`, `Yesterday`, or `3 days ago`. The date comes
from the Windows UserAssist launch history, matched to an app by its install
folder. When Windows has no launch record for an app, WinSweep displays
`Last used unknown` instead of guessing from file timestamps. This avoids slow
directory scans and misleading results.

## Build downloadable packages

```bash
npm run package
```

This runs the Tauri production build and writes local artifacts under
`src-tauri/target/release/bundle/`, such as Windows installer packages when the
platform toolchain supports them. Nothing is published by this command.

The lower-level Tauri command is also available:

```bash
npm run tauri build
```

## Website

The GitHub Pages website lives in `site/` and uses a separate Vite config so it
does not interfere with the desktop app.

```bash
npm run site:dev      # run the website locally
npm run site:build    # build the static site into dist-site/
npm run site:preview  # preview the built website
```

The site includes a hero, feature highlights, development status notice,
download guidance, cleanup workflow, and placeholder screenshot frames that can
be replaced with real desktop screenshots later.

## Manual GitHub Pages deployment later

No deployment has been performed. When you are ready to publish manually:

1. Run `npm run site:build`.
2. Review the generated `dist-site/` output.
3. Publish the contents of `dist-site/` to a `gh-pages` branch, or add a GitHub
   Actions workflow that runs `npm ci` and `npm run site:build`.
4. In the repository settings, configure GitHub Pages to serve that branch or
   workflow artifact.

No git commit, push, GitHub release, or GitHub Pages deployment has been
performed in this work.

## Architecture

- `src/` React + TypeScript frontend, styled with Tailwind CSS.
  - `pages/` one file per page (Installed Apps, Updates, Cleanup, App Data,
    Settings).
  - `components/` shared UI: sidebar, page header, and `ui/` primitives.
  - `lib/` types, formatting, the theme store, and the `api.ts` backend bridge.
- `src-tauri/src/` Rust backend, one module per domain:
  - `apps.rs` registry enumeration, uninstall, open location, icon extraction.
  - `updates.rs` winget upgrade detection (including the `msstore` source)
    and installation.
  - `cleanup.rs` residual scanning, categorization, Recycle-Bin deletion, and
    the persistent ignore list.
  - `app_data.rs` mapping live AppData folders to installed apps and Recycle
    Bin deletion of selected folders.
  - `schedule.rs` Windows Scheduled Task registration and the headless
    `--scheduled-clean` entry point.
- `.github/workflows/release.yml` tag-driven build that publishes MSI and NSIS
  installers to a GitHub Release via `tauri-action`.
- `site/` React + Vite static website for GitHub Pages.
