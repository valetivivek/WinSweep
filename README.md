# WinSweep

A modern Windows app for managing installed software, keeping it updated, and
cleaning up leftover files. Built with Tauri 2, React, TypeScript, Vite,
Tailwind CSS, and Rust.

## Features

- **Installed Apps**: list everything installed, search by name, sort by name,
  size, or install date, open an app's folder, or launch its uninstaller.
- **Updates**: detect outdated software with winget and update apps one at a
  time or all at once, with inline progress.
- **Cleanup**: auto-scan `%AppData%`, `%LocalAppData%`, `%ProgramData%`,
  `%Temp%`, and the registry for residual data, review the results, and remove
  them after an explicit confirmation. Nothing is ever deleted automatically.

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

## Build

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
