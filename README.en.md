# Bookmarks Manager (Chrome Extension)

<p align="left">
  <a href="https://github.com/yongtaozheng/bookmarks-manage/stargazers" target="_blank">
    <img src="https://img.shields.io/github/stars/yongtaozheng/bookmarks-manage?style=social" alt="GitHub stars" />
  </a>
  <a href="https://github.com/yongtaozheng/bookmarks-manage/fork" target="_blank">
    <img src="https://img.shields.io/github/forks/yongtaozheng/bookmarks-manage?style=social" alt="GitHub forks" />
  </a>
  <a href="https://github.com/yongtaozheng/bookmarks-manage/issues" target="_blank">
    <img src="https://img.shields.io/github/issues/yongtaozheng/bookmarks-manage" alt="GitHub issues" />
  </a>
  <a href="https://github.com/yongtaozheng/bookmarks-manage/blob/main/LICENSE" target="_blank">
    <img src="https://img.shields.io/github/license/yongtaozheng/bookmarks-manage" alt="License" />
  </a>
  <a href="https://gitee.com/zheng_yongtao/bookmarks-manage/stargazers" target="_blank">
    <img src="https://gitee.com/zheng_yongtao/bookmarks-manage/badge/star.svg?theme=gvp" alt="Gitee stars" />
  </a>
  <a href="https://gitee.com/zheng_yongtao/bookmarks-manage/members" target="_blank">
    <img src="https://gitee.com/zheng_yongtao/bookmarks-manage/badge/fork.svg?theme=gvp" alt="Gitee forks" />
  </a>
  <img src="https://img.shields.io/badge/Vue-3.5-brightgreen" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.4-ff69b4" alt="Vite" />
  <img src="https://img.shields.io/badge/Manifest-V3-orange" alt="Chrome Manifest V3" />
</p>

A modern Chrome bookmarks manager extension (Manifest V3) built with Vue 3 + TypeScript + Vite. Features local bookmark tree management, Gitee cloud sync, global smart search, customizable keyboard shortcuts, password protection, theme switching, duplicate detection, broken link detection, and more.

## Features

- **Bookmark Tree Management**: Visualize and manage bookmarks with multi-level folders, batch delete, hide/show bookmarks, and drag-and-drop sorting.
- **Global Search**: Press a modifier key repeatedly (default: triple Cmd/Ctrl/Alt) on any page to open the search box. Supports fuzzy matching of titles and URLs, folder browsing by name, and smart ranking by usage frequency and recency.
- **Gitee Cloud Sync**: Sync local bookmarks to a Gitee repository with four modes — overwrite save, merge save, overwrite fetch, and merge fetch — with recursive deduplication on merge.
- **Customizable Shortcuts**: Configure the global search trigger key, press count, time window, and close-tab shortcut in the Popup panel. Changes take effect immediately across all open tabs.
- **Bookmark Hiding**: Hide specific bookmarks with persistent state stored in IndexedDB. Hidden bookmarks can optionally be preserved during cloud sync.
- **Password Protection**: Protect the extension popup with a password lock. When enabled, a password is required each time the popup opens. Password configuration is stored in the Gitee repository for automatic multi-device sync.
- **Theme Switching**: Choose between Light, Dark, or System (auto) theme modes with one click. Preference is automatically saved and synced across extension pages.
- **Duplicate Detection**: Detect duplicate bookmarks by exact URL match or fuzzy title match (Dice similarity algorithm). Batch select and delete duplicates.
- **Broken Link Detection**: Automatically verify all bookmark URLs with concurrent HTTP checks, real-time progress, status filtering, and batch deletion of broken links.
- **Data Security**: Gitee configuration stored in browser IndexedDB; shortcut settings and bookmark usage data stored in chrome.storage.local.

## Getting Started

### Clone

```bash
git clone https://github.com/yongtaozheng/bookmarks-manage.git
cd bookmarks-manage
```

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

- Visit `http://localhost:5173` for UI preview (debugging only).
- For extension development, use Chrome's "Load unpacked" and select the `dist` folder.

### Build

```bash
npm run build
```

Build output is in the `dist/` directory, ready for Chrome extension loading.

### Package as zip

```bash
npm run zip
```

Packages `dist/` into `dist.zip` for distribution.

## Directory Structure

```
bookmarks-manage/
├── public/                  # Public assets
│   └── icon.png             # Extension icon
├── src/
│   ├── components/          # Vue components
│   │   └── BookmarkTree.vue # Recursive bookmark tree component
│   ├── App.vue              # New tab page main UI
│   ├── main.ts              # Vue app entry point
│   ├── popup.ts             # Popup panel logic (Gitee sync, shortcut settings, password protection)
│   ├── content-search.ts    # Content script (global search, shortcut handling)
│   ├── background.ts        # Service Worker (message relay, tab management, link checking)
│   ├── bookmark-manager.js  # Bookmark manager page logic
│   ├── theme.ts             # Theme switching module (Light / Dark / System)
│   ├── i18n/                # Internationalization language packs
│   │   ├── en.ts            # English
│   │   └── zh-CN.ts         # Chinese
│   └── style.css            # Global styles
├── popup.html               # Popup page
├── bookmark-manager.html    # Bookmark manager page
├── manifest.json            # Chrome extension manifest (Manifest V3)
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── zip-dist.js              # Zip packaging script
└── package.json             # Project dependencies
```

## Feature Details

### Popup Panel

Click the extension icon to open. Includes:

- Buttons to open the system bookmark manager or custom bookmark manager
- Gitee cloud sync configuration form (Token, repo, branch, bookmark file selection)
- Four sync action buttons (overwrite save / merge save / overwrite fetch / merge fetch)
- Bookmark file management (create / delete remote bookmark files)
- Keyboard shortcut settings panel
- Password protection settings
- Theme toggle button (Light / Dark / System)
- Help documentation

