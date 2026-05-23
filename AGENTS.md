# WinSweep

A modern Windows app for managing installed software, cleaning up leftover
files, and keeping your system tidy. Built with Tauri 2, React, TypeScript,
Vite, Tailwind CSS, and Rust.

---

## Project goal

WinSweep gives users a clean, fast, and well-designed way to manage their
Windows system. The focus is on three things: seeing what is installed,
keeping software up to date via winget, and removing residual files left
behind after uninstalls. The app should feel modern and intentional, not
like a utility tool from 2015.

---

## Tech stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Shell       | Tauri 2                           |
| Frontend    | React 19 + TypeScript + Vite      |
| Styling     | Tailwind CSS v4                    |
| Font        | JetBrains Mono                    |
| Backend     | Rust (Tauri commands)             |
| Updates     | winget (Windows Package Manager)  |
| Renderer    | WebView2 (built into Windows 11)  |

---

## Pages

### 1. Installed Apps (main page)

- Lists all installed applications on the system
- Search bar to filter apps by name
- Sort by: name, size, install date
- Actions per app: uninstall, open file location
- No Win32 vs Store app distinction in the UI, treat all apps uniformly

### 2. Updates

- Detects outdated software using winget
- Displays available updates with current and new version
- User can update individual apps or all at once
- Show update progress inline

### 3. Cleanup

- Scans automatically when the page is opened
- Shows a progress indicator while scanning
- Detects residual files and folders left behind after uninstalls
- Scans: %AppData%, %LocalAppData%, %ProgramData%, %Temp%, and registry
- User reviews results before anything is deleted
- Confirm before deleting, never auto-delete

---

## Design principles

- Default theme is light mode. Dark mode is supported and user-togglable.
- A single fixed accent (electric iris) carries actions, selection, and focus.
  There is no accent picker: one deliberate accent keeps the app coherent.
- The design should feel humanized, not clinical. Avoid heavy card grids.
  Prefer clean lists, generous whitespace, and subtle borders over shadows.
- One visual motif should repeat uniformly across the whole app: consistent
  border radius, divider style, hover states, and spacing scale. The app
  should feel like it was designed as a whole, not assembled page by page.
- Typography and spacing do the heavy lifting, not decorative elements.
- Inspired visually by: Pear Cleaner, Linear, Raycast.

---

## Conventions

- All Rust backend logic lives in Tauri commands, kept thin and focused.
- Frontend fetches data from Rust via invoke(), never does system calls
  directly.
- Mock data is used during UI development before Rust commands are wired up.
- UI is built page by page with mocked data first, then backend is connected.
- No em dashes anywhere in code comments, UI copy, or documentation. Use
  commas, colons, or hyphens instead.
- Component names are PascalCase. Files are kebab-case.
- Tailwind only for styling, no inline styles, no CSS modules.

---

## Scope boundaries

- Windows only, no cross-platform support planned.
- No Microsoft Store distribution, GitHub only.
- No telemetry, no analytics, no network calls except winget.
- Do not auto-delete anything without explicit user confirmation.
- Do not expose Win32 vs Store app distinction in the UI.