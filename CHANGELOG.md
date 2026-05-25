## [0.3.0] - 2026-05-25

### Added
- **Living-organism UI redesign**: ambient breathing background gradient,
  organic sidebar with a soft inner edge and a living dot on the active
  item, membrane surfaces with soft inset glow on hover, row vein
  highlight on hover, warm-tissue accent that tints the Cleanup page
  background when residuals are found.
- **Launch splash**: branded splash with breathing logo, wordmark,
  indeterminate progress, and rotating status lines while the backend
  warms up. Minimum 600ms, capped at 6s.
- **Skeleton loaders**: per-page shimmer placeholders replace the
  full-screen spinner on Installed Apps, Updates, Cleanup, and App Data.
- **Hero strip** on every data page: big mono headline metric, faint
  label, and contextual chips above the existing title.
- **Windows Update detection**: Updates page now also queries the
  Windows Update Agent (Microsoft.Update.Session COM, no external
  modules) and lists pending system updates alongside winget apps. A
  one-click button jumps to Windows Settings → Windows Update to install
  them, since Windows Update installs require system elevation.

### Changed
- **Installed Apps row layout**: Version, Size, and Installed columns
  are now left-aligned with consistent column gaps; hover actions are
  absolutely positioned with a gradient fade-in so the row has no idle
  right-side gutter.
- **Cleanup and App Data rows**: same alignment pass — left-aligned
  metadata columns, grouped pills, gradient-fade hover actions.
- **Sidebar Cleanup icon** swapped from Sparkles to BrushCleaning for a
  clearer visual.
- **Empty states**: dashed-border boxes replaced with a centered
  breathing dot and copy.
- **Selection action bar** on Installed Apps is now a slide-up pill
  anchored to the bottom of the viewport, replacing the inline banner
  that shifted page layout.

### Removed
- The "last used" affordance on the Installed Apps page. Backend
  metadata field remains; the UI no longer surfaces it.

### Known limitations
- Windows Update install requires admin elevation, so WinSweep lists
  pending updates and opens Windows Settings rather than installing
  them in-app.
- No code-signing certificate yet, so Windows SmartScreen still warns
  the publisher is unverified during install.

## [0.2.0] - 2026-05-23

### Added
- **App Data page**: list `%AppData%`, `%LocalAppData%`, and `%ProgramData%`
  folders that map to currently installed apps, with size, last-modified, a
  reveal-in-Explorer action, and Recycle Bin deletion behind explicit
  confirmation.
- **Settings page** with a weekly scheduled cleanup card: pick a day of the
  week, time, and categories (Temp, Recycle Bin, app caches). Registers a
  Windows Scheduled Task that re-launches the app with `--scheduled-clean`
  and runs headlessly.
- **Cleanup categorization**: every residual is tagged Logs, Cache, Config,
  Data, Crashes, Installer, or Other. A chip row filters by category with
  per-chip item counts and reclaimable bytes; items are grouped collapsibly
  by the inferred app.
- **Microsoft Store updates**: the Updates page now also queries the
  `msstore` winget source and shows a Store badge on rows that come from it.
- **Number-key shortcuts** 1 through 5 jump between the five pages.
- **MSI and NSIS installers** built and drafted to GitHub Releases by a
  tag-driven GitHub Actions workflow (`tauri-action`).

### Changed
- README documents all five pages, the Microsoft Store update flow, and the
  Download section pointing at GitHub Releases.
- `tauri.conf.json` bundle metadata: publisher, homepage, description, MSI
  (WiX) and NSIS targets, per-user install mode.

### Known limitations
- No code-signing certificate yet, so Windows SmartScreen warns the
  publisher is unverified during install. Click **More info → Run anyway**.
- Driver updates, restore-point safety net, in-app auto-updater, and a
  global one-click quick-sweep are on the roadmap but not shipped.

## [0.1.0] - 2026-05-22

### Added
- Initial release with Installed Apps, Updates (winget), and Cleanup pages.
- Residual file/folder scanning across `%AppData%`, `%LocalAppData%`,
  `%ProgramData%`, `%Temp%`, and the registry, with Recycle Bin deletion.
- Persistent cleanup ignore list, app icon extraction, last-used indicator
  from the Windows UserAssist registry, bulk uninstall.

[0.3.0]: https://github.com/valetivivek/WinSweep/releases/tag/v0.3.0
[0.2.0]: https://github.com/valetivivek/WinSweep/releases/tag/v0.2.0
[0.1.0]: https://github.com/valetivivek/WinSweep/releases/tag/v0.1.0
