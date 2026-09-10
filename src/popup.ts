import { initLocale, t, setLocale, getLocale, translateDOM } from './i18n/index';
import type { Locale } from './i18n/index';
import { initTheme, setupThemeToggle } from './theme';
import { decrypt, setMasterPassphrase, clearMasterPassphrase, hasMasterPassphrase } from './crypto';
import { checkForUpdate, getCurrentVersion, getDismissedVersion, setDismissedVersion, downloadDistZip, GITEE_RELEASES_PAGE } from './version-check';
import { getConfig as getConfigFromDB, getRawConfig as getRawConfigFromDB, setConfig as setConfigToDB } from './config-repository';
import { assertResponseOk, fetchJson, fetchWithTimeout, getErrorMessage } from './http';
import { getChromeBookmarksTree as getLocalBookmarks, replaceBookmarkBarSafely } from './bookmark-service';
import { showToast } from './toast';
import {
  PASSWORD_FILE_NAME,
  createPasswordPolicy,
  getLocalPasswordPolicy,
  resolvePasswordPolicy,
  saveRemotePasswordPolicy,
  verifyPassword,
} from './password-service';
import type { PasswordPolicy } from './password-service';

declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' &&
         chrome.runtime &&
         chrome.runtime.sendMessage &&
         chrome.bookmarks;
}

function isLikelyEncryptedValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
  try {
    const decoded = atob(value);
    return decoded.length > 12; // AES-GCM: 12 字节 IV + 密文
  } catch {
    return false;
  }
}

async function normalizeImportedGiteeConfig(
  config: Record<string, string>,
  encrypted: boolean
): Promise<Record<string, string>> {
  if (!encrypted) return config;

  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (!v) {
      normalized[k] = v;
      continue;
    }
    try {
      normalized[k] = await decrypt(v);
    } catch {
      // encrypted 标记为 true 且值看起来像密文，但解密失败
      // 说明导入文件密钥不匹配，继续导入会导致配置不可用
      if (isLikelyEncryptedValue(v)) {
        throw new Error('ENCRYPTED_CONFIG_DECRYPT_FAILED');
      }
      // 兼容历史异常数据（标记为加密但实际是明文）
      normalized[k] = v;
    }
  }
  return normalized;
}
// == 快捷键配置工具 ==
const DEFAULT_SHORTCUT_CONFIG = {
  search: {
    triggerKey: 'any_modifier',
    pressCount: 3,
    timeWindow: 800,
    enabled: true,
  },
  closeTab: {
    enabled: true,
    modifier: 'Alt',
    key: 'w',
  },
};

function getShortcutConfig(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['shortcut_config'], (result: any) => {
        if (result.shortcut_config) {
          try {
            const saved = JSON.parse(result.shortcut_config);
            resolve({
              search: { ...DEFAULT_SHORTCUT_CONFIG.search, ...(saved.search || {}) },
              closeTab: { ...DEFAULT_SHORTCUT_CONFIG.closeTab, ...(saved.closeTab || {}) },
            });
          } catch {
            resolve(JSON.parse(JSON.stringify(DEFAULT_SHORTCUT_CONFIG)));
          }
        } else {
          resolve(JSON.parse(JSON.stringify(DEFAULT_SHORTCUT_CONFIG)));
        }
      });
    } else {
      resolve(JSON.parse(JSON.stringify(DEFAULT_SHORTCUT_CONFIG)));
    }
  });
}

function saveShortcutConfig(config: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ shortcut_config: JSON.stringify(config) }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

// == Gitee 配置获取 ==
function getGiteeConfig(): Promise<any> {
  const fields = ['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath'];
  return getConfigFromDB(fields);
}

// == Gitee API 新实现 ==
async function getDecodedContent(content: string) {
  const decodedContent = atob(content); // 解码Base64编码的文件内容
  const decoder = new TextDecoder();
  const decodedData = decoder.decode(
    new Uint8Array([...decodedContent].map((char) => char.charCodeAt(0)))
  );
  return JSON.parse(decodedData);
}
async function fetchFileContent(apiUrl: string, accessToken: string) {
  return fetchJson<any>(apiUrl, {
    headers: {
      Authorization: "token " + accessToken,
    },
  }, { fallbackMessage: t('msg.fileInfoFailed') });
}
async function putFileContent(apiUrl: string, accessToken: string, encodedContent: string, sha: string) {
  const commitData = {
    access_token: accessToken,
    content: encodedContent,
    message: "书签更新",
    sha: sha,
  };
  const putResponse = await fetchWithTimeout(apiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "token " + accessToken,
    },
    body: JSON.stringify(commitData),
  });
  await assertResponseOk(putResponse, t('msg.uploadFailed'));
}
function safeBtoa(data: Uint8Array) {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
function getGiteeFileApiUrl(gitInfo: any): string {
  const encodedPath = String(gitInfo.giteeFilePath || '').split('/').map(encodeURIComponent).join('/');
  return `https://gitee.com/api/v5/repos/${encodeURIComponent(gitInfo.giteeOwner)}/${encodeURIComponent(gitInfo.giteeRepo)}/contents/${encodedPath}?ref=${encodeURIComponent(gitInfo.giteeBranch)}`;
}
async function modifyFile(gitInfo: any, modifiedContent: any, isCover: boolean) {
  const accessToken = gitInfo.giteeToken;
  const apiUrl = getGiteeFileApiUrl(gitInfo);
  const file = await fetchFileContent(apiUrl, accessToken);
  const fileContent = file.content || "";
  if (!isCover) {
    const content = await getDecodedContent(fileContent);
    modifiedContent = mergeBookmarks(content, modifiedContent);
  }
  modifiedContent = JSON.stringify(modifiedContent);
  const encoder = new TextEncoder();
  const data = encoder.encode(modifiedContent);
  const encodedContent = safeBtoa(data);
  await putFileContent(apiUrl, accessToken, encodedContent, file.sha);
}
async function getFile(gitInfo: any) {
  const accessToken = gitInfo.giteeToken;
  const apiUrl = getGiteeFileApiUrl(gitInfo);
  const file = await fetchFileContent(apiUrl, accessToken);
  const fileContent = file.content || "";
  const decodedContent = atob(fileContent); // 解码Base64编码的文件内容
  const decoder = new TextDecoder();
  const decodedData = decoder.decode(
    new Uint8Array([...decodedContent].map((char) => char.charCodeAt(0)))
  );
  return JSON.parse(decodedData);
}


// 获取书签管理器的完整数据（包含隐藏属性）
function getBookmarkManagerData(): Promise<any[]> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'getBookmarkManagerData' }, (response: any) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(response?.bookmarks || []);
    });
  });
}

