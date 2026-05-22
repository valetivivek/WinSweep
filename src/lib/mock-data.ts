import type { AppUpdate, InstalledApp, ResidualItem } from "./types";

/* Mock data for UI development. Replaced by Tauri commands once the backend
   is wired up. Kept deliberately varied (missing sizes, odd dates) so the UI
   handles real-world gaps. */

export const MOCK_INSTALLED_APPS: InstalledApp[] = [
  { id: "1", name: "Visual Studio Code", publisher: "Microsoft Corporation", version: "1.97.2", sizeBytes: 367_001_600, installDate: "2024-11-03", installLocation: "C:\\Users\\Cricky\\AppData\\Local\\Programs\\Microsoft VS Code" },
  { id: "2", name: "Google Chrome", publisher: "Google LLC", version: "133.0.6943.98", sizeBytes: 612_368_384, installDate: "2024-08-21", installLocation: "C:\\Program Files\\Google\\Chrome\\Application" },
  { id: "3", name: "Spotify", publisher: "Spotify AB", version: "1.2.53.440", sizeBytes: 198_180_864, installDate: "2025-01-14", installLocation: "C:\\Users\\Cricky\\AppData\\Roaming\\Spotify" },
  { id: "4", name: "Steam", publisher: "Valve Corporation", version: "2025.02.1", sizeBytes: 4_509_715_660, installDate: "2023-12-09", installLocation: "C:\\Program Files (x86)\\Steam" },
  { id: "5", name: "Discord", publisher: "Discord Inc.", version: "1.0.9189", sizeBytes: 289_406_976, installDate: "2024-10-30", installLocation: "C:\\Users\\Cricky\\AppData\\Local\\Discord" },
  { id: "6", name: "7-Zip", publisher: "Igor Pavlov", version: "24.09", sizeBytes: 5_452_595, installDate: "2024-02-17", installLocation: "C:\\Program Files\\7-Zip" },
  { id: "7", name: "Notion", publisher: "Notion Labs, Inc.", version: "4.2.0", sizeBytes: 312_475_648, installDate: "2025-03-02", installLocation: "C:\\Users\\Cricky\\AppData\\Local\\Programs\\Notion" },
  { id: "8", name: "NVIDIA GeForce Experience", publisher: "NVIDIA Corporation", version: "3.28.0.417", sizeBytes: 1_181_116_006, installDate: "2024-06-11", installLocation: "C:\\Program Files\\NVIDIA Corporation" },
  { id: "9", name: "VLC media player", publisher: "VideoLAN", version: "3.0.21", sizeBytes: 167_772_160, installDate: "2023-09-28", installLocation: "C:\\Program Files\\VideoLAN\\VLC" },
  { id: "10", name: "Figma", publisher: "Figma, Inc.", version: "124.6.4", sizeBytes: 245_366_784, installDate: "2025-02-19", installLocation: "C:\\Users\\Cricky\\AppData\\Local\\Figma" },
  { id: "11", name: "Git", publisher: "The Git Development Community", version: "2.48.1", sizeBytes: 348_966_912, installDate: "2024-11-03", installLocation: "C:\\Program Files\\Git" },
  { id: "12", name: "Node.js", publisher: "OpenJS Foundation", version: "22.14.0", sizeBytes: 89_128_960, installDate: "2025-01-22", installLocation: "C:\\Program Files\\nodejs" },
  { id: "13", name: "OBS Studio", publisher: "OBS Project", version: "31.0.1", sizeBytes: 423_624_704, installDate: "2024-12-15", installLocation: "C:\\Program Files\\obs-studio" },
  { id: "14", name: "Zoom Workplace", publisher: "Zoom Video Communications, Inc.", version: "6.3.11", sizeBytes: 134_217_728, installDate: "2024-07-04", installLocation: "C:\\Users\\Cricky\\AppData\\Roaming\\Zoom" },
  { id: "15", name: "PowerToys", publisher: "Microsoft Corporation", version: "0.89.0", sizeBytes: 421_527_552, installDate: "2025-03-18", installLocation: "C:\\Program Files\\PowerToys" },
  { id: "16", name: "WinRAR", publisher: "win.rar GmbH", version: "7.10", sizeBytes: 11_534_336, installDate: "2022-05-30", installLocation: "C:\\Program Files\\WinRAR" },
  { id: "17", name: "Adobe Acrobat Reader", publisher: "Adobe Inc.", version: "24.005.20320", sizeBytes: 678_428_672, installDate: "2024-04-12", installLocation: "C:\\Program Files\\Adobe\\Acrobat Reader" },
  { id: "18", name: "Microsoft Edge WebView2 Runtime", publisher: "Microsoft Corporation", version: "133.0.3065.69", sizeBytes: null, installDate: null, installLocation: "C:\\Program Files (x86)\\Microsoft\\EdgeWebView" },
];

