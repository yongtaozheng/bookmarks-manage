declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && 
         chrome.runtime && 
         chrome.runtime.sendMessage;
}

let cmdCount = 0;
let lastCmdTime = 0;
let searchBox: HTMLDivElement | null = null;
let inputEl: HTMLInputElement | null = null;
let resultList: HTMLUListElement | null = null;
let results: any[] = [];
let selectedIdx = -1;
let allBookmarks: any[] = [];
let isComposing = false;

async function fetchAllBookmarks() {
  if (!isChromeExtensionContext()) {
    return [];
  }
  return new Promise<any[]>(resolve => {
    try {
      chrome.runtime.sendMessage({ type: 'getAllBookmarks' }, (res: any) => {
        if (chrome.runtime.lastError) {
          console.warn('Chrome runtime error:', chrome.runtime.lastError);
          resolve([]);
          return;
        }
        resolve(res?.tree || []);
      });
    } catch (error) {
      console.warn('Error fetching bookmarks:', error);
      resolve([]);
    }
  });
}

// 监听 command 连续按下（兼容 Mac/Win，capture: true）
window.addEventListener('keydown', (e) => {
  try {
    if ((e.key === 'Meta' || e.key === 'OS') && !e.repeat) {

      const now = Date.now();
      if (now - lastCmdTime < 800) {
        cmdCount++;
      } else {
        cmdCount = 1;
      }
      lastCmdTime = now;
      if (cmdCount === 3) {
        e.preventDefault();
        showSearchBox();
        cmdCount = 0;
      }
    } else if (e.key === 'Escape' && searchBox) {
      removeSearchBox();
    }
    // Alt+W 关闭当前tab
    else if ((e.altKey && (e.key === 'w' || e.key === 'W')) && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.remove) {
      e.preventDefault();
      // 获取当前tabId并关闭
      try {
        chrome.runtime.sendMessage({ type: 'closeCurrentTab' });
      } catch {}
    }
  } catch (error) {
    console.warn('Error in keydown handler:', error);
  }
}, true);

function showSearchBox() {
  if (searchBox) return;
  searchBox = document.createElement('div');
  searchBox.style.position = 'fixed';
  searchBox.style.top = '0';
  searchBox.style.left = '50%';
  searchBox.style.transform = 'translateX(-50%)';
  searchBox.style.zIndex = '999999';
  searchBox.style.background = 'transparent';
  searchBox.style.width = '100vw';
  searchBox.style.display = 'flex';
  searchBox.style.flexDirection = 'column';
  searchBox.style.alignItems = 'center';
  searchBox.style.pointerEvents = 'none';

  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.placeholder = '搜索书签...';
  inputEl.style.fontSize = '1.2em';
  inputEl.style.padding = '0.5em 1em';
  inputEl.style.border = '1.5px solid #42b983';
  inputEl.style.borderRadius = '6px';
  inputEl.style.outline = 'none';
  inputEl.style.marginTop = '1.5em';
  inputEl.style.background = '#fff';
  inputEl.style.width = '50%';
  inputEl.style.maxWidth = '90vw';
  inputEl.style.height = '3em';
  inputEl.style.lineHeight = '3em';
  inputEl.style.boxShadow = '0 2px 16px 0 rgba(60,60,60,0.18)';
  inputEl.style.pointerEvents = 'auto';

  resultList = document.createElement('ul');
  resultList.style.position = 'absolute';
  resultList.style.top = 'calc(1.5em + 3em)';
  resultList.style.left = '50%';
  resultList.style.transform = 'translateX(-50%)';
  resultList.style.listStyle = 'none';
  resultList.style.margin = '0';
  resultList.style.padding = '0';
  resultList.style.width = '50%';
  resultList.style.maxWidth = '90vw';
  resultList.style.maxHeight = '260px';
  resultList.style.overflowY = 'auto';
  resultList.style.overflowX = 'hidden'; // 禁止横向滚动
  resultList.style.background = '#fff';
  resultList.style.borderRadius = '6px';
  resultList.style.boxShadow = '0 1px 8px 0 rgba(60,60,60,0.08)';
  resultList.style.pointerEvents = 'auto';

  searchBox.appendChild(inputEl);
  searchBox.appendChild(resultList);
  document.body.appendChild(searchBox);
  inputEl.focus();

  inputEl.addEventListener('compositionstart', () => { isComposing = true; });
  inputEl.addEventListener('compositionend', () => { isComposing = false; });
  // inputEl.addEventListener('input', onInput); // 替换为异步
  inputEl.addEventListener('input', () => { (window as any).onInputAsync && (window as any).onInputAsync(); });
  inputEl.addEventListener('keydown', onInputKeydown);
  document.addEventListener('mousedown', onDocClick, true);

  // 预加载所有书签
  if (!allBookmarks.length) {
    fetchAllBookmarks().then((tree) => {
      allBookmarks = [];
      function flat(nodes: any[], parent?: any) {
        nodes.forEach(n => {
          if (n.url) {
            allBookmarks.push({ ...n, type: 'bookmark', parent });
          } else if (n.children) {
            allBookmarks.push({ ...n, type: 'folder', parent });
            flat(n.children, n);
          }
        });
      }
      flat(tree);
    });
  }
}

