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
  <img src="https://img.shields.io/badge/Vue-3.x-brightgreen" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-4.x-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-4.x-ff69b4" alt="Vite" />
</p>

A modern Chrome bookmarks manager extension built with Vue 3, TypeScript, and Vite. Features local bookmark tree management, Gitee cloud sync, smart search, batch operations, and more.

## Features

- 📚 **Bookmark Tree Management**: Visualize and manage bookmarks with multi-level folders, batch delete, and drag-and-drop sorting.
- 🔍 **Global Search**: Trigger search box with triple Cmd/Win, fuzzy search bookmarks/folders, type folder name to browse all bookmarks inside.
- ☁️ **Gitee Cloud Sync**: One-click sync to Gitee repo, supports overwrite/merge upload and download.
- 🗂️ **Recursive Merge**: Merges all folders and bookmarks recursively, avoiding duplicates.
- 🛡️ **Data Security**: Config stored in browser indexDB.
- 🖥️ **Modern UI**: Beautiful, user-friendly, dark mode supported.

## Getting Started

```bash
git clone https://github.com/yongtaozheng/bookmarks-manage.git
cd bookmarks-plus
npm install
npm run dev
```

- Visit `http://localhost:5173` for UI preview.
- For extension development, use Chrome's "Load unpacked" and select the `dist` folder.

## Build

```bash
npm run build
```

- The build output is in the `dist/` directory, ready for Chrome extension loading.

## Directory Structure

```
bookmarks-plus/
├── public/           # Public assets
│   └── icon.jpg      # Extension icon
├── src/
│   ├── assets/       # Static assets
│   ├── components/   # Vue components (e.g. BookmarkTree)
│   ├── App.vue       # Main UI
│   ├── popup.ts      # Popup logic, Gitee sync
│   ├── content-search.ts # Content script, global search
│   ├── background.ts # Background script, bookmark data communication
│   └── style.css     # Global styles
├── popup.html        # Extension popup page
├── manifest.json     # Chrome extension manifest
├── vite.config.ts    # Vite config
└── ...               # Other config files
```

## Main Features

- **Popup Panel**: Click the extension icon to open, supports one-click open bookmarks manager, Gitee config, sync buttons, help.
- **Gitee Sync**:
  - Overwrite Save: Overwrite Gitee with local bookmarks.
  - Merge Save: Recursively merge local and Gitee bookmarks, then save.
  - Overwrite Fetch: Replace local bookmarks with Gitee data.
  - Merge Fetch: Recursively merge Gitee and local bookmarks, then replace local.
- **Global Search**: Triple Cmd/Win to open search, supports fuzzy match, folder search, enter/click to jump.

## Permissions

- `bookmarks`: Access and manage browser bookmarks
- `tabs`, `activeTab`: Open new tabs
- `storage` (via indexDB): Store config locally

## Gitee Config

Fill in your Gitee Token, repo, branch, and file path in the popup panel. Supports auto-save and auto-fill.

## Development Tips

- Use the latest Chrome browser.
- For extension debugging, use "Developer mode" and load the `dist` directory.
- Code is TypeScript strict-mode, VSCode recommended.

## Contribution

PRs and issues are welcome!

---

> **Tip:** Replace badge URLs and screenshot paths with your own resources as needed.
