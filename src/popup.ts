declare const chrome: any;

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
    showMsg("已上传书签数据");
  } else {
    showMsg("上传书签数据失败", true);
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
    showMsg("上传书签数据失败", true);
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
    (msg as HTMLElement).style.color = isError ? '#f44336' : '#42b983';
    setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
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
          msg.textContent = 'Gitee 配置已保存！';
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
  function fillSelectOptions(select: HTMLSelectElement, options: string[], placeholder = '请选择') {
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
    url += `?ref=${branch}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('获取文件失败');
    const data = await res.json();
    return Array.isArray(data) ? data.filter((f: any) => f.type === 'file').map((f: any) => f.path) : [];
  }
  async function fetchGiteeBranches(token: string, owner: string, repo: string): Promise<string[]> {
    const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/branches?access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('获取分支失败');
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
    fillSelectOptions(filePathSelect, [], '加载中...');
    try {
      const files = await fetchGiteeFiles(token, owner, repo, branch, dir);
      // 过滤掉 .keep 文件
      const filtered = files.filter((f: string) => !f.endsWith('.keep'));
      fillSelectOptions(filePathSelect, filtered, '请选择文件');
    } catch (e) {
      fillSelectOptions(filePathSelect, [], '获取文件失败');
    }
  }
  async function updateBranches() {
    const token = tokenEl.value.trim();
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    if (!token || !owner || !repo) return;
    if (token === lastToken && owner === lastOwner && repo === lastRepo) return;
    lastToken = token; lastOwner = owner; lastRepo = repo;
    fillSelectOptions(branchSel, [], '加载中...');
    try {
      const branches = await fetchGiteeBranches(token, owner, repo);
      fillSelectOptions(branchSel, branches, '请选择分支');
      // 默认选中 master 分支
      if (branches.includes('master')) {
        branchSel.value = 'master';
      } else if (branches.length > 0) {
        branchSel.value = branches[0];
      }
      // 触发文件列表刷新
      updateFilePathOptions();
    } catch (e) {
      fillSelectOptions(branchSel, [], '获取分支失败');
      fillSelectOptions(filePathSelect, [], '请先选择分支');
    }
    fillSelectOptions(filePathSelect, [], '请先选择分支');
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
    try {
      const config = await getGiteeConfig();
      const tree = await getLocalBookmarks();
      const content = tree[0]?.children || [];
      await modifyFile(config, content, true);
    } catch (e: any) {
      showMsg('覆盖保存失败: ' + e.message, true);
    }
  };

  document.getElementById('btnSaveMerge')!.onclick = async function() {
    try {
      const config = await getGiteeConfig();
      const tree = await getLocalBookmarks();
      const content = tree[0]?.children || [];
      await modifyFile(config, content, false);
    } catch (e: any) {
      showMsg('合并保存失败: ' + e.message, true);
    }
  };

  document.getElementById('btnGetOverwrite')!.onclick = async function() {
    try {
      const config = await getGiteeConfig();
      const arr = await getFile(config);
      await removeAllBookmarks();
      await createBookmarks(arr[0].children, '1'); // 只写入书签栏
      showMsg('覆盖获取并替换本地书签成功！');
    } catch (e: any) {
      showMsg('覆盖获取失败: ' + e.message, true);
    }
  };

  document.getElementById('btnGetMerge')!.onclick = async function() {
    try {
      const config = await getGiteeConfig();
      const arr = await getFile(config);
      console.log('arr', arr);
      const tree = await getLocalBookmarks();
      console.log('tree', tree);
      const local = tree[0]?.children || [];
      console.log('local', local);
      const merged = mergeBookmarks(local[0].children, arr[0].children);
      console.log('merged', merged);
      await removeAllBookmarks();
      await createBookmarks(merged, '1'); // 只写入书签栏
      showMsg('合并获取并替换本地书签成功！');
    } catch (e: any) {
      showMsg('合并获取失败: ' + e.message, true);
    }
  };

  // 新增书签文件
  document.getElementById('addBookmarkFile')!.onclick = async function() {
    const fileName = prompt('请输入书签文件名（如：bookmarks.json）：');
    if (!fileName) return;
    
    const token = tokenEl.value.trim();
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    const branch = branchSel.value;
    const dir = bookmarkDirInput.value.trim();
    
    if (!token || !owner || !repo || !branch || !dir) {
      showMsg('请先填写完整的配置信息', true);
      return;
    }
    
    try {
      const filePath = dir ? `${dir}/${fileName}` : fileName;
      const content = JSON.stringify([], null, 2); // 空的书签数组
      const encodedContent = btoa(unescape(encodeURIComponent(content)));
      
      const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}&access_token=${token}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          content: encodedContent,
          message: `新增书签文件：${fileName}`,
          branch: branch
        })
      });
      
      if (response.ok) {
        showMsg(`新增书签文件成功：${fileName}`);
        updateFilePathOptions(); // 刷新文件列表
      } else {
        showMsg('新增书签文件失败', true);
      }
    } catch (e: any) {
      showMsg('新增书签文件失败：' + e.message, true);
    }
  };
  
  // 删除书签文件
  document.getElementById('deleteBookmarkFile')!.onclick = async function() {
    const selectedFile = filePathSelect.value;
    if (!selectedFile) {
      showMsg('请先选择要删除的书签文件', true);
      return;
    }
    
    if (!confirm(`确定要删除书签文件：${selectedFile.split('/').pop()} 吗？`)) {
      return;
    }
    
    const token = tokenEl.value.trim();
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    const branch = branchSel.value;
    
    if (!token || !owner || !repo || !branch) {
      showMsg('请先填写完整的配置信息', true);
      return;
    }
    
    try {
      // 先获取文件信息（需要 sha）
      const getUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(selectedFile)}?ref=${branch}&access_token=${token}`;
      const getResponse = await fetch(getUrl);
      if (!getResponse.ok) {
        showMsg('获取文件信息失败', true);
        return;
      }
      const fileInfo = await getResponse.json();
      
      // 删除文件
      const deleteUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encodeURIComponent(selectedFile)}?ref=${branch}&access_token=${token}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          message: `删除书签文件：${selectedFile.split('/').pop()}`,
          sha: fileInfo.sha,
          branch: branch
        })
      });
      
      if (deleteResponse.ok) {
        showMsg(`删除书签文件成功：${selectedFile.split('/').pop()}`);
        updateFilePathOptions(); // 刷新文件列表
      } else {
        showMsg('删除书签文件失败', true);
      }
    } catch (e: any) {
      showMsg('删除书签文件失败：' + e.message, true);
    }
  };

  // 打开Gitee仓库
  document.getElementById('openGiteeRepo')!.onclick = function() {
    const owner = ownerEl.value.trim();
    const repo = repoEl.value.trim();
    const branch = branchSel.value;
    const file = filePathSelect.value;
    
    if (!owner || !repo) {
      showMsg('请先填写仓库所有者(owner)和仓库名(repo)', true);
      return;
    }
    
    if (!file) {
      showMsg('请先选择书签文件', true);
      return;
    }
    
    let url = `https://gitee.com/${owner}/${repo}/blob/${branch}/${file}`;
    
    window.open(url, '_blank');
  };

  // 保持原有 openTabBtn 逻辑
  const openTabBtn = document.getElementById('openTabBtn');
  if (openTabBtn) {
    openTabBtn.onclick = function() {
      if (chrome && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'chrome://bookmarks/' }, function() {
          if (chrome.runtime.lastError) {
            alert('无法自动打开书签管理器，请手动访问 chrome://bookmarks/');
          }
        });
      } else {
        alert('请手动打开 chrome://bookmarks/');
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
}); 
