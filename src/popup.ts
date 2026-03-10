import { initLocale, t, setLocale, getLocale, translateDOM } from './i18n/index';
import type { Locale } from './i18n/index';
import { initTheme, setupThemeToggle } from './theme';

declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && 
         chrome.runtime && 
         chrome.runtime.sendMessage &&
         chrome.bookmarks;
}

// == indexDB 工具 ==
const DB_NAME = 'bookmarks-plus';
const STORE_NAME = 'gitee-config';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function(e) {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = function(e) {
      resolve((e.target as IDBOpenDBRequest).result);
    };
    req.onerror = function(e) {
      reject(e);
    };
  });
}
function getConfigFromDB(fields: string[]): Promise<any> {
  return openDB().then(db => {
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const result: any = {};
      let count = fields.length;
      fields.forEach(f => {
        const req = store.get(f);
        req.onsuccess = function() {
          result[f] = req.result || '';
          count--;
          if (count === 0) resolve(result);
        };
        req.onerror = function() {
          count--;
          if (count === 0) resolve(result);
        };
      });
    });
  });
}
function setConfigToDB(config: Record<string, string>) {
  return openDB().then(db => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    Object.entries(config).forEach(([k, v]) => store.put(v, k));
    return new Promise<void>(resolve => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  });
}
// == 密码文件工具 ==
const PASSWORD_FILE_NAME = '密码.json';

// 获取密码文件路径（原始路径）
function getPasswordFilePath(bookmarkDir: string): string {
  return bookmarkDir ? `${bookmarkDir}/${PASSWORD_FILE_NAME}` : PASSWORD_FILE_NAME;
}

// 对路径逐段编码，保留 / 分隔符
function encodeFilePath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

