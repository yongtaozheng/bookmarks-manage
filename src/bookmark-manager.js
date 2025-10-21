// 书签管理器类
class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.filteredBookmarks = [];
    this.currentFolder = null;
    this.searchInput = document.getElementById('searchInput');
    this.bookmarkTree = document.getElementById('bookmarkTree');
    this.folderTree = document.getElementById('folderTree');
    this.panelTitle = document.getElementById('panelTitle');
    this.showHidden = true; // 默认显示隐藏的书签（我的书签管理器显示所有书签）
    this.currentFilter = 'all'; // 当前筛选状态：all, visible, hidden
    this.giteeConfig = {
      owner: '',
      repo: '',
      token: '',
      branch: 'master',
      filePath: 'hidden-bookmarks.json'
    };
    
    this.init();
  }

  async init() {
    await this.loadConfigFromIndexedDB();
    await this.loadBookmarks();
    this.setupEventListeners();
    this.renderFolderTree();
    this.updateStats();
    // 设置默认筛选状态
    this.applyFilter('all');
    // 默认选择根目录（书签栏）
    this.selectRootFolder();
    // 重新渲染以确保隐藏书签显示
    this.renderBookmarks();
  }

  async loadBookmarks() {
    try {
      // 优先从Gitee仓库加载书签数据
      if (this.giteeConfig && this.giteeConfig.owner && this.giteeConfig.repo && this.giteeConfig.token) {
        try {
          const data = await this.loadBookmarksFromGitee();
          if (data && data.length > 0) {
            // 我的书签管理器显示所有书签（包括隐藏的），不进行过滤
            this.bookmarks = data;
            return;
          }
        } catch (error) {
        }
      }
      
      // 如果Gitee加载失败，使用本地Chrome书签
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const tree = await chrome.bookmarks.getTree();
        // 获取所有根节点的子节点，包括书签栏、其他书签等
        this.bookmarks = tree[0].children || [];
      } else {
        // 模拟数据用于测试
        this.bookmarks = [
          {
            id: '1',
            title: '示例文件夹',
            children: [
              {
                id: '2',
                title: 'Google',
                url: 'https://www.google.com'
              },
              {
                id: '3',
                title: 'GitHub',
                url: 'https://github.com'
              }
            ]
          }
        ];
      }
    } catch (error) {
      this.bookmarks = [];
    }
  }

  setupEventListeners() {
    this.searchInput.addEventListener('input', (e) => {
      this.filterBookmarks(e.target.value);
    });

    // 筛选选择器事件监听
    document.getElementById('filterSelect').addEventListener('change', (e) => {
      this.applyFilter(e.target.value);
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadBookmarks().then(() => {
        // 重新渲染文件夹树
        this.renderFolderTree();
        // 重新渲染当前文件夹内容
        this.renderBookmarks();
        // 更新统计信息
        this.updateStats();
      });
    });

    document.getElementById('addBookmarkBtn').addEventListener('click', () => {
      this.addBookmark();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportBookmarks();
    });



    // 配置对话框事件
    document.getElementById('configBtn').addEventListener('click', () => {
      this.showConfigModal();
    });

    document.getElementById('closeConfigModal').addEventListener('click', () => {
      this.hideConfigModal();
    });

    document.getElementById('cancelConfigBtn').addEventListener('click', () => {
      this.hideConfigModal();
    });

    document.getElementById('saveConfigBtn').addEventListener('click', () => {
      this.saveConfig();
    });

    // 使用事件委托处理文件夹树的事件
    this.folderTree.addEventListener('click', (e) => {
      const target = e.target;
      
      // 处理文件夹切换
      if (target.classList.contains('folder-toggle')) {
        const children = target.parentElement.nextElementSibling;
        if (children) {
          children.style.display = children.style.display === 'none' ? 'block' : 'none';
          target.textContent = target.textContent === '▼' ? '▶' : '▼';
        }
      }
      
      // 处理文件夹选择
      if (target.classList.contains('folder-item') || target.closest('.folder-item')) {
        const folderItem = target.classList.contains('folder-item') ? target : target.closest('.folder-item');
        const folderId = folderItem.getAttribute('data-folder-id');
        if (folderId) {
          this.selectFolder(folderId);
        }
      }
    });

    // 使用事件委托处理书签项目的事件
    this.bookmarkTree.addEventListener('click', (e) => {
      const target = e.target;
      
      // 处理编辑按钮
      if (target.classList.contains('action-btn-edit')) {
        e.stopPropagation(); // 阻止事件冒泡
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          this.editBookmark(bookmarkId);
        }
        return;
      }
      
      // 处理隐藏/显示按钮
      if (target.classList.contains('action-btn-hide')) {
        e.stopPropagation(); // 阻止事件冒泡
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          this.toggleBookmarkVisibility(bookmarkId);
        }
        return;
      }
      
      // 处理删除按钮
      if (target.classList.contains('action-btn-delete')) {
        e.stopPropagation(); // 阻止事件冒泡
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          this.deleteBookmark(bookmarkId);
        }
        return;
      }
      
      // 处理脚本书签点击
      if (target.classList.contains('script-bookmark') || target.closest('.script-bookmark')) {
        e.stopPropagation();
        const scriptElement = target.classList.contains('script-bookmark') ? target : target.closest('.script-bookmark');
        const scriptUrl = decodeURIComponent(scriptElement.getAttribute('data-script-url'));
        this.executeScript(scriptUrl);
        return;
      }
      
      // 处理文件夹点击（只有在没有点击按钮时才触发）
      if (target.classList.contains('folder-item') || target.closest('.folder-item')) {
        const folderItem = target.classList.contains('folder-item') ? target : target.closest('.folder-item');
        const folderId = folderItem.getAttribute('data-folder-id');
        if (folderId) {
          this.selectFolder(folderId);
          // 同步左侧选中状态
          this.syncLeftSidebarSelection(folderId);
        }
      }
    });
  }

  filterBookmarks(searchTerm) {
    // 搜索功能现在直接在renderBookmarks中处理
    this.renderBookmarks();
  }

  applyFilter(filterType) {
    this.currentFilter = filterType;
    
    // 根据筛选类型过滤书签
    switch (filterType) {
      case 'all':
        this.filteredBookmarks = this.bookmarks;
        break;
      case 'visible':
        this.filteredBookmarks = this.filterVisibleBookmarks(this.bookmarks);
        break;
      case 'hidden':
        this.filteredBookmarks = this.filterHiddenOnlyBookmarks(this.bookmarks);
        break;
    }
    
    // 重新渲染左侧目录树（在"只显示隐藏"模式下会过滤空目录）
    this.renderFolderTree();
    this.renderBookmarks();
    this.updateStats();
  }

  searchInBookmarks(bookmarks, searchTerm) {
    const results = [];
    
    for (const bookmark of bookmarks) {
      if (bookmark.children) {
        // 文件夹
        const matchingChildren = this.searchInBookmarks(bookmark.children, searchTerm);
        if (matchingChildren.length > 0) {
          results.push({
            ...bookmark,
            children: matchingChildren
          });
        }
      } else if (bookmark.url) {
        // 书签
        if (bookmark.title.toLowerCase().includes(searchTerm) || 
            bookmark.url.toLowerCase().includes(searchTerm)) {
          results.push(bookmark);
        }
      }
    }
    
    return results;
  }

  renderFolderTree() {
    const folders = this.getFolders(this.bookmarks);
    this.folderTree.innerHTML = this.renderFolderList(folders);
  }

  getFolders(bookmarks) {
    const folders = [];
    for (const bookmark of bookmarks) {
      if (bookmark.children) {
        const childFolders = this.getFolders(bookmark.children);
        
        // 根据当前筛选模式过滤目录
        if (this.currentFilter === 'hidden') {
          // 在"只显示隐藏"模式下，只显示包含隐藏内容的目录
          const hasHiddenContent = bookmark.hidden || this.hasHiddenContent(bookmark.children);
          if (!hasHiddenContent) {
            continue; // 跳过没有隐藏内容的目录
          }
        } else if (this.currentFilter === 'visible') {
          // 在"只显示可见"模式下，过滤掉隐藏的目录
          if (bookmark.hidden) {
            continue; // 跳过隐藏的目录
          }
        }
        
        folders.push({
          id: bookmark.id,
          title: bookmark.title,
          hidden: bookmark.hidden || false,
          children: childFolders
        });
      }
    }
    return folders;
  }

  // 检查目录是否包含隐藏内容
  hasHiddenContent(children) {
    for (const child of children) {
      if (child.hidden) {
        return true; // 直接包含隐藏项
      }
      if (child.children && this.hasHiddenContent(child.children)) {
        return true; // 子目录包含隐藏项
      }
    }
    return false;
  }

  // 获取网页的favicon URL
  getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      // 尝试多种favicon URL格式
      const faviconUrls = [
        `https://www.google.com/s2/favicons?domain=${domain}&sz=16`,
        `https://favicons.githubusercontent.com/${domain}`,
        `https://${domain}/favicon.ico`,
        `https://${domain}/favicon.png`,
        `https://${domain}/apple-touch-icon.png`
      ];
      
      // 返回第一个URL（Google的favicon服务通常最可靠）
      return faviconUrls[0];
    } catch (error) {
      // 如果URL解析失败，返回默认图标
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=';
    }
  }


  // 执行脚本书签
  executeScript(scriptUrl) {
    if (scriptUrl.startsWith('javascript:')) {
      const script = scriptUrl.substring(11);
      try {
        // 在新窗口中执行脚本
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>脚本执行</title></head>
              <body>
                <h3>脚本执行结果：</h3>
                <div id="result"></div>
                <script>
                  try {
                    const result = ${script};
                    document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                  } catch (error) {
                    document.getElementById('result').innerHTML = '<p style="color: red;">执行错误: ' + error.message + '</p>';
                  }
                </script>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      } catch (error) {
        alert('脚本执行失败: ' + error.message);
      }
    } else if (scriptUrl.startsWith('data:')) {
      // 对于data URL，直接打开
      window.open(scriptUrl, '_blank');
    }
  }

  renderFolderList(folders, level = 0) {
    let html = '';
    for (const folder of folders) {
      const isHidden = folder.hidden || false;
      const hiddenIcon = isHidden ? '👁️‍🗨️' : '';
      const hiddenClass = isHidden ? ' hidden-folder' : '';
      
      html += `
        <div class="folder-item${hiddenClass}" data-folder-id="${folder.id}" style="padding-left: ${16 + level * 16}px;">
          <div class="folder-toggle">▼</div>
          <div class="folder-icon">📁</div>
          <div class="folder-name">${folder.title} ${hiddenIcon}</div>
        </div>
        ${folder.children.length > 0 ? `
          <div class="folder-children" style="display: block;">
            ${this.renderFolderList(folder.children, level + 1)}
          </div>
        ` : ''}
      `;
    }
    return html;
  }

  selectRootFolder() {
    // 查找书签栏（通常是第一个根节点）
    const bookmarkBar = this.bookmarks.find(bookmark => 
      bookmark.title === '书签栏' || bookmark.title === 'Bookmarks bar'
    );
    
    if (bookmarkBar) {
      this.selectFolder(bookmarkBar.id);
    } else if (this.bookmarks.length > 0) {
      // 如果没有找到书签栏，选择第一个根节点
      this.selectFolder(this.bookmarks[0].id);
    }
  }

  selectFolder(folderId) {
    // 移除所有活动状态
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // 设置当前选中的文件夹
    const selectedItem = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }
    
    // 找到选中的文件夹
    const folder = this.findFolderById(this.bookmarks, folderId);
    if (folder) {
      this.currentFolder = folder;
      this.panelTitle.textContent = folder.title;
      this.renderBookmarks();
    }
  }

  syncLeftSidebarSelection(folderId) {
    // 同步左侧侧边栏的选中状态
    document.querySelectorAll('.sidebar .folder-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const leftSidebarItem = document.querySelector(`.sidebar [data-folder-id="${folderId}"]`);
    if (leftSidebarItem) {
      leftSidebarItem.classList.add('active');
      // 确保父级文件夹是展开的
      this.ensureParentFoldersExpanded(leftSidebarItem);
    }
  }

  ensureParentFoldersExpanded(element) {
    // 确保所有父级文件夹都是展开状态
    let parent = element.parentElement;
    while (parent && parent !== this.folderTree) {
      if (parent.classList.contains('folder-children')) {
        parent.style.display = 'block';
        const toggle = parent.previousElementSibling?.querySelector('.folder-toggle');
        if (toggle) {
          toggle.textContent = '▼';
        }
      }
      parent = parent.parentElement;
    }
  }

  findFolderById(bookmarks, id) {
    for (const bookmark of bookmarks) {
      if (bookmark.id === id) {
        return bookmark;
      }
      if (bookmark.children) {
        const found = this.findFolderById(bookmark.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  renderBookmarks() {
    if (!this.currentFolder) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>选择一个文件夹</h3>
          <p>从左侧选择一个文件夹来查看其中的书签</p>
        </div>
      `;
      return;
    }

    // 重新查找当前文件夹，因为数据可能已经更新
    const folder = this.findFolderById(this.bookmarks, this.currentFolder.id);
    if (!folder) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>文件夹不存在</h3>
          <p>此文件夹可能已被删除</p>
        </div>
      `;
      return;
    }

    // 更新当前文件夹为最新数据
    this.currentFolder = folder;
    const bookmarks = this.currentFolder.children || [];
    
    
    if (bookmarks.length === 0) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>文件夹为空</h3>
          <p>此文件夹中没有书签</p>
        </div>
      `;
      return;
    }

    // 根据当前筛选状态过滤书签
    let filteredBookmarks = bookmarks;
    switch (this.currentFilter) {
      case 'visible':
        filteredBookmarks = this.filterVisibleBookmarks(bookmarks);
        break;
      case 'hidden':
        filteredBookmarks = this.filterHiddenOnlyBookmarks(bookmarks);
        break;
      case 'all':
      default:
        filteredBookmarks = bookmarks;
        break;
    }
    
    // 如果有搜索条件，应用搜索过滤
    const searchTerm = this.searchInput.value.trim();
    if (searchTerm) {
      filteredBookmarks = this.searchInBookmarks(filteredBookmarks, searchTerm.toLowerCase());
    }
    
    
    if (filteredBookmarks.length === 0) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>没有匹配的书签</h3>
          <p>当前筛选条件下没有找到书签</p>
        </div>
      `;
      return;
    }

    this.bookmarkTree.innerHTML = this.renderBookmarkList(filteredBookmarks);
  }

  renderBookmarkList(bookmarks) {
    let html = '';
    
    // 渲染传入的书签（已经过筛选）
    for (const bookmark of bookmarks) {
      // 直接使用书签数据中的hidden属性
      const isHidden = bookmark.hidden || false;
      
      if (bookmark.url) {
        // 书签
        const hiddenClass = isHidden ? ' hidden-bookmark' : '';
        const hiddenIcon = isHidden ? '👁️‍🗨️' : '';
        
        // 检测是否为脚本书签
        const isJavaScript = bookmark.url.startsWith('javascript:');
        const isDataUrl = bookmark.url.startsWith('data:');
        
        let faviconUrl, displayUrl, clickHandler;
        
        if (isJavaScript || isDataUrl) {
          // 脚本书签特殊处理
          faviconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=';
          displayUrl = '脚本书签';
          clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
        } else {
          // 普通书签
          faviconUrl = this.getFaviconUrl(bookmark.url);
          displayUrl = bookmark.url;
          clickHandler = `href="${bookmark.url}" target="_blank"`;
        }
        
        html += `
          <div class="bookmark-item${hiddenClass}">
            <img class="bookmark-icon" src="${faviconUrl}" alt="书签" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${bookmark.title} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">编辑</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? '显示' : '隐藏'}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">删除</button>
              </div>
            </div>
          </div>
        `;
      } else if (bookmark.children) {
        // 子文件夹
        const hiddenClass = isHidden ? ' hidden-bookmark' : '';
        const hiddenIcon = isHidden ? '👁️‍🗨️' : '';
        html += `
          <div class="bookmark-item folder-item${hiddenClass}" data-folder-id="${bookmark.id}">
            <div class="folder-icon">📁</div>
            <div class="bookmark-content">
              <div class="bookmark-title">${bookmark.title} ${hiddenIcon}</div>
              <div class="bookmark-url">文件夹 (${bookmark.children.length} 项)</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">编辑</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? '显示' : '隐藏'}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">删除</button>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    return html;
  }


  updateStats() {
    const stats = this.calculateStats(this.bookmarks);
    document.getElementById('totalBookmarks').textContent = stats.totalBookmarks;
    document.getElementById('totalFolders').textContent = stats.totalFolders;
    document.getElementById('recentBookmarks').textContent = stats.recentBookmarks;
  }

  calculateStats(bookmarks) {
    let totalBookmarks = 0;
    let totalFolders = 0;
    let recentBookmarks = 0;
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const traverse = (items) => {
      for (const item of items) {
        if (item.children) {
          totalFolders++;
          traverse(item.children);
        } else if (item.url) {
          totalBookmarks++;
          if (item.dateAdded && item.dateAdded > oneWeekAgo) {
            recentBookmarks++;
          }
        }
      }
    };

    traverse(bookmarks);
    return { totalBookmarks, totalFolders, recentBookmarks };
  }

  addBookmark() {
    const title = prompt('请输入书签标题:');
    if (!title) return;
    
    const url = prompt('请输入书签URL:');
    if (!url) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        chrome.bookmarks.create({
          title: title,
          url: url
        }, () => {
          // 重新加载所有书签数据
          this.loadBookmarks().then(() => {
            // 重新渲染文件夹树
            this.renderFolderTree();
            // 重新渲染当前文件夹内容
            this.renderBookmarks();
            // 更新统计信息
            this.updateStats();
          });
        });
      } else {
        alert('书签添加功能需要浏览器扩展环境');
      }
    } catch (error) {
      alert('添加书签失败');
    }
  }

  editBookmark(id) {
    // 实现编辑书签功能
    alert('编辑功能待实现');
  }

  deleteBookmark(id) {
    if (confirm('确定要删除这个书签吗？')) {
      try {
        if (typeof chrome !== 'undefined' && chrome.bookmarks) {
          chrome.bookmarks.remove(id, () => {
            // 重新加载所有书签数据
            this.loadBookmarks().then(() => {
              // 重新渲染文件夹树
              this.renderFolderTree();
              // 重新渲染当前文件夹内容
              this.renderBookmarks();
              // 更新统计信息
              this.updateStats();
            });
          });
        } else {
          alert('书签删除功能需要浏览器扩展环境');
        }
      } catch (error) {
        alert('删除书签失败');
      }
    }
  }

  exportBookmarks() {
    const dataStr = JSON.stringify(this.bookmarks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookmarks.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  findBookmarkById(bookmarkId) {
    // 递归查找书签
    const findInBookmarks = (bookmarks) => {
      for (const bookmark of bookmarks) {
        if (bookmark.id === bookmarkId) {
          return bookmark;
        }
        if (bookmark.children) {
          const found = findInBookmarks(bookmark.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findInBookmarks(this.bookmarks);
  }

  toggleBookmarkVisibility(bookmarkId) {
    
    // 查找当前书签
    const bookmark = this.findBookmarkById(bookmarkId);
    if (bookmark) {
      
      // 直接修改书签的hidden属性
      bookmark.hidden = !bookmark.hidden;
      
      // 如果是目录，递归处理所有子项
      if (bookmark.children && bookmark.children.length > 0) {
        this.toggleFolderVisibility(bookmark, bookmark.hidden);
      }
      
      // 保存到Gitee仓库
      this.saveBookmarkTreeToGitee(this.bookmarks);
      
      // 更新系统书签（过滤掉隐藏的书签）
      this.updateSystemBookmarks();
      
      // 重新渲染左侧目录树（同步隐藏状态）
      this.renderFolderTree();
      
      // 重新渲染当前文件夹
      this.renderBookmarks();
      
      // 更新统计信息
      this.updateStats();
    } else {
    }
  }

  // 递归处理目录的隐藏/显示
  toggleFolderVisibility(folder, isHidden) {
    
    // 设置目录本身的隐藏状态
    folder.hidden = isHidden;
    
    // 递归处理所有子项
    if (folder.children && folder.children.length > 0) {
      for (const child of folder.children) {
        child.hidden = isHidden;
        
        // 如果子项也是目录，递归处理
        if (child.children && child.children.length > 0) {
          this.toggleFolderVisibility(child, isHidden);
        }
      }
    }
  }

  updateSystemBookmarks() {
    // 更新系统书签，过滤掉隐藏的书签（系统书签栏不显示隐藏书签）
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      
      // 过滤掉隐藏的书签，系统书签栏只显示可见的书签
      const visibleBookmarks = this.filterVisibleBookmarks(this.bookmarks[0].children);
      
      // 先清空所有书签，然后重新创建可见的书签
      this.removeAllBookmarks().then(() => {
        // 重新创建可见的书签到系统书签栏
        this.createBookmarks(visibleBookmarks, '1').then(() => {
        });
      }).catch(error => {
      });
    }
  }

  removeAllBookmarks() {
    return new Promise((resolve) => {
      chrome.bookmarks.getTree((nodes) => {
        const rootChildren = nodes[0]?.children || [];
        let toDelete = [];
        rootChildren.forEach((node) => {
          // 只删除根目录下的子节点（即书签栏、其他书签、移动设备书签的 children）
          if (node.children && node.children.length) {
            node.children.forEach((child) => toDelete.push(child.id));
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

  filterVisibleBookmarks(bookmarks) {
    // 递归过滤掉隐藏的书签，参考popup页面的数据结构处理
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
        const filteredChildren = this.filterVisibleBookmarks(bookmark.children);
        // 如果文件夹被隐藏，但子项可能可见，保留文件夹但只显示可见的子项
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

  createBookmarks(nodes, parentId = '1') {
    // 参考popup页面的createBookmarks实现
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return Promise.resolve();
    }
    
    
    return Promise.all(nodes.map(node => {
      if (!node) {
        return Promise.resolve();
      }
      
      if (node.url) {
        // 创建书签
        return new Promise(res => {
          chrome.bookmarks.create({ 
            parentId, 
            title: node.title, 
            url: node.url 
          }, (bookmark) => {
            if (chrome.runtime.lastError) {
            } else {
            }
            res(undefined);
          });
        });
      } else {
        // 创建文件夹
        return new Promise(res => {
          chrome.bookmarks.create({ 
            parentId, 
            title: node.title 
          }, (folder) => {
            if (chrome.runtime.lastError) {
              res(undefined);
            } else {
              if (node.children && node.children.length > 0) {
                this.createBookmarks(node.children, folder.id).then(() => res(undefined));
              } else {
                res(undefined);
              }
            }
          });
        });
      }
    })).then(() => {
    });
  }


  loadBookmarksFromGitee() {
    return new Promise((resolve, reject) => {
      if (!this.giteeConfig || !this.giteeConfig.owner || !this.giteeConfig.repo || !this.giteeConfig.token) {
        reject(new Error('Gitee配置不完整'));
        return;
      }

      const url = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}`;
      
      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `token ${this.giteeConfig.token}`
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.content) {
          const content = decodeURIComponent(escape(atob(data.content)));
          const bookmarks = JSON.parse(content);
          resolve(bookmarks);
        } else {
          reject(new Error('无法获取文件内容'));
        }
      })
      .catch(error => {
        reject(error);
      });
    });
  }

  filterHiddenBookmarks(bookmarks) {
    // 递归过滤掉隐藏的书签
    const filterBookmarks = (items) => {
      return items.filter(item => {
        if (item.hidden) {
          return false; // 过滤掉隐藏的书签
        }
        
        if (item.children) {
          item.children = filterBookmarks(item.children);
        }
        
        return true;
      });
    };
    
    return filterBookmarks(bookmarks);
  }

  filterVisibleBookmarks(bookmarks) {
    // 递归过滤，只显示可见的书签（不修改原始数据）
    const filterBookmarks = (items) => {
      return items.filter(item => {
        if (item.hidden) {
          return false; // 过滤掉隐藏的书签
        }
        
        if (item.children) {
          const filteredChildren = filterBookmarks(item.children);
          if (filteredChildren.length > 0) {
            // 创建新对象，不修改原始数据
            return {
              ...item,
              children: filteredChildren
            };
          } else {
            return false; // 如果文件夹下没有可见内容，也不显示
          }
        }
        
        return true;
      });
    };
    
    return filterBookmarks(bookmarks);
  }

  filterHiddenOnlyBookmarks(bookmarks) {
    // 递归过滤，只显示隐藏的书签和包含隐藏内容的目录（不修改原始数据）
    const filterBookmarks = (items) => {
      return items.filter(item => {
        if (item.hidden) {
          return true; // 显示隐藏的书签
        }
        
        if (item.children && item.children.length > 0) {
          // 递归过滤子项
          const filteredChildren = filterBookmarks(item.children);
          
          // 如果目录本身是隐藏的，或者包含隐藏的子项，则显示
          if (item.hidden || filteredChildren.length > 0) {
            // 创建新对象，不修改原始数据
            return {
              ...item,
              children: filteredChildren
            };
          } else {
            return false; // 目录不隐藏且没有隐藏的子项，不显示
          }
        }
        
        return false; // 过滤掉可见的书签
      });
    };
    
    return filterBookmarks(bookmarks);
  }

  saveBookmarkTreeToGitee(bookmarks) {
    if (!this.giteeConfig || !this.giteeConfig.owner || !this.giteeConfig.repo || !this.giteeConfig.token) {
      return;
    }

    const content = JSON.stringify(bookmarks, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));
    
    // 获取文件SHA
    this.getFileSha().then(sha => {
      const url = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}`;
      
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${this.giteeConfig.token}`
        },
        body: JSON.stringify({
          message: '更新书签树 - 隐藏属性',
          content: encodedContent,
          sha: sha
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.content) {
        } else {
        }
      })
      .catch(error => {
      });
    });
  }




  // IndexedDB 相关方法
  async openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('bookmarks-plus', 1);
      req.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('gitee-config')) {
          db.createObjectStore('gitee-config');
        }
      };
      req.onsuccess = function(e) {
        resolve(e.target.result);
      };
      req.onerror = function(e) {
        reject(e);
      };
    });
  }

  async getConfigFromIndexedDB(fields) {
    const db = await this.openDB();
    return new Promise(resolve => {
      const tx = db.transaction('gitee-config', 'readonly');
      const store = tx.objectStore('gitee-config');
      const result = {};
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
  }

  async setConfigToIndexedDB(config) {
    const db = await this.openDB();
    const tx = db.transaction('gitee-config', 'readwrite');
    const store = tx.objectStore('gitee-config');
    Object.entries(config).forEach(([k, v]) => store.put(v, k));
    return new Promise(resolve => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async loadConfigFromIndexedDB() {
    const fields = ['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath'];
    const data = await this.getConfigFromIndexedDB(fields);
    this.giteeConfig.owner = data.giteeOwner || '';
    this.giteeConfig.repo = data.giteeRepo || '';
    this.giteeConfig.token = data.giteeToken || '';
    this.giteeConfig.branch = data.giteeBranch || 'master';
    this.giteeConfig.filePath = data.giteeFilePath || 'hidden-bookmarks.json';
  }


  async getFileSha() {
    try {
      const apiUrl = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}?ref=${this.giteeConfig.branch}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${this.giteeConfig.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.sha;
      }
    } catch (error) {
    }
    return null;
  }

  // 配置对话框相关方法
  showConfigModal() {
    const modal = document.getElementById('configModal');
    modal.style.display = 'flex';
    
    // 加载当前配置
    document.getElementById('giteeOwner').value = this.giteeConfig.owner;
    document.getElementById('giteeRepo').value = this.giteeConfig.repo;
    document.getElementById('giteeToken').value = this.giteeConfig.token;
  }

  hideConfigModal() {
    const modal = document.getElementById('configModal');
    modal.style.display = 'none';
  }

  async saveConfig() {
    const owner = document.getElementById('giteeOwner').value.trim();
    const repo = document.getElementById('giteeRepo').value.trim();
    const token = document.getElementById('giteeToken').value.trim();
    
    if (!owner || !repo || !token) {
      alert('请填写完整的配置信息');
      return;
    }
    
    // 更新配置
    this.giteeConfig.owner = owner;
    this.giteeConfig.repo = repo;
    this.giteeConfig.token = token;
    
    // 保存到IndexedDB
    try {
      await this.setConfigToIndexedDB({
        giteeOwner: owner,
        giteeRepo: repo,
        giteeToken: token,
        giteeBranch: this.giteeConfig.branch,
        giteeFilePath: this.giteeConfig.filePath
      });
    } catch (error) {
    }
    
    this.hideConfigModal();
    alert('配置已保存！');
  }


}

// 初始化书签管理器
document.addEventListener('DOMContentLoaded', () => {
  window.bookmarkManager = new BookmarkManager();
});