// == 筛选隐藏书签 ==
function filterHiddenBookmarks(bookmarks: any[]): any[] {
  const filterBookmarks = (items: any[]): any[] => {
    const result: any[] = [];

    items.forEach(item => {
      if (item.hidden) {
        // 保留隐藏的书签
        result.push(item);
      } else if (item.children && item.children.length > 0) {
        // 递归筛选子项
        const filteredChildren = filterBookmarks(item.children);

        // 如果目录包含隐藏的子项，则保留整个目录
        if (filteredChildren.length > 0) {
          result.push({
            ...item,
            children: filteredChildren
          });
        }
      }
    });

    return result;
  };

  return filterBookmarks(bookmarks);
}

// == 过滤可见书签（移除隐藏书签）==
function filterVisibleBookmarks(bookmarks: any[]): any[] {
  if (!Array.isArray(bookmarks)) {
    return [];
  }

  return bookmarks.filter(bookmark => {
    if (!bookmark) {
      return false;
    }

    // 如果书签被隐藏，则过滤掉
    if (bookmark.hidden === true) {
      return false;
    }

    // 如果有子项，递归过滤
    if (bookmark.children && Array.isArray(bookmark.children)) {
      const filteredChildren = filterVisibleBookmarks(bookmark.children);
      if (filteredChildren.length > 0) {
        bookmark.children = filteredChildren;
      } else {
        // 如果所有子项都被隐藏，则隐藏整个文件夹
        return false;
      }
    }

    return true;
  });
}

