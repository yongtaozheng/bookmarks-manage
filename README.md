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
  <img src="https://img.shields.io/badge/Vue-3.5-brightgreen" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.4-ff69b4" alt="Vite" />
  <img src="https://img.shields.io/badge/Manifest-V3-orange" alt="Chrome Manifest V3" />
</p>

一个基于 Vue 3 + TypeScript + Vite 的现代浏览器书签管理 Chrome 插件（Manifest V3），支持本地书签树管理、Gitee 云同步、全局智能搜索、快捷键自定义、密码保护、主题切换、重复书签检测、失效链接检测等功能。

## 功能特性

- **书签树管理**：可视化管理浏览器书签，支持多级目录展示、批量删除、隐藏/显示书签、拖拽排序。
- **全局搜索**：在任意页面连续按修饰键（默认三次 Cmd/Ctrl/Alt）呼出搜索框，支持模糊匹配书签标题和 URL、输入目录名浏览该目录下所有书签、按使用频率和最近使用时间智能排序。
- **Gitee 云同步**：将本地书签同步到 Gitee 仓库，支持覆盖保存、合并保存、覆盖获取、合并获取四种模式，合并时递归去重。
- **快捷键自定义**：可在 Popup 面板中自定义全局搜索触发键、连按次数、时间窗口，以及关闭标签页的快捷键组合，修改后实时生效。
- **书签隐藏**：支持隐藏指定书签，隐藏状态通过 IndexedDB 持久化保存，云同步时可选择保留隐藏书签。
- **密码保护**：支持为插件弹窗设置密码保护，开启后每次打开弹窗需输入密码解锁，密码配置存储于 Gitee 仓库，多设备自动同步。
- **主题切换**：支持浅色 / 深色 / 跟随系统三种主题模式，一键切换，偏好设置自动保存并在多页面间同步。
- **重复书签检测**：支持按 URL 精确匹配或标题模糊匹配（Dice 相似度算法）检测重复书签，可批量选择并删除重复项。
- **失效链接检测**：自动检测所有书签链接的可用性，支持并发检测、实时进度展示、按状态筛选，可批量删除失效链接。
- **数据安全**：Gitee 配置信息存储于浏览器 IndexedDB，快捷键配置和书签使用数据存储于 chrome.storage.local。

## 用户安装指南

> **普通用户**请查看 👉 [**安装与使用指南**](./docs/installation-guide.md)，无需编程经验，按步骤下载、解压、加载即可使用。

以下内容面向**开发者**。

## 安装与开发

### 克隆项目