function removeSearchBox() {
  if (searchBox) {
    searchBox.remove();
    searchBox = null;
    inputEl = null;
    resultList = null;
    results = [];
    selectedIdx = -1;
    document.removeEventListener('mousedown', onDocClick, true);
  }
}

function getBookmarkUsageKey(bookmark: any): string {
  // 以 url 作为 key，若无 url 则用 id
  return bookmark.url || bookmark.id;
}
async function getUsageData(): Promise<Record<string, { count: number; last: number }>> {
  return new Promise((resolve) => {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['bookmark_usage'], (result: any) => {
        try {
          resolve(result.bookmark_usage ? JSON.parse(result.bookmark_usage) : {});
        } catch {
          resolve({});
        }
      });
    } else {
      resolve({});
    }
  });
}
async function setUsageData(data: Record<string, { count: number; last: number }>): Promise<void> {
  return new Promise((resolve) => {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ bookmark_usage: JSON.stringify(data) }, () => resolve());
    } else {
      resolve();
    }
  });
}
async function recordBookmarkUsage(bookmark: any): Promise<void> {
  const key = getBookmarkUsageKey(bookmark);
  const usage = await getUsageData();
  if (!usage[key]) usage[key] = { count: 0, last: 0 };
  usage[key].count += 1;
  usage[key].last = Date.now();
  await setUsageData(usage);
}

async function onInput() {
  const val = inputEl!.value.trim().toLowerCase();
  if (!val) {
    renderResults([]);
    return;
  }
  // 匹配所有文件夹
  const folderMatches = allBookmarks.filter((b: any) => b.type === 'folder' && b.title && b.title.toLowerCase().includes(val));
  if (folderMatches.length > 0) {
    // 合并所有匹配文件夹下的所有书签（递归）
    const folderBookmarks: any[] = [];
    function collectBookmarks(nodes: any[]): void {
      nodes.forEach((n: any) => {
        if (n.url) folderBookmarks.push(n);
        if (n.children) collectBookmarks(n.children);
      });
    }
    folderMatches.forEach((folder: any) => collectBookmarks(folder.children || []));
    results = folderBookmarks;
    selectedIdx = results.length ? 0 : -1;
    renderResults(results);
    return;
  }
  // 模糊匹配并排序（书签）+ 最近最常用加权
  const usage = await getUsageData();
  const scored = allBookmarks
    .filter((b: any) => b.type === 'bookmark')
    .map((b: any) => {
      const score = fuzzyScore(val, b.title || '', b.url || '');
      const key = getBookmarkUsageKey(b);
      const u = usage[key] || { count: 0, last: 0 };
      return { ...b, score, usageCount: u.count, lastUsed: u.last };
    })
    .filter((b: any) => b.score > 0)
    .sort((a: any, b: any) => {
      // 先按最近使用时间，再按使用次数，再按 fuzzyScore
      if (b.lastUsed !== a.lastUsed) return b.lastUsed - a.lastUsed;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.score - a.score;
    })
    .slice(0, 5);
  results = scored;
  selectedIdx = results.length ? 0 : -1;
  renderResults(results);
}

