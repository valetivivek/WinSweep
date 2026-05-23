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
  time or all at once, with inline progress.
- **Cleanup**: auto-scan `%AppData%`, `%LocalAppData%`, `%ProgramData%`,
  `%Temp%`, and the registry for residual data, review the results, and remove
  them after an explicit confirmation. Cleanup results can be searched by file
  name, path, extension, location, kind, size, and related app metadata.
  Deleted files and folders are sent to the Recycle Bin (registry keys are
  removed permanently), and any item can be added to a persistent ignore list
  so future scans skip it. Nothing is ever deleted automatically.

## Development status

WinSweep is still in development. Some features may not work properly on every
Windows installation. Review uninstall and cleanup actions carefully before
changing software or deleting files.

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

## Architecture

- `src/` React + TypeScript frontend, styled with Tailwind CSS.
  - `pages/` one file per page (Installed Apps, Updates, Cleanup).
  - `components/` shared UI: sidebar, page header, and `ui/` primitives.
  - `lib/` types, formatting, the theme store, and the `api.ts` backend bridge.
- `src-tauri/src/` Rust backend, one module per domain:
  - `apps.rs` registry enumeration, uninstall, open location.
  - `updates.rs` winget upgrade detection and installation.
  - `cleanup.rs` residual scanning and guarded deletion.
