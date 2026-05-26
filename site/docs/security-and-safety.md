# Security And Safety Notes

WinSweep can inspect and change local system state. Review actions carefully.

## Destructive actions

- Cleanup and App Data deletion require explicit confirmation.
- Files and folders are sent to the Recycle Bin when possible.
- Registry keys are removed permanently once confirmed.
- WinSweep does not auto-delete residual files after a scan.
- Scheduled cleanup only runs the categories you enable.

## Installer status

WinSweep does not have a code-signing certificate yet. Windows SmartScreen can
warn that the publisher is unverified. Download only from the official GitHub
repository and inspect release notes before installing.

## Windows Update

WinSweep lists pending Windows Update items, but installs are handled by Windows
Settings because system updates require operating system elevation.

## Reporting issues

Report suspicious behavior, deletion mistakes, or installer concerns through
the GitHub issue tracker.