function fuzzyScore(q: string, title: string, url: string) {
  title = title.toLowerCase();
  url = url.toLowerCase();
  if (title.includes(q)) return 100 + (100 - title.indexOf(q));
  if (url.includes(q)) return 80 + (100 - url.indexOf(q));
  // 首字母匹配
  if (title.replace(/\s/g, '').startsWith(q.replace(/\s/g, ''))) return 60;
  // 简单子序列匹配
  let t = 0, i = 0;
  for (let c of q) {
    i = title.indexOf(c, i);
    if (i === -1) return 0;
    t++;
    i++;
  }
  return t > 0 ? 30 + t : 0;
}

function renderResults(list: any[], folderTitle?: string) {
  if (!resultList) return;
  resultList.innerHTML = '';
  // 显示所有匹配项
  list.forEach((item, idx) => {
    const li = document.createElement('li');
    li.textContent = item.title + (item.url ? ` (${item.url})` : '');
    li.style.padding = '0.4em 0.8em';
    li.style.cursor = 'pointer';
    li.style.background = idx === selectedIdx ? '#e3eefa' : '#fff';
    li.style.color = idx === selectedIdx ? '#1976d2' : '#333';
    li.style.fontSize = '0.98em';
    li.style.overflow = 'hidden';
    li.style.textOverflow = 'ellipsis';
    li.style.display = '-webkit-box';
    li.style.webkitBoxOrient = 'vertical';
    li.style.webkitLineClamp = '5'; // 最多五行
    li.style.maxHeight = '7em'; // 控制五行高度
    li.style.wordBreak = 'break-all';
    li.onmouseenter = () => {
      selectedIdx = idx;
      renderResults(list, folderTitle);
    };
    li.onmousedown = (e) => {
      e.preventDefault();
      jumpTo(idx);
    };
    resultList!.appendChild(li);
  });
  // 自动滚动选中项到视窗
  if (selectedIdx >= 0 && resultList.children[selectedIdx + (folderTitle ? 1 : 0)]) {
    const el = resultList.children[selectedIdx + (folderTitle ? 1 : 0)] as HTMLElement;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function onInputKeydown(e: KeyboardEvent) {
  if (isComposing) return;
  if (!results.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIdx = (selectedIdx + 1) % results.length;
    renderResults(results);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIdx = (selectedIdx - 1 + results.length) % results.length;
    renderResults(results);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedIdx >= 0 && selectedIdx < results.length) {
      // jumpTo(selectedIdx);
      (async () => { await jumpTo(selectedIdx); })();
    }
  }
}

async function jumpTo(idx: number) {
  const bookmark: any = results[idx];
  const url = bookmark?.url;
  if (url) {
    await recordBookmarkUsage(bookmark);
    // 如果是javascript脚本，直接执行
    if (url.startsWith('javascript:')) {
      try {
        const script = url.substring(11); // 去掉 'javascript:' 前缀
        eval(script);
      } catch (e) {
        console.warn('Failed to execute bookmark script:', e);
      }
    } else if (url.startsWith('data:')) {
      // data:URL 尝试在新标签页打开，如果失败则提示用户
      try {
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          // 如果弹窗被阻止，提示用户手动打开
          alert('请手动打开书签：' + url);
        }
      } catch (e) {
        console.warn('Failed to open data URL:', e);
        alert('无法打开此类型的书签，请手动访问：' + url);
      }
    } else {
      // 普通URL，打开新标签页
      window.open(url, '_blank');
    }
    removeSearchBox();
  }
}

function onDocClick(e: MouseEvent) {
  if (searchBox && !searchBox.contains(e.target as Node)) {
    removeSearchBox();
  }
}

// 挂载异步 onInput
if (typeof window !== 'undefined') {
  (window as any).onInputAsync = onInput;
} 