export const MOCK_UPDATES: AppUpdate[] = [
  { id: "2", name: "Google Chrome", publisher: "Google LLC", currentVersion: "133.0.6943.98", availableVersion: "134.0.6998.36" },
  { id: "3", name: "Spotify", publisher: "Spotify AB", currentVersion: "1.2.53.440", availableVersion: "1.2.57.463" },
  { id: "5", name: "Discord", publisher: "Discord Inc.", currentVersion: "1.0.9189", availableVersion: "1.0.9201" },
  { id: "13", name: "OBS Studio", publisher: "OBS Project", currentVersion: "31.0.1", availableVersion: "31.0.2" },
  { id: "15", name: "PowerToys", publisher: "Microsoft Corporation", currentVersion: "0.89.0", availableVersion: "0.90.0" },
];

export const MOCK_RESIDUALS: ResidualItem[] = [
  { id: "r1", relatedTo: "Adobe Photoshop", kind: "folder", location: "AppData", path: "C:\\Users\\Cricky\\AppData\\Roaming\\Adobe\\Photoshop", sizeBytes: 248_512_512 },
  { id: "r2", relatedTo: "Slack", kind: "folder", location: "LocalAppData", path: "C:\\Users\\Cricky\\AppData\\Local\\slack\\Cache", sizeBytes: 89_653_248 },
  { id: "r3", relatedTo: "Epic Games Launcher", kind: "folder", location: "ProgramData", path: "C:\\ProgramData\\Epic\\EpicGamesLauncher", sizeBytes: 412_876_800 },
  { id: "r4", relatedTo: "Old Java Runtime", kind: "file", location: "Temp", path: "C:\\Users\\Cricky\\AppData\\Local\\Temp\\jre-installer.log", sizeBytes: 2_097_152 },
  { id: "r5", relatedTo: "uTorrent", kind: "registry", location: "Registry", path: "HKCU\\Software\\uTorrent", sizeBytes: 0 },
  { id: "r6", relatedTo: "Adobe Photoshop", kind: "registry", location: "Registry", path: "HKCU\\Software\\Adobe\\Photoshop\\26.0", sizeBytes: 0 },
  { id: "r7", relatedTo: "WinZip", kind: "folder", location: "AppData", path: "C:\\Users\\Cricky\\AppData\\Roaming\\WinZip", sizeBytes: 15_728_640 },
  { id: "r8", relatedTo: "Skype", kind: "folder", location: "LocalAppData", path: "C:\\Users\\Cricky\\AppData\\Local\\Packages\\Microsoft.SkypeApp", sizeBytes: 134_217_728 },
  { id: "r9", relatedTo: "Old Driver Cache", kind: "folder", location: "Temp", path: "C:\\Users\\Cricky\\AppData\\Local\\Temp\\nvidia-cache", sizeBytes: 567_328_768 },
  { id: "r10", relatedTo: "Razer Synapse", kind: "registry", location: "Registry", path: "HKLM\\SOFTWARE\\Razer\\Synapse", sizeBytes: 0 },
];
