const root = document.documentElement;
const header = document.querySelector(".site-header");
const sentinel = document.querySelector(".scroll-sentinel");
const themeToggle = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");

// Theme is intentionally tiny and local. The static site does not need a framework.
const savedTheme = localStorage.getItem("winsweep-site-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

function setTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem("winsweep-site-theme", theme);
  if (themeLabel) {
    themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
  }
}

setTheme(initialTheme);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });
}

function setMenu(open) {
  if (!nav || !navToggle) return;
  nav.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
}

if (navToggle) {
  navToggle.addEventListener("click", () => {
    setMenu(navToggle.getAttribute("aria-expanded") !== "true");
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

// IntersectionObserver avoids a scroll listener while still giving the nav a settled state.
if (header && sentinel && "IntersectionObserver" in window) {
  const headerObserver = new IntersectionObserver(([entry]) => {
    header.dataset.elevated = String(!entry.isIntersecting);
  });
  headerObserver.observe(sentinel);
}

// Mock data mirrors the current app surfaces. It keeps the website preview honest.
const screens = {
  installed: {
    kicker: "Library",
    title: "Installed Apps",
    subtitle: "Search, sort, locate, and uninstall software.",
    metric: "147",
    label: "Applications",
    search: "Search by name or publisher",
    chips: ["Name", "Size", "Installed"],
    rows: [
      ["PowerToys", "Microsoft", "1.8 GB", "accent"],
      ["Rustup", "Rust Foundation", "742 MB", "muted"],
      ["Figma", "Figma, Inc.", "512 MB", "warm"],
    ],
  },
  updates: {
    kicker: "Maintenance",
    title: "Updates",
    subtitle: "Check winget, Microsoft Store, and Windows Update.",
    metric: "8",
    label: "Pending",
    search: "Package source: winget and msstore",
    chips: ["Apps", "System", "Store"],
    rows: [
      ["Visual Studio Code", "1.100.1 -> 1.101.0", "winget", "accent"],
      ["Windows Security Update", "KB5060123", "812 MB", "warm"],
      ["PowerShell", "7.4.6 -> 7.5.1", "winget", "muted"],
    ],
  },
  cleanup: {
    kicker: "Reclaim Space",
    title: "Cleanup",
    subtitle: "Review orphaned files, folders, and registry keys.",
    metric: "4.7 GB",
    label: "Reclaimable",
    search: "Search orphan files, paths, .log, registry",
    chips: ["Logs", "Cache", "Config"],
    rows: [
      ["Slack", "%AppData%\\Slack\\Cache", "Cache", "accent"],
      ["Docker", "HKCU\\Software\\Docker", "Registry", "warm"],
      ["Zoom", "%Temp%\\zoom-crash.dmp", "Crashes", "muted"],
    ],
  },
  appdata: {
    kicker: "App Data",
    title: "App Data",
    subtitle: "Prune data folders for apps still installed.",
    metric: "39",
    label: "Folders",
    search: "Search by app or path",
    chips: ["Size", "Name", "Recent"],
    rows: [
      ["JetBrains", "%LocalAppData%\\JetBrains", "3.1 GB", "accent"],
      ["Discord", "%AppData%\\discord", "896 MB", "muted"],
      ["Spotify", "%AppData%\\Spotify", "428 MB", "warm"],
    ],
  },
  settings: {
    kicker: "Preferences",
    title: "Settings",
    subtitle: "Schedule unattended weekly cleanup.",
    metric: "Sun",
    label: "02:30 local",
    search: "Weekly cleanup task",
    chips: ["Temp", "Recycle Bin", "Caches"],
    rows: [
      ["Temporary files", "%TEMP%", "Enabled", "accent"],
      ["Recycle Bin", "Empty at schedule", "Enabled", "warm"],
      ["App caches", "LocalAppData cache folders", "Paused", "muted"],
    ],
  },
};

const screenButtons = document.querySelectorAll("[data-screen]");
const screenTitle = document.querySelector("[data-screen-title]");
const screenKicker = document.querySelector("[data-screen-kicker]");
const screenSubtitle = document.querySelector("[data-screen-subtitle]");
const screenMetric = document.querySelector("[data-screen-metric]");
const screenLabel = document.querySelector("[data-screen-label]");
const screenSearch = document.querySelector("[data-screen-search]");
const screenChipA = document.querySelector("[data-screen-chip-a]");
const screenChipB = document.querySelector("[data-screen-chip-b]");
const screenChipC = document.querySelector("[data-screen-chip-c]");
const screenList = document.querySelector("[data-screen-list]");
const quickPanel = document.querySelector("[data-quick-panel]");
const previewReady =
  screenList &&
  screenTitle &&
  screenKicker &&
  screenSubtitle &&
  screenMetric &&
  screenLabel &&
  screenSearch &&
  screenChipA &&
  screenChipB &&
  screenChipC;

function dotClass(tone) {
  if (tone === "warm") return "status-dot warm";
  if (tone === "muted") return "status-dot muted";
  return "status-dot";
}

function renderRows(rows) {
  if (!screenList) return;
  screenList.replaceChildren(
    ...rows.map(([name, detail, value, tone]) => {
      const row = document.createElement("div");
      row.className = "mock-row";

      const dot = document.createElement("span");
      dot.className = dotClass(tone);

      const title = document.createElement("strong");
      title.textContent = name;

      const meta = document.createElement("span");
      meta.textContent = detail;

      const amount = document.createElement("span");
      amount.className = "tabular";
      amount.textContent = value;

      row.append(dot, title, meta, amount);
      return row;
    }),
  );
}

function setScreen(key) {
  if (key === "quickSweep") {
    screenButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.screen === key);
    });
    if (quickPanel) {
      quickPanel.classList.add("active");
      quickPanel.setAttribute("aria-hidden", "false");
    }
    return;
  }

  if (quickPanel) {
    quickPanel.classList.remove("active");
    quickPanel.setAttribute("aria-hidden", "true");
  }

  const data = screens[key];
  if (!data || !previewReady) return;
  screenButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === key);
  });
  screenKicker.textContent = data.kicker;
  screenTitle.textContent = data.title;
  screenSubtitle.textContent = data.subtitle;
  screenMetric.textContent = data.metric;
  screenLabel.textContent = data.label;
  screenSearch.textContent = data.search;
  screenChipA.textContent = data.chips[0];
  screenChipB.textContent = data.chips[1];
  screenChipC.textContent = data.chips[2];
  renderRows(data.rows);
}

screenButtons.forEach((button) => {
  button.addEventListener("click", () => setScreen(button.dataset.screen));
});

if (previewReady) {
  setScreen("installed");
}

// Legal pages and the homepage share a restrained reveal, skipped for reduced motion.
const revealTargets = document.querySelectorAll(
  "section, .feature, .workflow-track article, .release-panel, .status-list div, .legal-grid article, .site-footer, .doc-hero, .doc-panel, .doc-card, .doc-section",
);

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  revealTargets.forEach((target) => {
    target.classList.add("reveal");
    revealObserver.observe(target);
  });
} else {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
}
