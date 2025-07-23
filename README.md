# 书签管理器（Chrome 插件）

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

一个基于 Vue 3 + TypeScript + Vite 的现代浏览器书签管理器插件，支持本地书签树管理、Gitee 云同步、智能搜索、批量操作等功能。

## 功能特性

- 📚 **书签树管理**：可视化管理浏览器书签，支持多级目录、批量删除、拖拽排序。
- 🔍 **全局搜索**：支持快捷键（连续三次 Cmd/Win）呼出搜索框，模糊搜索书签和目录，输入目录名可直接浏览该目录下所有书签。
- ☁️ **Gitee 云同步**：支持将本地书签一键同步到 Gitee 仓库，支持覆盖/合并上传与下载。
- 🗂️ **递归合并**：合并时会递归合并所有目录和书签，避免重复。
- 🛡️ **数据安全**：配置信息存储于浏览器 indexDB，安全可靠。
- 🖥️ **美观易用**：现代化 UI，交互友好。

## 安装与开发

### 克隆项目

```bash
git clone https://github.com/yongtaozheng/bookmarks-manage.git
cd bookmarks-plus
```

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

- 访问 `http://localhost:5173` 预览开发页面（仅用于调试 UI）。
- 插件开发建议使用 Chrome 的“加载已解压的扩展程序”功能，选择 `dist` 目录。

### 构建打包

```bash
npm run build
```

- 打包后产物在 `dist/` 目录，可直接用于 Chrome 插件加载。

## 目录结构

```
bookmarks-plus/
├── public/           # 公共资源
│   └── icon.jpg      # 插件图标
├── src/
│   ├── assets/       # 静态资源
│   ├── components/   # Vue 组件（如 BookmarkTree）
│   ├── App.vue       # 主界面
│   ├── popup.ts      # 弹窗主逻辑，Gitee 同步
│   ├── content-search.ts # 内容脚本，支持全局搜索
│   ├── background.ts # 后台脚本，处理书签数据通信
│   └── style.css     # 全局样式
├── popup.html        # 插件弹窗页面
├── manifest.json     # Chrome 插件清单
├── vite.config.ts    # Vite 配置
└── ...               # 其他配置文件
```

## 主要功能说明

- **弹窗面板**：点击扩展图标弹出，支持一键打开书签管理器、Gitee 配置、同步按钮、帮助说明。
- **Gitee 同步**：
  - 覆盖保存：将本地书签覆盖保存到 Gitee。
  - 合并保存：将本地书签与 Gitee 上的书签递归合并后保存。
  - 覆盖获取：用 Gitee 上的书签数据替换本地书签。
  - 合并获取：将 Gitee 上的书签与本地递归合并后替换本地书签。
- **全局搜索**：任意页面连续三次 Cmd/Win 呼出搜索，支持模糊匹配、目录内书签浏览、回车/点击跳转。

## 权限说明

- `bookmarks`：访问和管理浏览器书签
- `tabs`、`activeTab`：用于打开新标签页
- `storage`（通过 indexDB 实现）：本地存储配置信息

## Gitee 配置

在弹窗面板填写 Gitee Token、仓库信息、分支、文件路径等，支持自动保存和自动填充。

## 开发建议

- 推荐使用最新版 Chrome 浏览器。
- 插件开发调试建议使用“开发者模式”加载 `dist` 目录。
- 代码基于 TypeScript 严格模式，建议使用 VSCode 编辑器。

## 贡献与反馈

欢迎提 Issue、PR 或联系作者改进本项目！
