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

[0.2.0]: https://github.com/valetivivek/WinSweep/releases/tag/v0.2.0
[0.1.0]: https://github.com/valetivivek/WinSweep/releases/tag/v0.1.0