```bash
git clone https://github.com/yongtaozheng/bookmarks-manage.git
cd bookmarks-manage
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
- 插件开发调试请使用 Chrome 的"加载已解压的扩展程序"功能，选择 `dist` 目录。

### 构建打包

```bash
npm run build
```

打包后产物在 `dist/` 目录，可直接用于 Chrome 插件加载。

### 打包 zip

```bash
npm run zip
```

将 `dist/` 目录打包为 `dist.zip`，便于分发。

## 目录结构

```
bookmarks-manage/
├── public/                  # 公共资源
│   └── icon.png             # 插件图标
├── src/
│   ├── components/          # Vue 组件
│   │   └── BookmarkTree.vue # 递归书签树组件
│   ├── App.vue              # 新标签页主界面
│   ├── main.ts              # Vue 应用入口
│   ├── popup.ts             # Popup 面板逻辑（Gitee 同步、快捷键设置、密码保护）
│   ├── content-search.ts    # 内容脚本（全局搜索、快捷键监听）
│   ├── background.ts        # Service Worker（消息中继、标签页管理、链接检测）
│   ├── bookmark-manager.js  # 书签管理器页面逻辑
│   ├── theme.ts             # 主题切换模块（浅色/深色/跟随系统）
│   ├── i18n/                # 国际化语言包
│   │   ├── en.ts            # 英文
│   │   └── zh-CN.ts         # 中文
│   └── style.css            # 全局样式
├── popup.html               # Popup 弹窗页面
├── bookmark-manager.html    # 书签管理器页面
├── manifest.json            # Chrome 插件清单（Manifest V3）
├── vite.config.ts           # Vite 构建配置
├── tsconfig.json            # TypeScript 配置
├── zip-dist.js              # 打包脚本
└── package.json             # 项目依赖
```

## 功能说明

### Popup 弹窗面板

点击扩展图标弹出，包含：

- 打开系统书签管理器 / 自定义书签管理器的入口按钮
- Gitee 云同步配置表单（Token、仓库、分支、书签文件选择）
- 四个同步操作按钮（覆盖保存 / 合并保存 / 覆盖获取 / 合并获取）
- 书签文件管理（新增 / 删除远程书签文件）
- 快捷键设置面板
- 密码保护设置
- 主题切换按钮（浅色 / 深色 / 跟随系统）
- 帮助说明

### Gitee 云同步

| 操作 | 说明 |
|------|------|
| 覆盖保存 | 用本地书签覆盖 Gitee 远程文件，可选择保留远程隐藏书签 |
| 合并保存 | 将本地书签与远程书签递归合并后保存，自动去重 |
| 覆盖获取 | 用 Gitee 远程书签完全替换本地书签 |
| 合并获取 | 将远程书签与本地书签递归合并后替换本地书签 |

配置信息（Token、仓库等）输入后自动保存到 IndexedDB，下次打开自动回填。支持从 Gitee 页面自动检测并填入 API Token。

### 全局搜索

- 在任意网页上连续按修饰键即可呼出搜索框（默认连续三次 Cmd/Ctrl/Alt，800ms 时间窗口）
- 输入关键词模糊搜索书签标题和 URL
- 输入目录名可浏览该目录下所有书签
- 搜索结果按最近使用时间、使用次数、匹配度综合排序
- 支持键盘上下箭头导航，回车打开选中书签
- 按 Escape 关闭搜索框

### 快捷键

| 快捷键 | 功能 | 是否可自定义 |
|--------|------|:---:|
| 连续按修饰键（默认 3 次） | 呼出全局书签搜索 | 是 |
| Alt + W | 关闭当前标签页 | 是 |
| Escape | 关闭搜索框 | 否 |

可在 Popup 面板的「快捷键设置」中自定义：

- 全局搜索：触发键（任意修饰键 / Cmd / Ctrl / Alt）、连按次数（2/3/4）、时间窗口（500–1500ms）、启用开关
- 关闭标签页：修饰键、按键字母、启用开关

修改后无需刷新页面，所有已打开的标签页立即生效。

### 密码保护

为插件弹窗增加密码锁，防止他人未经授权查看和操作你的书签数据。

**启用密码保护：**

1. 确保已正确配置 Gitee 云同步（Token、仓库、分支、书签目录）
2. 在 Popup 面板底部找到「🔒 密码设置」区域
3. 勾选「启用密码保护」
4. 输入密码并确认
5. 点击「保存密码设置」

**使用说明：**

- 启用后，每次打开插件弹窗都会显示密码锁定界面，需输入正确密码方可解锁
- 密码配置以 `密码.json` 文件存储在 Gitee 仓库的书签目录中，多设备间自动同步
- 如需关闭密码保护，取消勾选「启用密码保护」并保存即可

### 主题切换

支持三种主题模式，适配不同使用场景：

| 模式 | 说明 |
|------|------|
| 🖥️ 跟随系统 | 自动跟随操作系统的深浅色偏好，系统切换时实时响应 |
| ☀️ 浅色 | 强制使用浅色主题 |
| 🌙 深色 | 强制使用深色主题 |

- 点击 Popup 或书签管理器页面中的主题切换按钮即可循环切换
- 主题偏好保存在 `chrome.storage.local`，在插件各页面间自动同步

### 书签管理器

独立的书签管理页面，提供：

- 左侧目录树 + 右侧书签列表的分栏布局
- 书签搜索与过滤
- 书签隐藏/显示（隐藏状态持久化到 IndexedDB）
- 拖拽排序
- 批量操作
- 重复书签检测
- 失效链接检测

### 重复书签检测

帮助发现和清理重复的书签，支持两种检测模式：

| 模式 | 说明 |
|------|------|
| URL 精确匹配 | 检测完全相同的 URL（可选忽略查询参数） |
| 标题模糊匹配 | 基于 Dice 相似度算法（阈值 ≥ 0.6）检测标题相似的书签 |

**使用方式：**

1. 在书签管理器页面点击「检测重复」按钮
2. 选择检测模式（URL 匹配时可勾选「忽略查询参数」）
3. 查看分组显示的重复结果，每组中第一项默认标记为保留
4. 勾选需要删除的重复书签，点击「删除所选」

### 失效链接检测

自动验证所有书签链接的可用性，快速定位和清理无效书���。

**检测策略：**

- 优先使用 HEAD 请求（高效），服务器不支持时自动降级为 GET 请求
- 单个链接超时时间 15 秒
- 支持自定义并发数（默认 8 个并发）

**状态分类：**

| 状态 | 说明 |
|------|------|
| ✅ 可用 | HTTP 2xx/3xx 响应 |
| ⚠️ 可能失效 | HTTP 429（限流）、5xx 服务端错误或超时 |
| ❌ 失效 | HTTP 404/410 或其他 4xx 客户端错误、网络无法访问 |

**使用方式：**

1. 在书签管理器页面点击「失效链接检测」按钮
2. 设置并发数，点击「开始检测」
3. 实时查看进度条和检测结果
4. 通过状态筛选器过滤结果（全部 / 仅失效 / 仅可能失效 / 仅可用）
5. 勾选需要删除的失效链接，点击「删除所选」

## 权限说明

| 权限 | 用途 |
|------|------|
| `bookmarks` | 读取和管理浏览器书签 |
| `tabs` | 创建/关闭标签页 |
| `activeTab` | 获取当前标签页信息 |
| `storage` | 存储快捷键配置、书签使用数据 |

## 架构简述

```
┌─ Popup (popup.ts) ──────────────────────────────┐
│  Gitee 配置 / 同步操作 / 快捷键设置 / 密码保护    │
└──────────────┬──────────────────────────────────┘
               │ chrome.storage.local (快捷键配置实时同步)
               ▼
