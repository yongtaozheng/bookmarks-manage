/**
 * 版本更新检查模块
 * - 调用 GitHub / Gitee Release API 获取最新版本号
 * - 与当前扩展版本进行比较
 * - 结果缓存到 chrome.storage.local，每 24 小时检查一次
 * - 支持用户忽略特定版本
 */

declare const chrome: any;

// === 常量 ===
const GITHUB_RELEASE_API = 'https://api.github.com/repos/yongtaozheng/bookmarks-manage/releases/latest';
const GITEE_RELEASE_API = 'https://gitee.com/api/v5/repos/zheng_yongtao/bookmarks-manage/releases/latest';
// Gitee Contents API — 用于获取 dist.zip 的 download_url
const GITEE_DIST_ZIP_API = 'https://gitee.com/api/v5/repos/zheng_yongtao/bookmarks-manage/contents/dist.zip?ref=main';
// Releases 页面 — 查看更新详情
export const GITEE_RELEASES_PAGE = 'https://gitee.com/zheng_yongtao/bookmarks-manage/releases';

const REQUEST_TIMEOUT_MS = 10000; // 10 秒

const STORAGE_KEY_DISMISSED = 'version_check_dismissed';

// === 类型 ===
export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
}

// === 版本比较 ===
/**
 * 比较两个语义化版本号
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// === 获取当前版本 ===
export function getCurrentVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    return chrome.runtime.getManifest().version;
  }
  return '0.0.0';
}

// === 忽略版本管理 ===
export function getDismissedVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY_DISMISSED], (result: any) => {
        resolve(result[STORAGE_KEY_DISMISSED] || null);
      });
    } else {
      resolve(null);
    }
  });
}

export function setDismissedVersion(version: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY_DISMISSED]: version }, () => resolve());
    } else {
      resolve();
    }
  });
}

// === API 请求 ===
async function fetchGitHubRelease(): Promise<{ version: string; downloadUrl: string; notes?: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(GITHUB_RELEASE_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.tag_name) return null;
    return {
      version: data.tag_name.replace(/^v/, ''),
      downloadUrl: GITEE_DIST_ZIP_API,
      notes: data.body || '',
    };
  } catch {
    return null;
  }
}

async function fetchGiteeRelease(): Promise<{ version: string; downloadUrl: string; notes?: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(GITEE_RELEASE_API, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.tag_name) return null;
    return {
      version: data.tag_name.replace(/^v/, ''),
      downloadUrl: GITEE_DIST_ZIP_API,
      notes: data.body || '',
    };
  } catch {
    return null;
  }
}

// === 主检查函数 ===
/**
 * 检查版本更新（每次打开 popup 实时检查）
 */
export async function checkForUpdate(): Promise<VersionCheckResult> {
  const currentVersion = getCurrentVersion();

  // 优先 GitHub，失败后回退 Gitee
  let release = await fetchGitHubRelease();
  if (!release) {
    release = await fetchGiteeRelease();
  }

  if (release && release.version) {
    return {
      hasUpdate: compareVersions(release.version, currentVersion) > 0,
      currentVersion,
      latestVersion: release.version,
      downloadUrl: release.downloadUrl,
      releaseNotes: release.notes,
    };
  }

  // 请求全部失败 — 不提示更新
  return {
    hasUpdate: false,
    currentVersion,
    latestVersion: currentVersion,
    downloadUrl: GITEE_DIST_ZIP_API,
  };
}

// === 直接下载 dist.zip ===
/**
 * 通过 Gitee Contents API 获取 download_url，然后下载文件并触发浏览器保存
 * 整个过程在 popup 内完成，无需打开新标签页
 */
export async function downloadDistZip(): Promise<void> {
  // 1. 调用 Contents API 获取文件信息（含 download_url）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const metaRes = await fetch(GITEE_DIST_ZIP_API, {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!metaRes.ok) {
    throw new Error(`Contents API ${metaRes.status}`);
  }
  const meta = await metaRes.json();

  // 2. 优先用 download_url 下载原始文件；若无则用 base64 content 解码
  let blob: Blob;

  if (meta.download_url) {
    const fileRes = await fetch(meta.download_url);
    if (!fileRes.ok) throw new Error(`Download ${fileRes.status}`);
    blob = await fileRes.blob();
  } else if (meta.content) {
    // base64 → Uint8Array → Blob
    const raw = atob(meta.content);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: 'application/zip' });
  } else {
    throw new Error('No content');
  }

  // 3. 创建临时 <a> 触发浏览器下载
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dist.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