// 从Gitee读取密码配置
async function getPasswordConfig(token: string, owner: string, repo: string, branch: string, bookmarkDir: string): Promise<{enabled: boolean, password: string} | null> {
  const filePath = getPasswordFilePath(bookmarkDir);
  const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeFilePath(filePath)}?ref=${branch}`;
  try {
    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (!response.ok) {
      // 文件不存在，返回null
      return null;
    }
    const fileData = await response.json();
    const decodedContent = atob(fileData.content);
    const decoder = new TextDecoder();
    const decodedData = decoder.decode(
      new Uint8Array([...decodedContent].map((char) => char.charCodeAt(0)))
    );
    return JSON.parse(decodedData);
  } catch (error) {
    return null;
  }
}

// 保存密码配置到Gitee（创建或更新密码.json）
async function savePasswordConfig(token: string, owner: string, repo: string, branch: string, bookmarkDir: string, config: {enabled: boolean, password: string}): Promise<boolean> {
  const filePath = getPasswordFilePath(bookmarkDir);
  const content = JSON.stringify(config, null, 2);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const encodedContent = safeBtoa(data);

  const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeFilePath(filePath)}`;

  try {
    // 先尝试获取文件（获取SHA用于更新）
    const getUrl = `${apiUrl}?ref=${branch}`;
    const getResponse = await fetch(getUrl, {
      headers: { 'Authorization': `token ${token}` }
    });
    let sha = '';

    if (getResponse.ok) {
      const fileInfo = await getResponse.json();
      // 确保返回的是文件对象（有sha），而非目录列表（数组）
      if (fileInfo && !Array.isArray(fileInfo) && fileInfo.sha) {
        sha = fileInfo.sha;
      }
    }

    if (sha) {
      // 文件已存在且获取到SHA，更新文件
      const putResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          content: encodedContent,
          message: '更新密码配置',
          sha: sha,
          branch: branch
        })
      });
      return putResponse.ok;
    } else {
      // 文件不存在或无法获取SHA，创建文件
      const postResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          content: encodedContent,
          message: '新增密码配置文件',
          branch: branch
        })
      });
      return postResponse.ok;
    }
  } catch (error) {
    return false;
  }
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
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ shortcut_config: JSON.stringify(config) }, () => resolve());
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
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: "token " + accessToken,
    },
  });
  const fileData = await response.json();
  return fileData;
}
async function putFileContent(apiUrl: string, accessToken: string, encodedContent: string, sha: string) {
  const commitData = {
    access_token: accessToken,
    content: encodedContent,
    message: "书签更新",
    sha: sha,
  };
  const putResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "token " + accessToken,
    },
    body: JSON.stringify(commitData),
  });
  if (putResponse.ok) {
    showMsg(t('msg.uploaded'));
  } else {
    showMsg(t('msg.uploadFailed'), true);
  }
}
function safeBtoa(data: Uint8Array) {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
async function modifyFile(gitInfo: any, modifiedContent: any, isCover: boolean) {
  const accessToken = gitInfo.giteeToken;
  const apiUrl =
    "https://gitee.com/api/v5/repos/" +
    gitInfo.giteeOwner +
    "/" +
    gitInfo.giteeRepo +
    "/contents/" +
    gitInfo.giteeFilePath +
    "?ref=" +
    gitInfo.giteeBranch;
  try {
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
  } catch (error) {
    showMsg(t('msg.uploadFailed'), true);
  }
}
async function getFile(gitInfo: any) {
  const accessToken = gitInfo.giteeToken;
  const apiUrl =
    "https://gitee.com/api/v5/repos/" +
    gitInfo.giteeOwner +
    "/" +
    gitInfo.giteeRepo +
    "/contents/" +
    gitInfo.giteeFilePath +
    "?ref=" +
    gitInfo.giteeBranch;
  const file = await fetchFileContent(apiUrl, accessToken);
  const fileContent = file.content || "";
  const decodedContent = atob(fileContent); // 解码Base64编码的文件内容
  const decoder = new TextDecoder();
  const decodedData = decoder.decode(
    new Uint8Array([...decodedContent].map((char) => char.charCodeAt(0)))
  );
  return JSON.parse(decodedData);
}


// == 书签操作 ==
function getLocalBookmarks(): Promise<any[]> {
  return new Promise(resolve => {
    chrome.bookmarks.getTree(resolve);
  });
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
function removeAllBookmarks(): Promise<void> {
  return new Promise(resolve => {
    chrome.bookmarks.getTree((nodes: any[]) => {
      const rootChildren = nodes[0]?.children || [];
      let toDelete: string[] = [];
      rootChildren.forEach((node: any) => {
        // 只删除根目录下的子节点（即书签栏、其他书签、移动设备书签的 children）
        if (node.children && node.children.length) {
          node.children.forEach((child: any) => toDelete.push(child.id));
        }
      });
      let count = toDelete.length;
      if (count === 0) return resolve();
      toDelete.forEach(id => {
        chrome.bookmarks.removeTree(id, () => {
          count--;
          if (count === 0) resolve();
        });
      });
    });
  });
}
function createBookmarks(nodes: any[], parentId = '1'): Promise<void> {
  // parentId: '1' 是根目录
  return Promise.all(nodes.map(node => {
    if (node.url) {
      return new Promise(res => {
        chrome.bookmarks.create({ parentId, title: node.title, url: node.url }, () => res(undefined));
      });
    } else {
      return new Promise(res => {
        chrome.bookmarks.create({ parentId, title: node.title }, (folder: any) => {
          if (node.children && node.children.length) {
            createBookmarks(node.children, folder.id).then(() => res(undefined));
          } else {
            res(undefined);
          }
        });
      });
    }
  })).then(() => {});
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

// == 按钮事件绑定 ==
function showMsg(text: string, isError = false) {
  const msg = document.getElementById('giteeMsg');
  if (msg) {
    msg.textContent = text;
    (msg as HTMLElement).style.color = isError ? 'var(--color-accent-red)' : 'var(--color-accent-green)';
    setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化主题
  await initTheme();
  setupThemeToggle();

  // 初始化语言
  await initLocale();
  translateDOM();

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

  try {
    const configData = await getConfigFromDB(['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath']);
    const pToken = configData.giteeToken || '';
    const pOwner = configData.giteeOwner || '';
    const pRepo = configData.giteeRepo || '';
    const pBranch = configData.giteeBranch || 'master';
    const pFilePath = configData.giteeFilePath || '';
    const pDir = pFilePath.includes('/') ? pFilePath.substring(0, pFilePath.lastIndexOf('/')) : '';

    let needLock = false;
    if (pToken && pOwner && pRepo && pBranch && pDir) {
      const pwdConfig = await getPasswordConfig(pToken, pOwner, pRepo, pBranch, pDir);
      if (pwdConfig && pwdConfig.enabled && pwdConfig.password) {
        needLock = true;
        // 显示密码锁定遮罩
        document.body.style.minHeight = '360px';
        lockOverlay.style.display = 'flex';

        const doUnlock = () => {
          const inputVal = lockInput.value;
          if (!inputVal) {
            lockError.textContent = t('password.msg.empty');
            return;
          }
          if (inputVal === pwdConfig.password) {
            lockOverlay.style.display = 'none';
            popupContent.style.display = 'flex';
            document.body.style.minHeight = '';
          } else {
            lockError.textContent = t('password.lock.error');
            lockInput.value = '';
            lockInput.focus();
          }
        };

        lockSubmit.addEventListener('click', doUnlock);
        lockInput.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') doUnlock();
        });
        setTimeout(() => lockInput.focus(), 50);
      }
    }
    // 无需密码，直接显示主内容
    if (!needLock) {
      popupContent.style.display = 'flex';
    }
  } catch (e) {
    // 密码检查失败，不锁定，显示主内容
    popupContent.style.display = 'flex';
  }

  // Gitee 配置表单逻辑
  // const form = document.getElementById('giteeForm');
  const msg = document.getElementById('giteeMsg');
  const fields = ['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath'];
  // 自动填充
  getConfigFromDB(fields).then((data) => {
    fields.forEach(f => {
      const el = document.getElementById(f) as HTMLInputElement;
      if (el && data[f]) el.value = data[f];
    });
  });
  // 自动回填保存的 filePath 配置
  getConfigFromDB(['giteeFilePath']).then((data) => {
    const savedFile = data['giteeFilePath'];
    if (savedFile) {
      // 等待文件列表加载后再选中
      const trySelect = () => {
        const opt = Array.from(filePathSelect.options).find(o => o.value === savedFile);
        if (opt) {
          filePathSelect.value = savedFile;
        } else {
          setTimeout(trySelect, 100);
        }
      };
      trySelect();
    }
  });
  // 输入框失焦和输入时自动保存
  fields.forEach(f => {
    const el = document.getElementById(f) as HTMLInputElement;
    function save() {
      const config: Record<string, string> = {};
      fields.forEach(ff => {
        const v = (document.getElementById(ff) as HTMLInputElement).value;
        config[ff] = v;
      });
      setConfigToDB(config).then(() => {
        if (msg) {
          msg.textContent = t('msg.configSaved');
          setTimeout(() => { msg.textContent = ''; }, 1200);
        }
      });
    }
    el.addEventListener('blur', save);
    el.addEventListener('input', save);
  });

  const tokenEl = document.getElementById('giteeToken') as HTMLInputElement;
  const ownerEl = document.getElementById('giteeOwner') as HTMLInputElement;
  const repoEl = document.getElementById('giteeRepo') as HTMLInputElement;
  const branchSel = document.getElementById('giteeBranch') as HTMLSelectElement;
  const filePathSelect = document.getElementById('giteeFilePath') as HTMLSelectElement;
  const bookmarkDirInput = document.getElementById('bookmarkDir') as HTMLInputElement;
  
  // 监听来自content script的消息（在DOM加载完成后设置）
  chrome.runtime.onMessage.addListener((message: any) => {
    if (message.type === 'updateToken' && message.token) {
      // 更新token输入框
      const tokenEl = document.getElementById('giteeToken') as HTMLInputElement;
      if (tokenEl) {
        tokenEl.value = message.token;
        // 触发自动保存
        tokenEl.dispatchEvent(new Event('blur'));
        showMsg(t('msg.tokenUpdated'));
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
          tokenEl.dispatchEvent(new Event('blur'));
          showMsg(t('msg.tokenUpdated'));
          // 清除storage中的token，避免重复使用
          chrome.storage.local.remove(['latestToken']);
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
    let url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents`;
    if (dir) url += `/${encodeURIComponent(dir)}`;
    url += `?ref=${branch}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (!res.ok) throw new Error(t('select.getFileFailed'));
    const data = await res.json();
    return Array.isArray(data) ? data.filter((f: any) => f.type === 'file').map((f: any) => f.path) : [];
  }
  async function fetchGiteeBranches(token: string, owner: string, repo: string): Promise<string[]> {
    const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/branches`;
    const res = await fetch(url, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (!res.ok) throw new Error(t('select.getBranchFailed'));
    const data = await res.json();
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
      // 过滤掉 .keep 文件
      const filtered = files.filter((f: string) => !f.endsWith('.keep'));
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

  document.getElementById('btnSaveOverwrite')!.onclick = async function() {
    if (!confirm(t('confirm.overwriteSave'))) {
      return;
    }

    // 询问是否保留隐藏书签
    const keepHidden = confirm(t('confirm.keepHidden'));

    try {
      const config = await getGiteeConfig();
      const tree = await getLocalBookmarks();
      let content = tree[0]?.children || [];

      if (keepHidden) {
        // 需要保留隐藏书签，从书签管理器中获取包含隐藏属性的书签
        try {
          // 通过消息传递获取书签管理器的完整书签数据
          const bookmarkManagerData = await getBookmarkManagerData();

          if (bookmarkManagerData && bookmarkManagerData.length > 0) {
            // 筛选出书签管理器中的隐藏书签
            const hiddenBookmarks = filterHiddenBookmarks(bookmarkManagerData);

            // 将隐藏书签合并到当前要保存的书签中
            content = mergeBookmarks(content, hiddenBookmarks);

            showMsg(t('msg.hiddenBookmarksKept'));
          } else {
            showMsg(t('msg.cannotGetManagerData'), true);
          }
        } catch (error) {
          showMsg(t('msg.getManagerDataFailed'), true);
        }
      }

      await modifyFile(config, content, true);
      showMsg(t('msg.overwriteSaveSuccess'));
    } catch (e: any) {
      showMsg(t('msg.overwriteSaveFailed', e.message), true);
    }
  };

  document.getElementById('btnSaveMerge')!.onclick = async function() {
    if (!confirm(t('confirm.mergeSave'))) {
      return;
    }
    try {
      const config = await getGiteeConfig();
      const tree = await getLocalBookmarks();
      const content = tree[0]?.children || [];
      await modifyFile(config, content, false);
      showMsg(t('msg.mergeSaveSuccess'));
    } catch (e: any) {
      showMsg(t('msg.mergeSaveFailed', e.message), true);
    }
  };

  document.getElementById('btnGetOverwrite')!.onclick = async function() {
    if (!confirm(t('confirm.overwriteGet'))) {
      return;
    }
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

      await removeAllBookmarks();
      await createBookmarks(visibleBookmarks, '1'); // 只写入书签栏（仅可见书签）
      showMsg(t('msg.overwriteGetSuccess'));
    } catch (e: any) {
      showMsg(t('msg.overwriteGetFailed', e.message), true);
    }
  };

  document.getElementById('btnGetMerge')!.onclick = async function() {
    if (!confirm(t('confirm.mergeGet'))) {
      return;
    }
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

      await removeAllBookmarks();
      await createBookmarks(visibleMerged, '1'); // 只写入书签栏（仅可见书签）
      showMsg(t('msg.mergeGetSuccess'));
    } catch (e: any) {
      showMsg(t('msg.mergeGetFailed', e.message), true);
    }
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
      showMsg(t('msg.fillConfigFirst'), true);
      return;
    }

    try {
      const filePath = dir ? `${dir}/${finalFileName}` : finalFileName;
      const content = JSON.stringify([], null, 2); // 空的书签数组
      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
      const response = await fetch(url, {
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

      if (response.ok) {
        showMsg(t('msg.addFileSuccess', finalFileName));
        updateFilePathOptions(); // 刷新文件列表
      } else {
        showMsg(t('msg.addFileFailed'), true);
      }
    } catch (e: any) {
      showMsg(t('msg.addFileFailed') + ': ' + e.message, true);
    }
  };
  
  // 删除书签文件
  document.getElementById('deleteBookmarkFile')!.onclick = async function() {
    const selectedFile = filePathSelect.value;
    if (!selectedFile) {
      showMsg(t('msg.selectFileFirst'), true);
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
      showMsg(t('msg.fillConfigFirst'), true);
      return;
    }

    try {
      // 先获取文件信息（需要 sha）
      const getUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(selectedFile)}?ref=${branch}`;
      const getResponse = await fetch(getUrl, {
        headers: { 'Authorization': `token ${token}` }
      });
      if (!getResponse.ok) {
        showMsg(t('msg.fileInfoFailed'), true);
        return;
      }
      const fileInfo = await getResponse.json();

      // 删除文件
      const deleteUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(selectedFile)}`;
      const deleteResponse = await fetch(deleteUrl, {
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

      if (deleteResponse.ok) {
        showMsg(t('msg.deleteFileSuccess', selectedFile.split('/').pop() || ''));
        updateFilePathOptions(); // 刷新文件列表
      } else {
        showMsg(t('msg.deleteFileFailed'), true);
      }
    } catch (e: any) {
      showMsg(t('msg.deleteFileFailed') + ': ' + e.message, true);
    }
  };

  // 打开Gitee仓库
  document.getElementById('openGiteeRepo')!.onclick = function() {
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    const branch = branchSel.value;
    const file = filePathSelect.value;
    
    if (!owner || !repo) {
      showMsg(t('msg.fillOwnerRepo'), true);
      return;
    }
    
    if (!file) {
      showMsg(t('msg.selectBookmarkFile'), true);
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
            alert(t('msg.cannotOpenManager'));
          }
        });
      } else {
        alert(t('msg.pleaseOpenManually'));
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
              alert(t('msg.cannotOpenMyManager'));
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
  const shortcutMsg = document.getElementById('shortcutMsg');

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
    function saveShortcuts() {
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
      saveShortcutConfig(config).then(() => {
        if (shortcutMsg) {
          shortcutMsg.textContent = t('msg.shortcutSaved');
          setTimeout(() => { if (shortcutMsg) shortcutMsg.textContent = ''; }, 1200);
        }
      });
    }

    // 绑定 change 事件 — select 和 checkbox
    [searchEnabledEl, searchTriggerKeyEl, searchPressCountEl, searchTimeWindowEl,
     closeTabEnabledEl, closeTabModifierEl].forEach((el: HTMLElement) => {
      el.addEventListener('change', () => {
        saveShortcuts();
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
      saveShortcuts();
    });
    closeTabKeyEl.addEventListener('blur', () => {
      if (!closeTabKeyEl.value) {
        closeTabKeyEl.value = 'W'; // 为空时恢复默认值
      }
      saveShortcuts();
    });
  }

  // == 密码设置逻辑 ==
  const passwordEnabledEl = document.getElementById('passwordEnabled') as HTMLInputElement;
  const passwordInputEl = document.getElementById('passwordInput') as HTMLInputElement;
  const passwordConfirmEl = document.getElementById('passwordConfirm') as HTMLInputElement;
  const passwordFieldsEl = document.getElementById('passwordFields') as HTMLDivElement;
  const savePasswordBtnEl = document.getElementById('savePasswordBtn') as HTMLButtonElement;
  const passwordMsg = document.getElementById('passwordMsg');

  function showPasswordMsg(text: string, isError = false) {
    if (passwordMsg) {
      passwordMsg.textContent = text;
      (passwordMsg as HTMLElement).style.color = isError ? 'var(--color-accent-red)' : 'var(--color-accent-green)';
      setTimeout(() => { if (passwordMsg) passwordMsg.textContent = ''; }, 3000);
    }
  }

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
        const config = await getPasswordConfig(token, owner, repo, branch, dir);
        if (config) {
          passwordEnabledEl.checked = config.enabled;
          passwordInputEl.value = config.password;
          passwordConfirmEl.value = config.password;
        } else {
          // 密码.json不存在，说明没有配置密码
          passwordEnabledEl.checked = false;
          passwordInputEl.value = '';
          passwordConfirmEl.value = '';
        }
      } catch (error) {
        passwordEnabledEl.checked = false;
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
        showPasswordMsg(t('password.msg.configFirst'), true);
        return;
      }

      const enabled = passwordEnabledEl.checked;
      const password = passwordInputEl.value;
      const confirm = passwordConfirmEl.value;

      if (enabled) {
        if (!password) {
          showPasswordMsg(t('password.msg.empty'), true);
          return;
        }
        if (password !== confirm) {
          showPasswordMsg(t('password.msg.mismatch'), true);
          return;
        }
      }

      const config = {
        enabled: enabled,
        password: enabled ? password : ''
      };

      const success = await savePasswordConfig(token, owner, repo, branch, dir, config);
      if (success) {
        showPasswordMsg(t('password.msg.saved'));
      } else {
        showPasswordMsg(t('password.msg.saveFailed'), true);
      }
    });

    // 初始化密码字段状态
    updatePasswordFieldsState();
  }
});