// == 合并去重 ==
function mergeBookmarks(arr1: any[], arr2: any[]): any[] {
  // 递归合并两个书签树数组
  const map = new Map<string, any>();
  function getKey(node: any) {
    return node.url ? `bookmark:${node.title}|${node.url}` : `folder:${node.title}`;
  }
  // 先放 arr1
  arr1.forEach(n1 => {
    const key = getKey(n1);
    map.set(key, { ...n1, children: n1.children ? mergeBookmarks(n1.children, []) : undefined });
  });
  // 合并 arr2
  arr2.forEach(n2 => {
    const key = getKey(n2);
    if (map.has(key)) {
      // 文件夹递归合并
      if (!n2.url) {
        map.set(key, {
          ...n2,
          children: mergeBookmarks(map.get(key).children || [], n2.children || [])
        });
      }
      // 书签已存在则跳过
    } else {
      map.set(key, { ...n2, children: n2.children ? mergeBookmarks([], n2.children) : undefined });
    }
  });
  return Array.from(map.values());
}

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化主题（CSS变量，锁定界面也需要）
  await initTheme();

  // 初始化语言（锁定遮罩也需要翻译）
  await initLocale();
  translateDOM();

  // ====== 版本更新检查 UI ======
  async function initVersionCheck() {
    const versionBar = document.getElementById('versionBar');
    const updateBanner = document.getElementById('updateBanner');
    const updateBannerText = document.getElementById('updateBannerText');
    const updateBannerDownload = document.getElementById('updateBannerDownload') as HTMLButtonElement;
    const updateBannerDetail = document.getElementById('updateBannerDetail') as HTMLButtonElement;
    const updateBannerDismiss = document.getElementById('updateBannerDismiss');

    if (!versionBar) return;

    // 显示当前版本
    const currentVersion = getCurrentVersion();
    versionBar.textContent = t('version.current', currentVersion);

    try {
      const result = await checkForUpdate();

      if (result.hasUpdate && updateBanner && updateBannerText && updateBannerDownload && updateBannerDismiss) {
        // 检查是否已忽略此版本
        const dismissedVersion = await getDismissedVersion();
        if (dismissedVersion === result.latestVersion) {
          return; // 用户已忽略此版本
        }

        // 显示更新横幅
        updateBannerText.textContent = t('version.newAvailable', result.latestVersion);
        updateBannerDownload.textContent = t('version.download');
        updateBanner.classList.add('visible');

        // 点击下载：调用 Gitee Contents API 直接下载文件
        updateBannerDownload.addEventListener('click', async (e) => {
          e.preventDefault();
          const originalText = updateBannerDownload.textContent;
          updateBannerDownload.textContent = t('version.downloading');
          updateBannerDownload.style.pointerEvents = 'none';
          updateBannerDownload.style.opacity = '0.6';
          try {
            await downloadDistZip();
            updateBannerDownload.textContent = t('version.downloadSuccess');
          } catch {
            updateBannerDownload.textContent = t('version.downloadFailed');
          } finally {
            updateBannerDownload.style.pointerEvents = '';
            updateBannerDownload.style.opacity = '';
            setTimeout(() => {
              updateBannerDownload.textContent = originalText;
            }, 2000);
          }
        });

        // 查看更新内容：跳转到 Gitee Releases 页面
        if (updateBannerDetail) {
          updateBannerDetail.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: GITEE_RELEASES_PAGE });
            } else {
              window.open(GITEE_RELEASES_PAGE, '_blank');
            }
          });
        }

        // 忽略按钮
        updateBannerDismiss.addEventListener('click', async () => {
          await setDismissedVersion(result.latestVersion);
          updateBanner.classList.remove('visible');
        });
      }
    } catch {
      // 版本检查失败，静默忽略
    }
  }

  // ====== 初始化所有 popup UI（密码验证通过后调用）======
  function initPopupUI() {
    // 主题切换按钮（在 popupContent 内部）
    setupThemeToggle();

    // == 版本更新检查 ==
    initVersionCheck();

    // 语言选择器
    const langSelect = document.getElementById('langSelect') as HTMLSelectElement;
    if (langSelect) {
      langSelect.value = getLocale();
      langSelect.addEventListener('change', async () => {
        await setLocale(langSelect.value as Locale);
        translateDOM();
      });
    }

    // == Tab 切换逻辑 ==
    const tabBtns = document.querySelectorAll('.popup-tab-btn') as NodeListOf<HTMLButtonElement>;
    const tabPanels = document.querySelectorAll('.popup-tab-panel') as NodeListOf<HTMLDivElement>;

    // 从 storage 恢复上次的 tab
    const savedTab = localStorage.getItem('popup_active_tab') || 'config';
    function switchTab(tabName: string) {
      tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
      });
      tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.getAttribute('data-tab-panel') === tabName);
      });
      localStorage.setItem('popup_active_tab', tabName);
    }

    // 初始化选中 tab
    switchTab(savedTab);

    // 绑定点击事件
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (tabName) switchTab(tabName);
      });
    });

    // Gitee 配置表单逻辑
    const tokenEl = document.getElementById('giteeToken') as HTMLInputElement;
    const ownerEl = document.getElementById('giteeOwner') as HTMLInputElement;
    const repoEl = document.getElementById('giteeRepo') as HTMLInputElement;
    const branchSel = document.getElementById('giteeBranch') as HTMLSelectElement;
    const filePathSelect = document.getElementById('giteeFilePath') as HTMLSelectElement;
    const bookmarkDirInput = document.getElementById('bookmarkDir') as HTMLInputElement;
    const fields = ['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath'];
    const CONFIG_SAVE_DEBOUNCE_MS = 400;
    let configSaveTimer: number | undefined;
    let configSaveQueue: Promise<void> = Promise.resolve();
    let lastSavedConfigSnapshot = '';
    let lastNotifiedConfigSnapshot = '';
    let pendingSavedFile = '';

    function serializeConfig(config: Record<string, string>) {
      return JSON.stringify(fields.map(field => config[field] || ''));
    }

    function collectConfig(): Record<string, string> {
      const config: Record<string, string> = {};
      fields.forEach(field => {
        const value = (document.getElementById(field) as HTMLInputElement).value;
        config[field] = field === 'giteeFilePath' && !value && pendingSavedFile ? pendingSavedFile : value;
      });
      return config;
    }

    function cancelScheduledConfigSave() {
      if (configSaveTimer !== undefined) {
        window.clearTimeout(configSaveTimer);
        configSaveTimer = undefined;
      }
    }

    async function saveConfigNow(shouldNotify = false): Promise<boolean> {
      cancelScheduledConfigSave();
      const config = collectConfig();
      const snapshot = serializeConfig(config);
      const operation = configSaveQueue.then(async () => {
        if (snapshot === lastSavedConfigSnapshot) return;
        await setConfigToDB(config);
        lastSavedConfigSnapshot = snapshot;
      });
      configSaveQueue = operation.catch(() => undefined);

      try {
        await operation;
        if (shouldNotify && snapshot !== lastNotifiedConfigSnapshot && snapshot === lastSavedConfigSnapshot) {
          lastNotifiedConfigSnapshot = snapshot;
          showToast(t('msg.configSaved'));
        }
        return true;
      } catch (error) {
        showToast(t('msg.configSaveFailed', getErrorMessage(error)), 'error');
        return false;
      }
    }

    function scheduleConfigSave() {
      cancelScheduledConfigSave();
      configSaveTimer = window.setTimeout(() => {
        configSaveTimer = undefined;
        void saveConfigNow(false);
      }, CONFIG_SAVE_DEBOUNCE_MS);
    }

    // 自动填充，并记录已保存快照，避免初始化或未修改失焦时误报“保存成功”。
    getConfigFromDB(fields).then((data) => {
      fields.forEach(f => {
        const el = document.getElementById(f) as HTMLInputElement;
        if (el && data[f]) el.value = data[f];
      });
      const normalizedConfig = Object.fromEntries(fields.map(field => [field, data[field] || '']));
      lastSavedConfigSnapshot = serializeConfig(normalizedConfig);
      lastNotifiedConfigSnapshot = lastSavedConfigSnapshot;

      // 自动回填保存的 filePath 配置
      const savedFile = data.giteeFilePath || '';
      pendingSavedFile = savedFile;
      if (savedFile) {
        // 等待文件列表加载后再选中
        const trySelect = () => {
          const opt = Array.from(filePathSelect.options).find(o => o.value === savedFile);
          if (opt) {
            filePathSelect.value = savedFile;
            pendingSavedFile = '';
          } else {
            setTimeout(trySelect, 100);
          }
        };
        trySelect();
      }
    });

    // 输入时防抖保存，失焦时立即落库并按实际变更提示一次。
    fields.forEach(f => {
      const el = document.getElementById(f) as HTMLInputElement;
      el.addEventListener('blur', () => { void saveConfigNow(true); });
      el.addEventListener('input', scheduleConfigSave);
    });

    // 监听来自content script的消息（在DOM加载完成后设置）
    chrome.runtime.onMessage.addListener((message: any) => {
      if (message.type === 'updateToken' && message.token) {
        // 更新token输入框
        const tokenEl = document.getElementById('giteeToken') as HTMLInputElement;
        if (tokenEl) {
          tokenEl.value = message.token;
          void saveConfigNow(false).then(saved => {
            if (saved) showToast(t('msg.tokenUpdated'), 'info');
          });
        }
      }
      // 返回响应表示消息已处理
      return true;
    });

    // 检查是否有待处理的token更新消息
    setTimeout(() => {
      // 从storage中读取最新的token
      chrome.storage.local.get(['latestToken'], (result: any) => {
        if (result.latestToken) {
          const tokenEl = document.getElementById('giteeToken') as HTMLInputElement;
          if (tokenEl) {
            tokenEl.value = result.latestToken;
            void saveConfigNow(false).then(saved => {
              if (saved) {
                showToast(t('msg.tokenUpdated'), 'info');
                // 保存成功后再清除，失败时保留以便下次重试。
                chrome.storage.local.remove(['latestToken']);
              }
            });
          }
        }
      });
    }, 100);

    function fillSelectOptions(select: HTMLSelectElement, options: string[], placeholder = t('select.placeholder')) {
      select.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      select.appendChild(opt);
      options.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v.split('/').pop() || v;
        select.appendChild(o);
      });
    }
    async function fetchGiteeFiles(token: string, owner: string, repo: string, branch: string, dir: string): Promise<string[]> {
      // dir 为空时获取根目录，否则获取指定目录下文件
      let url = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
      if (dir) url += `/${dir.split('/').map(encodeURIComponent).join('/')}`;
      url += `?ref=${encodeURIComponent(branch)}`;
      const data = await fetchJson<any[]>(url, {
        headers: { Authorization: `token ${token}` },
      }, { fallbackMessage: t('select.getFileFailed') });
      return Array.isArray(data) ? data.filter((f: any) => f.type === 'file').map((f: any) => f.path) : [];
    }
    async function fetchGiteeBranches(token: string, owner: string, repo: string): Promise<string[]> {
      const url = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`;
      const data = await fetchJson<any[]>(url, {
        headers: { Authorization: `token ${token}` },
      }, { fallbackMessage: t('select.getBranchFailed') });
      return data.map((b: any) => b.name);
    }
    async function updateFilePathOptions() {
      const token = tokenEl.value.trim();
      const owner = ownerEl.value.trim();
      const repo = repoEl.value.trim();
      const branch = branchSel.value;
      const dir = bookmarkDirInput.value.trim();
      if (!token || !owner || !repo || !branch || !dir) return;
      fillSelectOptions(filePathSelect, [], t('select.loading'));
      try {
        const files = await fetchGiteeFiles(token, owner, repo, branch, dir);
        // 过滤掉 .keep 文件和密码文件
        const filtered = files.filter((f: string) => !f.endsWith('.keep') && !f.endsWith(PASSWORD_FILE_NAME));
        fillSelectOptions(filePathSelect, filtered, t('select.selectFile'));
      } catch (e) {
        fillSelectOptions(filePathSelect, [], t('select.getFileFailed'));
      }
    }
    async function updateBranches() {
      const token = tokenEl.value.trim();
      const owner = ownerEl.value.trim();
      const repo = repoEl.value.trim();
      if (!token || !owner || !repo) return;
      if (token === lastToken && owner === lastOwner && repo === lastRepo) return;
      lastToken = token; lastOwner = owner; lastRepo = repo;
      fillSelectOptions(branchSel, [], t('select.loading'));
      try {
        const branches = await fetchGiteeBranches(token, owner, repo);
        fillSelectOptions(branchSel, branches, t('select.selectBranch'));
        // 默认选中 master 分支
        if (branches.includes('master')) {
          branchSel.value = 'master';
        } else if (branches.length > 0) {
          branchSel.value = branches[0];
        }
        // 触发文件列表刷新
        updateFilePathOptions();
      } catch (e) {
        fillSelectOptions(branchSel, [], t('select.getBranchFailed'));
        fillSelectOptions(filePathSelect, [], t('select.selectBranch'));
      }
      fillSelectOptions(filePathSelect, [], t('select.selectBranch'));
    }
    // 记录上次的值
    let lastToken = '', lastOwner = '', lastRepo = '', lastBookmarkDir = '';
    function hasConfigChanged() {
      return tokenEl.value.trim() !== lastToken ||
        ownerEl.value.trim() !== lastOwner ||
        repoEl.value.trim() !== lastRepo ||
        bookmarkDirInput.value.trim() !== lastBookmarkDir;
    }
    function updateLastConfig() {
      lastToken = tokenEl.value.trim();
      lastOwner = ownerEl.value.trim();
      lastRepo = repoEl.value.trim();
      lastBookmarkDir = bookmarkDirInput.value.trim();
    }
    // 失焦时仅在数据变化时才更新
    tokenEl.addEventListener('blur', () => {
      if (hasConfigChanged()) {
        updateBranches();
        updateLastConfig();
      }
    });
    ownerEl.addEventListener('blur', () => {
      if (hasConfigChanged()) {
        updateBranches();
        updateLastConfig();
      }
    });
    repoEl.addEventListener('blur', () => {
      if (hasConfigChanged()) {
        updateBranches();
        updateLastConfig();
      }
    });
    bookmarkDirInput.addEventListener('blur', () => {
      if (hasConfigChanged()) {
        updateFilePathOptions();
        updateLastConfig();
      }
    });
    // 默认加载一次
    setTimeout(() => {
      updateFilePathOptions();
    }, 300);

    const btnSaveOverwrite = document.getElementById('btnSaveOverwrite') as HTMLButtonElement;
    const btnSaveMerge = document.getElementById('btnSaveMerge') as HTMLButtonElement;
    const btnGetOverwrite = document.getElementById('btnGetOverwrite') as HTMLButtonElement;
    const btnGetMerge = document.getElementById('btnGetMerge') as HTMLButtonElement;
    const syncActionButtons = [btnSaveOverwrite, btnSaveMerge, btnGetOverwrite, btnGetMerge];

    async function runSyncAction(button: HTMLButtonElement, busyText: string, action: () => Promise<void>) {
      if (button.disabled) return;
      const originalText = button.textContent || '';
      syncActionButtons.forEach(item => { item.disabled = true; });
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.textContent = busyText;
      try {
        await action();
      } finally {
        syncActionButtons.forEach(item => { item.disabled = false; });
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
        const labelKey = button.dataset.i18n;
        button.textContent = labelKey ? t(labelKey) : originalText;
      }
    }

    btnSaveOverwrite.onclick = async function() {
      if (!confirm(t('confirm.overwriteSave'))) {
        return;
      }

      // 询问是否保留隐藏书签
      const keepHidden = confirm(t('confirm.keepHidden'));

      await runSyncAction(btnSaveOverwrite, t('sync.saving'), async () => {
        try {
          const config = await getGiteeConfig();
          const tree = await getLocalBookmarks();
          let content = tree[0]?.children || [];
          let hiddenBookmarksKept = false;
          let hiddenBookmarksWarning = false;

          if (keepHidden) {
            // 需要保留隐藏书签，从书签管理器中获取包含隐藏属性的书签。
            try {
              const bookmarkManagerData = await getBookmarkManagerData();
              if (bookmarkManagerData && bookmarkManagerData.length > 0) {
                const hiddenBookmarks = filterHiddenBookmarks(bookmarkManagerData);
                content = mergeBookmarks(content, hiddenBookmarks);
                hiddenBookmarksKept = true;
              } else {
                hiddenBookmarksWarning = true;
              }
            } catch (error) {
              hiddenBookmarksWarning = true;
              console.warn('Failed to preserve hidden bookmarks:', error);
            }
          }

          await modifyFile(config, content, true);
          if (hiddenBookmarksWarning) {
            showToast(t('msg.overwriteSaveCompletedWithWarning'), 'warning');
          } else if (hiddenBookmarksKept) {
            showToast(t('msg.overwriteSaveSuccessWithHidden'));
          } else {
            showToast(t('msg.overwriteSaveSuccess'));
          }
        } catch (error) {
          showToast(t('msg.overwriteSaveFailed', getErrorMessage(error)), 'error');
        }
      });
    };

    btnSaveMerge.onclick = async function() {
      if (!confirm(t('confirm.mergeSave'))) {
        return;
      }
      await runSyncAction(btnSaveMerge, t('sync.saving'), async () => {
        try {
          const config = await getGiteeConfig();
          const tree = await getLocalBookmarks();
          const content = tree[0]?.children || [];
          await modifyFile(config, content, false);
          showToast(t('msg.mergeSaveSuccess'));
        } catch (error) {
          showToast(t('msg.mergeSaveFailed', getErrorMessage(error)), 'error');
        }
      });
    };

    btnGetOverwrite.onclick = async function() {
      if (!confirm(t('confirm.overwriteGet'))) {
        return;
      }
      await runSyncAction(btnGetOverwrite, t('sync.getting'), async () => {
        try {
          const config = await getGiteeConfig();
          const data = await getFile(config);

          // 检查数据结构
          let bookmarksToCreate;
          if (Array.isArray(data)) {
            // 如果是数组，取第一个元素的children
            bookmarksToCreate = data[0]?.children || [];
          } else if (data.children) {
            // 如果是对象且有children属性
            bookmarksToCreate = data.children;
          } else {
            throw new Error(t('msg.remoteDataFormatError'));
          }

          // 过滤掉隐藏的书签，不在系统书签栏显示
          const visibleBookmarks = filterVisibleBookmarks(bookmarksToCreate);

          await replaceBookmarkBarSafely(visibleBookmarks);
          showToast(t('msg.overwriteGetSuccess'));
        } catch (error) {
          showToast(t('msg.overwriteGetFailed', getErrorMessage(error)), 'error');
        }
      });
    };

    btnGetMerge.onclick = async function() {
      if (!confirm(t('confirm.mergeGet'))) {
        return;
      }
      await runSyncAction(btnGetMerge, t('sync.getting'), async () => {
        try {
          const config = await getGiteeConfig();
          const data = await getFile(config);

          const tree = await getLocalBookmarks();
          const local = tree[0]?.children || [];

          // 检查数据结构并获取远程书签
          let remoteBookmarks;
          if (Array.isArray(data)) {
            remoteBookmarks = data[0]?.children || [];
          } else if (data.children) {
            remoteBookmarks = data.children;
          } else {
            throw new Error(t('msg.remoteDataFormatError'));
          }

          // 获取书签栏的书签进行合并
          const localBookmarks = local.find((item: any) => item.title === '书签栏' || item.title === 'Bookmarks bar');
          const localBookmarksChildren = localBookmarks?.children || [];
          const merged = mergeBookmarks(localBookmarksChildren, remoteBookmarks);

          // 过滤掉隐藏的书签，不在系统书签栏显示
          const visibleMerged = filterVisibleBookmarks(merged);

          await replaceBookmarkBarSafely(visibleMerged);
          showToast(t('msg.mergeGetSuccess'));
        } catch (error) {
          showToast(t('msg.mergeGetFailed', getErrorMessage(error)), 'error');
        }
      });
    };

    // 新增书签文件
    document.getElementById('addBookmarkFile')!.onclick = async function() {
      const fileName = prompt(t('prompt.newFileName'));
      if (!fileName) return;

      // 如果文件名没有后缀，自动补全为.json
      const finalFileName = fileName.includes('.') ? fileName : `${fileName}.json`;

      const token = tokenEl.value.trim();
      const owner = ownerEl.value.trim();
      const repo = repoEl.value.trim();
      const branch = branchSel.value;
      const dir = bookmarkDirInput.value.trim();

      if (!token || !owner || !repo || !branch || !dir) {
        showToast(t('msg.fillConfigFirst'), 'warning');
        return;
      }

      try {
        const filePath = dir ? `${dir}/${finalFileName}` : finalFileName;
        const content = JSON.stringify([], null, 2); // 空的书签数组
        const encodedContent = btoa(unescape(encodeURIComponent(content)));

        const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
        const url = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `token ${token}`
          },
          body: JSON.stringify({
            access_token: token,
            content: encodedContent,
            message: `新增书签文件：${finalFileName}`,
            branch: branch
          })
        });

        await assertResponseOk(response, t('msg.addFileFailed'));
        showToast(t('msg.addFileSuccess', finalFileName));
        updateFilePathOptions(); // 刷新文件列表
      } catch (e: any) {
        showToast(t('msg.addFileFailedDetail', getErrorMessage(e)), 'error');
      }
    };

    // 删除书签文件
    document.getElementById('deleteBookmarkFile')!.onclick = async function() {
      const selectedFile = filePathSelect.value;
      if (!selectedFile) {
        showToast(t('msg.selectFileFirst'), 'warning');
        return;
      }

      if (!confirm(t('confirm.deleteFile', selectedFile.split('/').pop() || ''))) {
        return;
      }

      const token = tokenEl.value.trim();
      const owner = ownerEl.value.trim();
      const repo = repoEl.value.trim();
      const branch = branchSel.value;

      if (!token || !owner || !repo || !branch) {
        showToast(t('msg.fillConfigFirst'), 'warning');
        return;
      }

      try {
        // 先获取文件信息（需要 sha）
        const encodedPath = selectedFile.split('/').map(encodeURIComponent).join('/');
        const baseUrl = `https://gitee.com/api/v5/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
        const getUrl = `${baseUrl}?ref=${encodeURIComponent(branch)}`;
        const getResponse = await fetchWithTimeout(getUrl, {
          headers: { 'Authorization': `token ${token}` }
        });
        await assertResponseOk(getResponse, t('msg.fileInfoFailed'));
        const fileInfo = await getResponse.json();

        // 删除文件
        const deleteResponse = await fetchWithTimeout(baseUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `token ${token}`
          },
          body: JSON.stringify({
            access_token: token,
            message: `删除书签文件：${selectedFile.split('/').pop()}`,
            sha: fileInfo.sha,
            branch: branch
          })
        });

        await assertResponseOk(deleteResponse, t('msg.deleteFileFailed'));
        showToast(t('msg.deleteFileSuccess', selectedFile.split('/').pop() || ''));
        updateFilePathOptions(); // 刷新文件列表
      } catch (e: any) {
        showToast(t('msg.deleteFileFailedDetail', getErrorMessage(e)), 'error');
      }
    };

    // 打开Gitee仓库
    document.getElementById('openGiteeRepo')!.onclick = function() {
      const owner = ownerEl.value.trim();
      const repo = repoEl.value.trim();
      const branch = branchSel.value;
      const file = filePathSelect.value;

      if (!owner || !repo) {
        showToast(t('msg.fillOwnerRepo'), 'warning');
        return;
      }

      if (!file) {
        showToast(t('msg.selectBookmarkFile'), 'warning');
        return;
      }

      let url = `https://gitee.com/${owner}/${repo}/blob/${branch}/${file}`;

      window.open(url, '_blank');
    };

    // 打开系统书签管理器
    const openSystemBookmarksBtn = document.getElementById('openSystemBookmarksBtn');
    if (openSystemBookmarksBtn) {
      openSystemBookmarksBtn.onclick = function() {
        if (chrome && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: 'chrome://bookmarks/' }, function() {
            if (chrome.runtime.lastError) {
              showToast(t('msg.cannotOpenManager'), 'error');
            }
          });
        } else {
          showToast(t('msg.pleaseOpenManually'), 'error');
        }
      };
    }

    // 打开我的书签管理器
    const openMyBookmarksBtn = document.getElementById('openMyBookmarksBtn');
    if (openMyBookmarksBtn) {
      openMyBookmarksBtn.onclick = function() {
        if (chrome && chrome.tabs && chrome.tabs.create) {
          // 设置认证时间戳，让 bookmark-manager 知道这是从 popup 跳转的，无需二次校验
          chrome.storage.local.set({ bmAuthTimestamp: Date.now() }, function() {
            chrome.tabs.create({ url: chrome.runtime.getURL('bookmark-manager.html') }, function() {
              if (chrome.runtime.lastError) {
                showToast(t('msg.cannotOpenMyManager'), 'error');
              }
            });
          });
        } else {
          // 非扩展环境，直接打开
          window.open('bookmark-manager.html', '_blank');
        }
      };
    }

    // 帮助弹窗逻辑
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const helpClose = document.getElementById('helpClose');
    if (helpBtn && helpModal && helpClose) {
      helpBtn.onclick = () => { helpModal.style.display = 'flex'; };
      helpClose.onclick = () => { helpModal.style.display = 'none'; };
      helpModal.onclick = (e) => {
        if (e.target === helpModal) helpModal.style.display = 'none';
      };
    }

    // == 快捷键设置逻辑 ==
    const searchEnabledEl = document.getElementById('searchEnabled') as HTMLInputElement;
    const searchTriggerKeyEl = document.getElementById('searchTriggerKey') as HTMLSelectElement;
    const searchPressCountEl = document.getElementById('searchPressCount') as HTMLSelectElement;
    const searchTimeWindowEl = document.getElementById('searchTimeWindow') as HTMLSelectElement;
    const closeTabEnabledEl = document.getElementById('closeTabEnabled') as HTMLInputElement;
    const closeTabModifierEl = document.getElementById('closeTabModifier') as HTMLSelectElement;
    const closeTabKeyEl = document.getElementById('closeTabKey') as HTMLInputElement;
    const siteAccessPanelEl = document.getElementById('siteAccessPanel') as HTMLDivElement;
    const requestSiteAccessBtnEl = document.getElementById('requestSiteAccessBtn') as HTMLButtonElement;
    const globalSiteOrigins = ['http://*/*', 'https://*/*'];

    async function hasGlobalSiteAccess(): Promise<boolean> {
      if (!chrome.permissions?.contains) return true;
      return chrome.permissions.contains({ origins: globalSiteOrigins });
    }

    async function updateSiteAccessPanel() {
      siteAccessPanelEl.style.display = await hasGlobalSiteAccess() ? 'none' : 'block';
    }

    requestSiteAccessBtnEl.addEventListener('click', async () => {
      if (!chrome.permissions?.request) return;
      try {
        const granted = await chrome.permissions.request({ origins: globalSiteOrigins });
        await updateSiteAccessPanel();
        showToast(t(granted ? 'shortcut.siteAccessGranted' : 'shortcut.siteAccessDenied'), granted ? 'success' : 'warning');
      } catch (error) {
        showToast(t('shortcut.siteAccessFailed', getErrorMessage(error)), 'error');
      }
    });
    void updateSiteAccessPanel();

    if (searchEnabledEl && searchTriggerKeyEl && searchPressCountEl && searchTimeWindowEl &&
        closeTabEnabledEl && closeTabModifierEl && closeTabKeyEl) {

      // 启用/禁用子控件联动
      function updateSearchControlsState() {
        const disabled = !searchEnabledEl.checked;
        searchTriggerKeyEl.disabled = disabled;
        searchPressCountEl.disabled = disabled;
        searchTimeWindowEl.disabled = disabled;
      }
      function updateCloseTabControlsState() {
        const disabled = !closeTabEnabledEl.checked;
        closeTabModifierEl.disabled = disabled;
        closeTabKeyEl.disabled = disabled;
      }

      // 加载已保存的配置并回填表单
      getShortcutConfig().then((config: any) => {
        searchEnabledEl.checked = config.search.enabled;
        searchTriggerKeyEl.value = config.search.triggerKey;
        searchPressCountEl.value = String(config.search.pressCount);
        searchTimeWindowEl.value = String(config.search.timeWindow);
        closeTabEnabledEl.checked = config.closeTab.enabled;
        closeTabModifierEl.value = config.closeTab.modifier;
        closeTabKeyEl.value = config.closeTab.key.toUpperCase();
        updateSearchControlsState();
        updateCloseTabControlsState();
      });

      // 收集表单数据并保存
      async function saveShortcuts() {
        const config = {
          search: {
            triggerKey: searchTriggerKeyEl.value,
            pressCount: parseInt(searchPressCountEl.value, 10),
            timeWindow: parseInt(searchTimeWindowEl.value, 10),
            enabled: searchEnabledEl.checked,
          },
          closeTab: {
            enabled: closeTabEnabledEl.checked,
            modifier: closeTabModifierEl.value,
            key: (closeTabKeyEl.value || 'w').toLowerCase(),
          },
        };
        try {
          await saveShortcutConfig(config);
          showToast(t('msg.shortcutSaved'));
          await updateSiteAccessPanel();
        } catch (error) {
          showToast(t('msg.shortcutSaveFailed', getErrorMessage(error)), 'error');
        }
      }

      // 绑定 change 事件 — select 和 checkbox
      [searchEnabledEl, searchTriggerKeyEl, searchPressCountEl, searchTimeWindowEl,
       closeTabEnabledEl, closeTabModifierEl].forEach((el: HTMLElement) => {
        el.addEventListener('change', () => {
          void saveShortcuts();
          updateSearchControlsState();
          updateCloseTabControlsState();
        });
      });

      // 关闭标签按键输入：限制单字符 + 自动保存
      closeTabKeyEl.addEventListener('input', () => {
        // 只保留最后输入的一个字符
        if (closeTabKeyEl.value.length > 1) {
          closeTabKeyEl.value = closeTabKeyEl.value.slice(-1);
        }
        closeTabKeyEl.value = closeTabKeyEl.value.toUpperCase();
        void saveShortcuts();
      });
      closeTabKeyEl.addEventListener('blur', () => {
        if (!closeTabKeyEl.value) {
          closeTabKeyEl.value = 'W'; // 为空时恢复默认值
        }
        void saveShortcuts();
      });
    }

    // == 配置导出/导入逻辑 ==
    const importConfigFileEl = document.getElementById('importConfigFile') as HTMLInputElement;
    const cryptoMasterPasswordEl = document.getElementById('cryptoMasterPassword') as HTMLInputElement;
    const cryptoMasterPasswordConfirmEl = document.getElementById('cryptoMasterPasswordConfirm') as HTMLInputElement;
    const btnSaveCryptoMasterEl = document.getElementById('btnSaveCryptoMaster') as HTMLButtonElement;
    const btnClearCryptoMasterEl = document.getElementById('btnClearCryptoMaster') as HTMLButtonElement;
    const giteeFieldNames = ['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath'];

    if (btnSaveCryptoMasterEl && btnClearCryptoMasterEl && cryptoMasterPasswordEl && cryptoMasterPasswordConfirmEl) {
      btnSaveCryptoMasterEl.onclick = async function() {
        const pwd = cryptoMasterPasswordEl.value;
        const confirmPwd = cryptoMasterPasswordConfirmEl.value;
        if (!pwd) {
          showToast(t('crypto.masterEmpty'), 'warning');
          return;
        }
        if (pwd !== confirmPwd) {
          showToast(t('crypto.masterMismatch'), 'warning');
          return;
        }
        try {
          // 先用旧密钥读取明文，再切换主密钥，避免修改主密码时丢失现有配置。
          const plainConfig = await getConfigFromDB(giteeFieldNames);
          await setMasterPassphrase(pwd);
          await setConfigToDB(plainConfig);
          cryptoMasterPasswordEl.value = '';
          cryptoMasterPasswordConfirmEl.value = '';
          showToast(t('crypto.masterSaved'));
        } catch {
          showToast(t('crypto.masterSaveFailed'), 'error');
        }
      };

      btnClearCryptoMasterEl.onclick = async function() {
        if (!confirm(t('confirm.clearCryptoMaster'))) return;
        try {
          // 先读出明文，避免清除后无法解密当前数据
          const plainConfig = await getConfigFromDB(giteeFieldNames);
          await clearMasterPassphrase();
          await setConfigToDB(plainConfig);
          cryptoMasterPasswordEl.value = '';
          cryptoMasterPasswordConfirmEl.value = '';
          showToast(t('crypto.masterCleared'));
        } catch {
          showToast(t('crypto.masterClearFailed'), 'error');
        }
      };
    }

    // 导出配置
    document.getElementById('btnExportConfig')!.onclick = async function() {
      try {
        const useEncryptedExport = await hasMasterPassphrase();
        const giteeConfigData = useEncryptedExport
          ? await getRawConfigFromDB(giteeFieldNames)
          : await getConfigFromDB(giteeFieldNames);

        // 获取快捷键配置
        const shortcutCfg = await getShortcutConfig();

        // 获取主题和语言
        const storageData: any = await new Promise(resolve => {
          chrome.storage.local.get(['app_theme', 'app_locale'], (result: any) => resolve(result));
        });

        const exportData = {
          version: 1,
          exportTime: new Date().toISOString(),
          giteeConfig: {
            encrypted: useEncryptedExport,
            giteeToken: giteeConfigData.giteeToken || '',
            giteeOwner: giteeConfigData.giteeOwner || '',
            giteeRepo: giteeConfigData.giteeRepo || '',
            giteeBranch: giteeConfigData.giteeBranch || '',
            giteeFilePath: giteeConfigData.giteeFilePath || '',
            bookmarkDir: bookmarkDirInput.value.trim() || 'bookmarks',
          },
          shortcutConfig: shortcutCfg,
          theme: storageData.app_theme || 'system',
          locale: storageData.app_locale || 'zh-CN',
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(t('msg.exportConfigSuccess'));
      } catch (e: any) {
        showToast(t('msg.exportConfigFailed'), 'error');
      }
    };

    // 导入配置
    document.getElementById('btnImportConfig')!.onclick = function() {
      importConfigFileEl.click();
    };

    importConfigFileEl.addEventListener('change', async function() {
      const file = this.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // 校验文件格式
        if (!data.version || !data.giteeConfig) {
          showToast(t('msg.importConfigInvalid'), 'warning');
          this.value = '';
          return;
        }

        if (!confirm(t('confirm.importConfig'))) {
          this.value = '';
          return;
        }

        // 1. 导入 Gitee 配置到 IndexedDB
        const giteeFields: Record<string, string> = {};
        giteeFieldNames.forEach(f => {
          if (data.giteeConfig[f] !== undefined) giteeFields[f] = data.giteeConfig[f];
        });

        // 对导入数据先归一化为明文，再统一按当前密钥加密写入
        const normalizedGiteeFields = await normalizeImportedGiteeConfig(giteeFields, Boolean(data.giteeConfig.encrypted));
        await setConfigToDB(normalizedGiteeFields);

        // 回填表单（读取时自动解密）
        const savedConfig = await getConfigFromDB(giteeFieldNames);
        giteeFieldNames.forEach(f => {
          const el = document.getElementById(f) as HTMLInputElement;
          if (el && savedConfig[f]) el.value = savedConfig[f];
        });

        // 回填 bookmarkDir
        if (data.giteeConfig.bookmarkDir) {
          bookmarkDirInput.value = data.giteeConfig.bookmarkDir;
        }

        // 2. 导入快捷键配置
        if (data.shortcutConfig) {
          await saveShortcutConfig(data.shortcutConfig);
          // 回填快捷键表单
          const scCfg = await getShortcutConfig();
          const _searchEnabled = document.getElementById('searchEnabled') as HTMLInputElement;
          const _searchTriggerKey = document.getElementById('searchTriggerKey') as HTMLSelectElement;
          const _searchPressCount = document.getElementById('searchPressCount') as HTMLSelectElement;
          const _searchTimeWindow = document.getElementById('searchTimeWindow') as HTMLSelectElement;
          const _closeTabEnabled = document.getElementById('closeTabEnabled') as HTMLInputElement;
          const _closeTabModifier = document.getElementById('closeTabModifier') as HTMLSelectElement;
          const _closeTabKey = document.getElementById('closeTabKey') as HTMLInputElement;
          if (_searchEnabled) _searchEnabled.checked = scCfg.search.enabled;
          if (_searchTriggerKey) _searchTriggerKey.value = scCfg.search.triggerKey;
          if (_searchPressCount) _searchPressCount.value = String(scCfg.search.pressCount);
          if (_searchTimeWindow) _searchTimeWindow.value = String(scCfg.search.timeWindow);
          if (_closeTabEnabled) _closeTabEnabled.checked = scCfg.closeTab.enabled;
          if (_closeTabModifier) _closeTabModifier.value = scCfg.closeTab.modifier;
          if (_closeTabKey) _closeTabKey.value = scCfg.closeTab.key.toUpperCase();
        }

        // 3. 导入主题和语言
        const storageUpdate: Record<string, string> = {};
        if (data.theme) storageUpdate.app_theme = data.theme;
        if (data.locale) storageUpdate.app_locale = data.locale;
        if (Object.keys(storageUpdate).length > 0) {
          await new Promise<void>(resolve => {
            chrome.storage.local.set(storageUpdate, () => resolve());
          });
        }

        // 刷新主题
        if (data.theme) {
          await initTheme();
          setupThemeToggle();
        }

        // 刷新语言
        if (data.locale) {
          const _langSelect = document.getElementById('langSelect') as HTMLSelectElement;
          if (_langSelect) _langSelect.value = data.locale;
          await setLocale(data.locale as Locale);
          translateDOM();
        }

        showToast(t('msg.importConfigSuccess'));
      } catch (e: any) {
        if (e?.message === 'ENCRYPTED_CONFIG_DECRYPT_FAILED') {
          showToast(t('msg.importConfigDecryptFailed'), 'error');
        } else {
          showToast(t('msg.importConfigFailed'), 'error');
        }
      }

      // 重置 file input
      this.value = '';
    });

    // == 密码设置逻辑 ==
    const passwordEnabledEl = document.getElementById('passwordEnabled') as HTMLInputElement;
    const passwordInputEl = document.getElementById('passwordInput') as HTMLInputElement;
    const passwordConfirmEl = document.getElementById('passwordConfirm') as HTMLInputElement;
    const passwordFieldsEl = document.getElementById('passwordFields') as HTMLDivElement;
    const savePasswordBtnEl = document.getElementById('savePasswordBtn') as HTMLButtonElement;
    function updatePasswordFieldsState() {
      if (passwordFieldsEl) {
        const disabled = !passwordEnabledEl.checked;
        passwordInputEl.disabled = disabled;
        passwordConfirmEl.disabled = disabled;
        // 保存按钮始终可用，取消勾选后也需要能保存"关闭密码"状态
        passwordInputEl.style.opacity = disabled ? '0.5' : '1';
        passwordConfirmEl.style.opacity = disabled ? '0.5' : '1';
      }
    }

    if (passwordEnabledEl && passwordInputEl && passwordConfirmEl && savePasswordBtnEl) {
      // 初始化：从Gitee加载密码配置
      async function loadPasswordConfig() {
        const token = tokenEl.value.trim();
        const owner = ownerEl.value.trim();
        const repo = repoEl.value.trim();
        const branch = branchSel.value;
        const dir = bookmarkDirInput.value.trim();

        if (!token || !owner || !repo || !branch || !dir) {
          updatePasswordFieldsState();
          return;
        }

        try {
          const policy = await resolvePasswordPolicy({ token, owner, repo, branch, bookmarkDir: dir });
          passwordEnabledEl.checked = Boolean(policy?.enabled);
          // 密码仅用于即时派生校验值，绝不从远程或本地回填明文。
          passwordInputEl.value = '';
          passwordConfirmEl.value = '';
        } catch (error) {
          const localPolicy = await getLocalPasswordPolicy().catch(() => null);
          passwordEnabledEl.checked = Boolean(localPolicy?.enabled);
          showToast(t('password.msg.loadFailed', getErrorMessage(error)), 'error');
        }
        updatePasswordFieldsState();
      }

      // 页面加载时读取密码配置
      setTimeout(() => {
        loadPasswordConfig();
      }, 500);

      // 启用/禁用密码保护
      passwordEnabledEl.addEventListener('change', () => {
        updatePasswordFieldsState();
      });

      // 保存密码设置
      savePasswordBtnEl.addEventListener('click', async () => {
        const token = tokenEl.value.trim();
        const owner = ownerEl.value.trim();
        const repo = repoEl.value.trim();
        const branch = branchSel.value;
        const dir = bookmarkDirInput.value.trim();

        if (!token || !owner || !repo || !branch || !dir) {
          showToast(t('password.msg.configFirst'), 'warning');
          return;
        }

        const enabled = passwordEnabledEl.checked;
        const password = passwordInputEl.value;
        const confirm = passwordConfirmEl.value;

        if (enabled) {
          if (!password) {
            showToast(t('password.msg.empty'), 'warning');
            return;
          }
          if (password !== confirm) {
            showToast(t('password.msg.mismatch'), 'warning');
            return;
          }
        }

        const originalText = savePasswordBtnEl.textContent || '';
        savePasswordBtnEl.disabled = true;
        savePasswordBtnEl.textContent = t('password.saving');
        try {
          const policy = await createPasswordPolicy(password, enabled);
          await saveRemotePasswordPolicy({ token, owner, repo, branch, bookmarkDir: dir }, policy);
          passwordInputEl.value = '';
          passwordConfirmEl.value = '';
          showToast(t('password.msg.saved'));
        } catch (error) {
          showToast(t('password.msg.saveFailedDetail', getErrorMessage(error)), 'error');
        } finally {
          savePasswordBtnEl.disabled = false;
          savePasswordBtnEl.textContent = savePasswordBtnEl.dataset.i18n ? t(savePasswordBtnEl.dataset.i18n) : originalText;
        }
      });

      // 初始化密码字段状态
      updatePasswordFieldsState();
    }
  } // end initPopupUI

  // 如果不是Chrome扩展环境，直接返回
  if (!isChromeExtensionContext()) {
    return;
  }

  // == 密码锁定检查 ==
  const popupContent = document.getElementById('popupContent') as HTMLDivElement;
  const lockOverlay = document.getElementById('passwordLockOverlay') as HTMLDivElement;
  const lockInput = document.getElementById('lockPasswordInput') as HTMLInputElement;
  const lockSubmit = document.getElementById('lockPasswordSubmit') as HTMLButtonElement;
  const lockError = document.getElementById('lockPasswordError') as HTMLDivElement;

  function initializeUnlockedPopup() {
    popupContent.style.display = 'flex';
    initPopupUI();
  }

  function activatePasswordLock(policy: PasswordPolicy) {
    popupContent.remove();
    document.body.style.minHeight = '360px';
    lockOverlay.style.display = 'flex';

    let unlocked = false;
    const protectObserver = new MutationObserver(() => {
      if (!unlocked) {
        if (lockOverlay.style.display !== 'flex') lockOverlay.style.display = 'flex';
        document.getElementById('popupContent')?.remove();
      }
    });
    protectObserver.observe(lockOverlay, { attributes: true, attributeFilter: ['style', 'class'] });
    protectObserver.observe(document.body, { childList: true });

    const doUnlock = async () => {
      const inputValue = lockInput.value;
      if (!inputValue) {
        lockError.textContent = t('password.msg.empty');
        return;
      }

      lockSubmit.disabled = true;
      lockSubmit.textContent = t('password.lock.verifying');
      try {
        if (await verifyPassword(inputValue, policy)) {
          unlocked = true;
          protectObserver.disconnect();
          lockOverlay.style.display = 'none';
          document.body.style.minHeight = '';
          document.body.appendChild(popupContent);
          translateDOM();
          initializeUnlockedPopup();
        } else {
          lockError.textContent = t('password.lock.error');
          lockInput.value = '';
          lockInput.focus();
        }
      } finally {
        lockSubmit.disabled = false;
        lockSubmit.textContent = t('password.lock.submit');
      }
    };

    lockSubmit.addEventListener('click', () => { void doUnlock(); });
    lockInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') void doUnlock();
    });
    setTimeout(() => lockInput.focus(), 50);
  }

  try {
    const configData = await getConfigFromDB(['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath']);
    const filePath = configData.giteeFilePath || '';
    const bookmarkDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
    const location = configData.giteeToken && configData.giteeOwner && configData.giteeRepo
      ? {
          token: configData.giteeToken,
          owner: configData.giteeOwner,
          repo: configData.giteeRepo,
          branch: configData.giteeBranch || 'master',
          bookmarkDir,
        }
      : undefined;
    const policy = await resolvePasswordPolicy(location);
    if (policy?.enabled) activatePasswordLock(policy);
    else initializeUnlockedPopup();
  } catch (error) {
    // 配置读取失败时仍检查本地策略；已启用保护的设备绝不能因网络或存储故障直接放行。
    const localPolicy = await getLocalPasswordPolicy().catch(() => null);
    if (localPolicy?.enabled) activatePasswordLock(localPolicy);
    else initializeUnlockedPopup();
  }
});