### Gitee Cloud Sync

| Action | Description |
|--------|-------------|
| Overwrite Save | Overwrite the Gitee remote file with local bookmarks, with option to preserve remote hidden bookmarks |
| Merge Save | Recursively merge local and remote bookmarks, then save with automatic deduplication |
| Overwrite Fetch | Replace all local bookmarks with remote Gitee data |
| Merge Fetch | Recursively merge remote and local bookmarks, then replace local |

Configuration (Token, repo, etc.) is auto-saved to IndexedDB and auto-filled on next open. Supports automatic API Token detection from Gitee pages.

### Global Search

- Press a modifier key repeatedly on any page to open the search box (default: triple Cmd/Ctrl/Alt within 800ms)
- Fuzzy search bookmark titles and URLs
- Type a folder name to browse all bookmarks within that folder
- Results ranked by: last used time > usage count > match score
- Keyboard navigation with arrow keys, Enter to open
- Press Escape to close

### Keyboard Shortcuts

| Shortcut | Function | Customizable |
|----------|----------|:---:|
| Press modifier key repeatedly (default 3 times) | Open global bookmark search | Yes |
| Alt + W | Close current tab | Yes |
| Escape | Close search box | No |

Customizable in the Popup panel under "Shortcut Settings":

- Global search: trigger key (any modifier / Cmd / Ctrl / Alt), press count (2/3/4), time window (500–1500ms), enable/disable toggle
- Close tab: modifier key, letter key, enable/disable toggle

Changes apply immediately to all open tabs without page refresh.

### Password Protection

Add a password lock to the extension popup to prevent unauthorized access to your bookmark data.

**Enable Password Protection:**

1. Ensure Gitee cloud sync is properly configured (Token, repo, branch, bookmark directory)
2. Scroll to the "🔒 Password Settings" section at the bottom of the Popup panel
3. Check "Enable password protection"
4. Enter and confirm your password
5. Click "Save Password Settings"

**How It Works:**

- When enabled, a password lock screen is displayed each time the popup opens — correct password required to unlock
- Password configuration is stored as a `密码.json` file in the bookmark directory of your Gitee repository, automatically synced across devices
- To disable, simply uncheck "Enable password protection" and save

### Theme Switching

Three theme modes to suit different preferences:

| Mode | Description |
|------|-------------|
| 🖥️ System | Automatically follows OS light/dark preference, responds to system changes in real time |
| ☀️ Light | Force light theme |
| 🌙 Dark | Force dark theme |

- Click the theme toggle button in the Popup or Bookmark Manager to cycle through modes
- Theme preference is saved in `chrome.storage.local` and synced across all extension pages

### Bookmark Manager

A dedicated bookmark management page with:

- Split layout: folder tree on the left, bookmark list on the right
- Bookmark search and filtering
- Hide/show bookmarks (hidden state persisted to IndexedDB)
- Drag-and-drop sorting
- Batch operations
- Duplicate bookmark detection
- Broken link detection

### Duplicate Bookmark Detection

Find and clean up duplicate bookmarks with two detection modes:

| Mode | Description |
|------|-------------|
| URL Exact Match | Detect identical URLs (optionally ignore query parameters) |
| Title Fuzzy Match | Detect similar titles using Dice similarity algorithm (threshold ≥ 0.6) |

**How to Use:**

1. Click the "Detect Duplicates" button in the Bookmark Manager
2. Choose a detection mode (for URL mode, optionally check "Ignore query parameters")
3. Review grouped duplicate results — the first item in each group is marked as "keep" by default
4. Select duplicates to remove and click "Delete Selected"

### Broken Link Detection

Automatically verify all bookmark URLs and quickly identify broken links for cleanup.

**Detection Strategy:**

- Uses HEAD requests first (efficient); automatically falls back to GET if the server doesn't support HEAD
- 15-second timeout per link
- Configurable concurrency (default: 8 concurrent checks)

**Status Classification:**

| Status | Description |
|--------|-------------|
| ✅ Available | HTTP 2xx/3xx responses |
| ⚠️ May be Broken | HTTP 429 (rate limited), 5xx server errors, or timeout |
| ❌ Broken | HTTP 404/410 or other 4xx client errors, network unreachable |

**How to Use:**

1. Click the "Broken Link Check" button in the Bookmark Manager
2. Set concurrency level and click "Start"
3. Watch real-time progress bar and results
4. Filter results by status (All / Broken only / Warning only / Available only)
5. Select broken links to remove and click "Delete Selected"

## Permissions

| Permission | Purpose |
|-----------|---------|
| `bookmarks` | Read and manage browser bookmarks |
| `tabs` | Create/close tabs |
| `activeTab` | Get current tab info |
| `storage` | Store shortcut settings and bookmark usage data |

## Development Tips

- Use the latest Chrome browser
- Enable "Developer mode" at `chrome://extensions/` and load the `dist` directory
- Code uses TypeScript strict mode; VSCode recommended
- Recommended: Node 18.x, npm 11.x

## Contributing

PRs and issues are welcome!

- GitHub: [yongtaozheng/bookmarks-manage](https://github.com/yongtaozheng/bookmarks-manage)
- Gitee: [zheng_yongtao/bookmarks-manage](https://gitee.com/zheng_yongtao/bookmarks-manage)

## Community

Join our WeChat group to discuss tips and feature suggestions!

<img src="http://jyeontu.xyz:3003/viewImage/qrcode.png" width="200" alt="WeChat Group" />

[http://jyeontu.xyz:3003/viewImage/qrcode.png](http://jyeontu.xyz:3003/viewImage/qrcode.png)

## License

This project is licensed under the [MIT License](./LICENSE).