┌─ Content Script (content-search.ts) ────────────┐
│  全局搜索 / 快捷键监听 / 注入所有页面             │
└──────────────┬──────────────────────────────────┘
               │ chrome.runtime.sendMessage
               ▼
┌─ Background Service Worker (background.ts) ─────┐
│  消息中继 / Chrome Bookmarks API / 标签页管理     │
│  链接可用性检测（HEAD/GET）                       │
└─────────────────────────────────────────────────┘
```

## 开发建议

- 推荐使用最新版 Chrome 浏览器
- 插件调试请在 `chrome://extensions/` 开启「开发者模式」并加载 `dist` 目录
- 代码基于 TypeScript 严格模式，推荐使用 VSCode
- Node 版本建议 18.x，npm 版本建议 11.x

## 贡献与反馈

欢迎提 Issue、PR 或联系作者改进本项目！

- GitHub：[yongtaozheng/bookmarks-manage](https://github.com/yongtaozheng/bookmarks-manage)
- Gitee：[zheng_yongtao/bookmarks-manage](https://gitee.com/zheng_yongtao/bookmarks-manage)

## 交流群

欢迎加入微信交流群，一起讨论使用技巧和功能建议！

<img src="http://jyeontu.xyz:3003/viewImage/qrcode.png" width="200" alt="微信交流群" />

[http://jyeontu.xyz:3003/viewImage/qrcode.png](http://jyeontu.xyz:3003/viewImage/qrcode.png)

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。
