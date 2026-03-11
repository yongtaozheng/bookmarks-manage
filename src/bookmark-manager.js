import { encrypt, decryptSafe } from './crypto';
import { initLocale, t as _t, translateDOM, getLocale, setLocale } from './i18n/index';
import { initTheme, setupThemeToggle } from './theme';

// i18n 辅助函数（直接使用 i18n 模块的翻译函数）
const t = (key, ...args) => _t(key, ...args);

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
    this.backButton = document.getElementById('backButton');
    this.showHidden = true; // 默认显示隐藏的书签（我的书签管理器显示所有书签）
    this.currentFilter = 'all'; // 当前筛选状态：all, visible, hidden
    this.draggedElement = null; // 当前被拖动的元素
    this.dragOverElement = null; // 当前拖拽悬停的元素
    this.pendingImportData = null; // 待导入的书签数据
    this.currentDuplicateGroups = []; // 当前重复检测结果
    this.linkCheckResults = []; // 失效链接检测结果
    this.linkCheckRunning = false; // 是否正在检测
    this.linkCheckCurrentFilter = 'all'; // 当前筛选状态
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
            this.saveBookmarksToStorage();
            return;
          }
        } catch (error) {
        }
      }

      // 如果Gitee加载失败，使用本地Chrome书签
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const tree = await chrome.bookmarks.getTree();
        // 获取所有根节点的子节点，包括书签栏、其他书签等
        const chromeBookmarks = tree[0].children || [];

        // 尝试从storage恢复隐藏状态
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const storedData = await this.loadBookmarksFromStorage();
          if (storedData && storedData.length > 0) {
            // 验证存储的数据是否仍然有效
            if (this.validateStoredBookmarks(storedData, chromeBookmarks)) {
              // 存储的数据有效，使用存储的数据（包含隐藏属性）
              this.bookmarks = storedData;
              return;
            } else {
              // 存储的数据无效，合并隐藏状态到Chrome书签数据
              this.bookmarks = this.mergeHiddenState(chromeBookmarks, storedData);
            }
          } else {
            this.bookmarks = chromeBookmarks;
          }
        } else {
          this.bookmarks = chromeBookmarks;
        }

        this.saveBookmarksToStorage();
      } else {
        // 模拟数据用于测试
        this.bookmarks = [
          {
            id: '1',
            title: t('manager.sampleFolder'),
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
        this.saveBookmarksToStorage();
      }
    } catch (error) {
      this.bookmarks = [];
    }
  }

  // 从storage加载书签数据
  loadBookmarksFromStorage() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['bookmarkManagerData'], (result) => {
          resolve(result.bookmarkManagerData || null);
        });
      } else {
        resolve(null);
      }
    });
  }

  // 验证存储的书签数据是否仍然有效
  validateStoredBookmarks(storedData, chromeBookmarks) {
    // 创建Chrome书签ID映射
    const chromeIds = new Set();
    const collectIds = (bookmarks) => {
      bookmarks.forEach(bookmark => {
        chromeIds.add(bookmark.id);
        if (bookmark.children) {
          collectIds(bookmark.children);
        }
      });
    };
    collectIds(chromeBookmarks);

    // 检查存储的数据中的ID是否都存在于Chrome书签中
    const checkIds = (bookmarks) => {
      for (const bookmark of bookmarks) {
        if (!chromeIds.has(bookmark.id)) {
          return false;
        }
        if (bookmark.children) {
          if (!checkIds(bookmark.children)) {
            return false;
          }
        }
      }
      return true;
    };

    return checkIds(storedData);
  }

  // 合并隐藏状态到Chrome书签数据
  mergeHiddenState(chromeBookmarks, storedData) {
    // 创建存储数据的ID到隐藏状态的映射
    const hiddenStateMap = new Map();
    const collectHiddenState = (bookmarks) => {
      bookmarks.forEach(bookmark => {
        if (bookmark.hidden !== undefined) {
          hiddenStateMap.set(bookmark.id, bookmark.hidden);
        }
        if (bookmark.children) {
          collectHiddenState(bookmark.children);
        }
      });
    };
    collectHiddenState(storedData);

    // 递归合并隐藏状态到Chrome书签数据
    const mergeRecursive = (chromeItems) => {
      return chromeItems.map(item => {
        const merged = { ...item };

        // 恢复隐藏状态
        if (hiddenStateMap.has(item.id)) {
          merged.hidden = hiddenStateMap.get(item.id);
        }

        // 递归处理子项
        if (item.children && item.children.length > 0) {
          merged.children = mergeRecursive(item.children);
        }

        return merged;
      });
    };

    return mergeRecursive(chromeBookmarks);
  }

  // 保存书签数据到storage，供popup使用
  saveBookmarksToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ 'bookmarkManagerData': this.bookmarks }, () => {
        // 数据已保存
      });
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

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportBookmarks();
    });

    // 导入按钮事件
    document.getElementById('importBtn').addEventListener('click', () => {
      this.triggerImport();
    });

    // 导入文件选择事件
    document.getElementById('importFileInput').addEventListener('change', (e) => {
      this.handleImportFile(e);
    });

    // 导入对话框事件
    document.getElementById('closeImportModal').addEventListener('click', () => {
      this.hideImportModal();
    });

    document.getElementById('cancelImportBtn').addEventListener('click', () => {
      this.hideImportModal();
    });

    document.getElementById('confirmImportBtn').addEventListener('click', () => {
      this.confirmImport();
    });

    // 重复检测对话框事件
    document.getElementById('detectDuplicatesBtn').addEventListener('click', () => {
      this.showDuplicateModal();
    });

    document.getElementById('closeDuplicateModal').addEventListener('click', () => {
      this.hideDuplicateModal();
    });

    document.getElementById('cancelDuplicateBtn').addEventListener('click', () => {
      this.hideDuplicateModal();
    });

    document.getElementById('deleteDuplicatesBtn').addEventListener('click', () => {
      this.deleteSelectedDuplicates();
    });

    document.getElementById('duplicateSelectAllBtn').addEventListener('click', () => {
      this.toggleAllDuplicateCheckboxes(true);
    });

    document.getElementById('duplicateDeselectAllBtn').addEventListener('click', () => {
      this.toggleAllDuplicateCheckboxes(false);
    });

    // 检测模式切换
    document.querySelectorAll('input[name="duplicateMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.runDuplicateDetection();
      });
    });

    document.getElementById('stripQueryParam').addEventListener('change', () => {
      this.runDuplicateDetection();
    });

    // 失效链接检测对话框事件
    document.getElementById('linkCheckBtn').addEventListener('click', () => {
      this.showLinkCheckModal();
    });

    document.getElementById('closeLinkCheckModal').addEventListener('click', () => {
      this.hideLinkCheckModal();
    });

    document.getElementById('cancelLinkCheckBtn').addEventListener('click', () => {
      this.hideLinkCheckModal();
    });

    document.getElementById('linkCheckStartBtn').addEventListener('click', () => {
      this.startLinkCheck();
    });

    document.getElementById('linkCheckStopBtn').addEventListener('click', () => {
      this.stopLinkCheck();
    });

    document.getElementById('linkCheckFilter').addEventListener('change', (e) => {
      this.linkCheckCurrentFilter = e.target.value;
      this.renderLinkCheckResults();
    });

    document.getElementById('linkCheckSelectAllBrokenBtn').addEventListener('click', () => {
      this.toggleLinkCheckCheckboxes('broken');
    });

    document.getElementById('linkCheckDeselectAllBtn').addEventListener('click', () => {
      this.toggleLinkCheckCheckboxes('none');
    });

    document.getElementById('deleteBrokenLinksBtn').addEventListener('click', () => {
      this.deleteSelectedBrokenLinks();
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

    // 编辑对话框事件
    document.getElementById('closeEditModal').addEventListener('click', () => {
      this.hideEditModal();
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      this.hideEditModal();
    });

    document.getElementById('saveEditBtn').addEventListener('click', () => {
      this.saveEditBookmark();
    });

    // 编辑对话框中按Enter键保存
    document.getElementById('editBookmarkTitle').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveEditBookmark();
      }
    });

    document.getElementById('editBookmarkUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.saveEditBookmark();
      }
    });

    // 返回按钮事件监听
    this.backButton.addEventListener('click', (e) => {
      e.preventDefault();
      const parentId = this.backButton.getAttribute('data-parent-id');
      if (parentId) {
        this.selectFolder(parentId);
        // 同步左侧选中状态
        this.syncLeftSidebarSelection(parentId);
      }
    });

    // 拖动排序事件监听
    this.setupDragAndDrop();

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

      // 如果点击的是拖动句柄，不处理其他事件
      if (target.classList.contains('drag-handle')) {
        return;
      }

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
      if ((target.classList.contains('folder-item') || target.closest('.folder-item')) &&
          !target.classList.contains('drag-handle')) {
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

  setupDragAndDrop() {
    // 使用事件委托处理拖动事件
    this.bookmarkTree.addEventListener('dragstart', (e) => {
      const bookmarkItem = e.target.closest('.bookmark-item');
      if (bookmarkItem) {
        // 重置所有拖动状态
        this.resetDragState();

        this.draggedElement = bookmarkItem;
        bookmarkItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', bookmarkItem.outerHTML);
      }
    });

    this.bookmarkTree.addEventListener('dragend', (e) => {
      const bookmarkItem = e.target.closest('.bookmark-item');
      if (bookmarkItem) {
        bookmarkItem.classList.remove('dragging');
        // 清理拖动状态（拖拽可能被取消）
        this.draggedElement = null;
        this.dragOverElement = null;
        this.clearDragOverClasses();
      }
    });

    this.bookmarkTree.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const draggedOver = e.target.closest('.bookmark-item');
      if (draggedOver && draggedOver !== this.draggedElement) {
        this.clearDragOverClasses();
        this.dragOverElement = draggedOver;

        const rect = draggedOver.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
          draggedOver.classList.add('drag-over');
        } else {
          draggedOver.classList.add('drag-over-bottom');
        }
      }
    });

    this.bookmarkTree.addEventListener('dragleave', (e) => {
      if (!e.target.closest('.bookmark-item')) {
        this.clearDragOverClasses();
      }
    });

    this.bookmarkTree.addEventListener('drop', (e) => {
      e.preventDefault();

      if (this.draggedElement && this.dragOverElement) {
        this.handleDrop(this.draggedElement, this.dragOverElement, e);
      }

      // 清理所有拖动状态
      this.draggedElement = null;
      this.dragOverElement = null;
      this.clearDragOverClasses();
    });
  }

  resetDragState() {
    // 清理所有拖动相关的状态和样式
    this.draggedElement = null;
    this.dragOverElement = null;
    this.clearDragOverClasses();

    // 清理所有可能的拖动样式
    const elements = this.bookmarkTree.querySelectorAll('.bookmark-item');
    elements.forEach(el => {
      el.classList.remove('dragging', 'drag-over', 'drag-over-bottom');
    });
  }

  clearDragOverClasses() {
    const elements = this.bookmarkTree.querySelectorAll('.bookmark-item');
    elements.forEach(el => {
      el.classList.remove('drag-over', 'drag-over-bottom');
    });
    this.dragOverElement = null;
  }

  handleDrop(draggedElement, dropTarget, event) {
    const draggedId = draggedElement.getAttribute('data-bookmark-id');
    const dropTargetId = dropTarget.getAttribute('data-bookmark-id');

    if (draggedId === dropTargetId) return;

    // 获取当前文件夹的书签列表
    const currentFolder = this.findFolderById(this.bookmarks, this.currentFolder.id);
    if (!currentFolder || !currentFolder.children) return;

    const bookmarks = currentFolder.children;
    const draggedIndex = bookmarks.findIndex(b => b.id === draggedId);
    const dropIndex = bookmarks.findIndex(b => b.id === dropTargetId);

    if (draggedIndex === -1 || dropIndex === -1) return;

    // 确定插入位置
    const rect = dropTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertIndex = event.clientY < midpoint ? dropIndex : dropIndex + 1;

    // 重新排序
    const draggedBookmark = bookmarks.splice(draggedIndex, 1)[0];
    const adjustedInsertIndex = insertIndex > draggedIndex ? insertIndex - 1 : insertIndex;
    bookmarks.splice(adjustedInsertIndex, 0, draggedBookmark);

    // 更新Chrome书签API
    this.updateBookmarkOrder(draggedId, dropTargetId, insertIndex > dropIndex);

    // 保存到存储
    this.saveBookmarksToStorage();

    // 延迟重新渲染，确保状态清理完成
    setTimeout(() => {
      this.renderBookmarks();
    }, 50);
  }

  async updateBookmarkOrder(draggedId, dropTargetId, insertAfter) {
    try {
      // 使用当前文件夹作为父ID
      const parentId = this.currentFolder.id;

      // 计算新的索引位置
      const currentFolder = this.findFolderById(this.bookmarks, this.currentFolder.id);
      if (!currentFolder || !currentFolder.children) return;

      const bookmarks = currentFolder.children;
      const dropIndex = bookmarks.findIndex(b => b.id === dropTargetId);
      if (dropIndex === -1) return;

      const newIndex = insertAfter ? dropIndex + 1 : dropIndex;

      // 移动书签
      await chrome.bookmarks.move(draggedId, {
        parentId: parentId,
        index: newIndex
      });
    } catch (error) {
      console.error('Failed to update bookmark order:', error);
    }
  }

  findBookmarkById(bookmarks, id) {
    for (const bookmark of bookmarks) {
      if (bookmark.id === id) return bookmark;
      if (bookmark.children) {
        const found = this.findBookmarkById(bookmark.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  getBookmarkIndex(bookmarkId) {
    const currentFolder = this.findFolderById(this.bookmarks, this.currentFolder.id);
    if (!currentFolder || !currentFolder.children) return 0;

    return currentFolder.children.findIndex(b => b.id === bookmarkId);
  }

  filterBookmarks(searchTerm) {
    // 搜索功能现在在根目录进行，并同步更新左侧目录
    this.renderBookmarks();
    this.renderFolderTree();
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
    const searchTerm = this.searchInput.value.trim();

    for (const bookmark of bookmarks) {
      if (bookmark.children) {
        const childFolders = this.getFolders(bookmark.children);

        // 如果有搜索条件，检查目录是否包含搜索结果
        if (searchTerm) {
          const hasSearchResults = this.hasSearchResults(bookmark, searchTerm.toLowerCase());
          if (!hasSearchResults) {
            continue; // 跳过不包含搜索结果的目录
          }
        }

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

  // 检查目录是否包含搜索结果
  hasSearchResults(bookmark, searchTerm) {
    // 检查当前书签是否匹配
    if (bookmark.title.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // 检查子项
    if (bookmark.children) {
      for (const child of bookmark.children) {
        if (this.hasSearchResults(child, searchTerm)) {
          return true;
        }
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


  // 执行脚本书签（符合 MV3 CSP，使用 chrome.scripting API 替代 eval/document.write）
  executeScript(scriptUrl) {
    if (scriptUrl.startsWith('javascript:')) {
      const script = scriptUrl.substring(11);
      try {
        // 查找可用的网页标签页，在其上下文中执行书签脚本
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          const targetTab = tabs.find(tab =>
            tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
          );

          if (targetTab && targetTab.id) {
            chrome.scripting.executeScript({
              target: { tabId: targetTab.id },
              world: 'MAIN',
              func: (code) => {
                const s = document.createElement('script');
                s.textContent = decodeURIComponent(code);
                (document.head || document.documentElement).appendChild(s);
                s.remove();
              },
              args: [script]
            }).then(() => {
              // 切换到目标标签页
              chrome.tabs.update(targetTab.id, { active: true });
            }).catch((error) => {
              alert(t('manager.scriptExecutionFailed') + error.message);
            });
          } else {
            alert(t('manager.noWebPageTab') || '请先打开一个网页标签页，再执行脚本书签');
          }
        });
      } catch (error) {
        alert(t('manager.scriptExecutionFailed') + error.message);
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
      const hasChildren = folder.children && folder.children.length > 0;

      html += `
        <div class="folder-item${hiddenClass}" data-folder-id="${folder.id}" style="padding-left: ${16 + level * 16}px;">
          ${hasChildren ? '<div class="folder-toggle">▼</div>' : '<div class="folder-toggle" style="visibility: hidden;">▼</div>'}
          <div class="folder-icon">📁</div>
          <div class="folder-name">${folder.title} ${hiddenIcon}</div>
        </div>
        ${hasChildren ? `
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

      // 检查是否在搜索状态
      const searchTerm = this.searchInput.value.trim();
      if (searchTerm) {
        // 在搜索状态下，显示该目录中包含搜索结果的子项
        this.renderSearchResultsInFolder(folder, searchTerm);
      } else {
        // 正常状态下，显示该目录的所有内容
        this.renderBookmarks();
      }
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

  // 查找父目录
  findParentFolder(bookmarks, childId, parent = null) {
    for (const bookmark of bookmarks) {
      if (bookmark.id === childId) {
        return parent;
      }
      if (bookmark.children) {
        const found = this.findParentFolder(bookmark.children, childId, bookmark);
        if (found !== null) return found;
      }
    }
    return null;
  }

  renderBookmarks() {
    const searchTerm = this.searchInput.value.trim();

    // 如果有搜索条件，在根目录进行搜索
    if (searchTerm) {
      this.renderSearchResults(searchTerm);
      return;
    }

    // 没有搜索条件时，显示当前文件夹内容
    if (!this.currentFolder) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t('manager.selectFolderHint')}</h3>
          <p>${t('manager.selectFolderDesc')}</p>
        </div>
      `;
      return;
    }

    // 查找父目录
    const parentFolder = this.findParentFolder(this.bookmarks, this.currentFolder.id);

    // 更新返回按钮显示状态
    if (parentFolder) {
      this.backButton.style.display = 'flex';
      this.backButton.setAttribute('data-parent-id', parentFolder.id);
      this.backButton.querySelector('.back-text').textContent = `${t('btn.back')} ${parentFolder.title}`;
    } else {
      this.backButton.style.display = 'none';
    }

    // 重新查找当前文件夹，因为数据可能已经更新
    const folder = this.findFolderById(this.bookmarks, this.currentFolder.id);
    if (!folder) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t('manager.folderNotExist')}</h3>
          <p>${t('manager.folderMayBeDeleted')}</p>
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
          <h3>${t('manager.folderEmpty')}</h3>
          <p>${t('manager.folderNoBookmarks')}</p>
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

    if (filteredBookmarks.length === 0) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t('manager.noMatchingBookmarks')}</h3>
          <p>${t('manager.noBookmarksInFilter')}</p>
        </div>
      `;
      return;
    }

    this.bookmarkTree.innerHTML = this.renderBookmarkList(filteredBookmarks);
  }

  renderSearchResults(searchTerm) {
    // 在根目录进行搜索
    const rootBookmarks = this.bookmarks[0]?.children || [];

    // 根据当前筛选状态过滤书签
    let filteredBookmarks = rootBookmarks;
    switch (this.currentFilter) {
      case 'visible':
        filteredBookmarks = this.filterVisibleBookmarks(rootBookmarks);
        break;
      case 'hidden':
        filteredBookmarks = this.filterHiddenOnlyBookmarks(rootBookmarks);
        break;
      case 'all':
      default:
        filteredBookmarks = rootBookmarks;
        break;
    }

    // 应用搜索过滤
    const searchResults = this.searchInBookmarks(filteredBookmarks, searchTerm.toLowerCase());

    if (searchResults.length === 0) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t('manager.noSearchResults')}</h3>
          <p>${t('manager.searchNoResult', searchTerm)}</p>
        </div>
      `;
      // 清除左侧选中状态
      document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('active');
      });
      this.panelTitle.textContent = t('manager.searchResults');
      return;
    }

    // 显示搜索结果，包含文件夹路径信息
    this.bookmarkTree.innerHTML = this.renderSearchResultsList(searchResults, searchTerm);

    // 更新面板标题
    this.panelTitle.textContent = `${t('manager.searchResults')} (${searchResults.length} ${t('manager.items')})`;

    // 清除左侧选中状态，因为显示的是全局搜索结果
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  renderSearchResultsList(bookmarks, searchTerm) {
    let html = '';

    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        // 书签
        const isHidden = bookmark.hidden || false;
        const hiddenClass = isHidden ? ' hidden-bookmark' : '';
        const hiddenIcon = isHidden ? '👁️‍🗨️' : '';

        // 检测是否为脚本书签
        const isJavaScript = bookmark.url.startsWith('javascript:');
        const isDataUrl = bookmark.url.startsWith('data:');

        let faviconUrl, displayUrl, clickHandler;

        if (isJavaScript || isDataUrl) {
          // 脚本书签特殊处理
          faviconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=';
          displayUrl = t('manager.scriptBookmark');
          clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
        } else {
          // 普通书签
          faviconUrl = this.getFaviconUrl(bookmark.url);
          displayUrl = bookmark.url;
          clickHandler = `href="${bookmark.url}" target="_blank"`;
        }

        html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">⋮⋮</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t('manager.statBookmarks')}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${this.highlightSearchTerm(bookmark.title, searchTerm)} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t('btn.edit')}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t('btn.show') : t('btn.hide')}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t('btn.delete')}</button>
              </div>
            </div>
          </div>
        `;
      } else if (bookmark.children) {
        // 文件夹 - 递归渲染子项
        html += this.renderSearchResultsList(bookmark.children, searchTerm);
      }
    }

    return html;
  }

  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  renderSearchResultsInFolder(folder, searchTerm) {
    // 在该目录中搜索匹配的内容
    const searchResults = this.searchInBookmarks(folder.children || [], searchTerm.toLowerCase());

    if (searchResults.length === 0) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t('manager.noMatchInFolder')}</h3>
          <p>${t('manager.noSearchResultInFolder', folder.title, searchTerm)}</p>
        </div>
      `;
      this.panelTitle.textContent = `${folder.title} - ${t('manager.searchResults')} (0 ${t('manager.items')})`;
      return;
    }

    // 显示该目录中的搜索结果
    this.bookmarkTree.innerHTML = this.renderSearchResultsList(searchResults, searchTerm);
    this.panelTitle.textContent = `${folder.title} - ${t('manager.searchResults')} (${searchResults.length} ${t('manager.items')})`;
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
          displayUrl = t('manager.scriptBookmark');
          clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
        } else {
          // 普通书签
          faviconUrl = this.getFaviconUrl(bookmark.url);
          displayUrl = bookmark.url;
          clickHandler = `href="${bookmark.url}" target="_blank"`;
        }

        html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">⋮⋮</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t('manager.statBookmarks')}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${bookmark.title} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t('btn.edit')}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t('btn.show') : t('btn.hide')}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t('btn.delete')}</button>
              </div>
            </div>
          </div>
        `;
      } else if (bookmark.children) {
        // 子文件夹
        const hiddenClass = isHidden ? ' hidden-bookmark' : '';
        const hiddenIcon = isHidden ? '👁️‍🗨️' : '';
        html += `
          <div class="bookmark-item folder-item${hiddenClass}" data-folder-id="${bookmark.id}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">⋮⋮</div>
            <div class="folder-icon">📁</div>
            <div class="bookmark-content">
              <div class="bookmark-title">${bookmark.title} ${hiddenIcon}</div>
              <div class="bookmark-url">${t('manager.folderItems', String(bookmark.children.length))}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t('btn.edit')}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t('btn.show') : t('btn.hide')}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t('btn.delete')}</button>
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

  editBookmark(id) {
    // 查找书签数据
    const bookmark = this.findBookmarkById(id);
    if (!bookmark) {
      alert(t('manager.editNotFound'));
      return;
    }

    // 判断是文件夹还是书签
    const isFolder = !!bookmark.children;

    // 设置对话框标题
    const modalTitle = document.getElementById('editModalTitle');
    modalTitle.textContent = isFolder ? t('manager.editFolder') : t('manager.editBookmark');

    // 填充当前数据
    document.getElementById('editBookmarkId').value = id;
    document.getElementById('editBookmarkTitle').value = bookmark.title || '';
    document.getElementById('editBookmarkUrl').value = bookmark.url || '';

    // 文件夹不显示URL输入框
    const urlGroup = document.getElementById('editUrlGroup');
    urlGroup.style.display = isFolder ? 'none' : 'block';

    // 显示对话框
    document.getElementById('editModal').style.display = 'flex';

    // 聚焦到标题输入框
    setTimeout(() => {
      document.getElementById('editBookmarkTitle').focus();
    }, 100);
  }

  hideEditModal() {
    document.getElementById('editModal').style.display = 'none';
  }

  saveEditBookmark() {
    const id = document.getElementById('editBookmarkId').value;
    const newTitle = document.getElementById('editBookmarkTitle').value.trim();
    // 清除textarea中可能存在的换行符
    const newUrl = document.getElementById('editBookmarkUrl').value.trim().replace(/[\r\n]/g, '');

    if (!newTitle) {
      alert(t('manager.editTitleRequired'));
      return;
    }

    // 查找书签数据
    const bookmark = this.findBookmarkById(id);
    if (!bookmark) {
      alert(t('manager.editNotFound'));
      return;
    }

    const isFolder = !!bookmark.children;

    const updateLocalData = () => {
      // 更新本地数据
      bookmark.title = newTitle;
      if (!isFolder && newUrl) {
        bookmark.url = newUrl;
      }

      // 保存到storage
      this.saveBookmarksToStorage();

      // 同步到Gitee
      this.saveBookmarkTreeToGitee(this.bookmarks);

      // 更新系统书签栏
      this.updateSystemBookmarks();

      // 关闭对话框
      this.hideEditModal();

      // 重新渲染
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        const updateData = { title: newTitle };
        if (!isFolder && newUrl) {
          updateData.url = newUrl;
        }

        chrome.bookmarks.update(id, updateData, () => {
          updateLocalData();
        });
      } else {
        // 没有Chrome API时（如Gitee数据），直接更新本地数据
        updateLocalData();
      }
    } catch (error) {
      alert(t('manager.editFailed'));
    }
  }

  deleteBookmark(id) {
    if (confirm(t('confirm.deleteBookmark'))) {
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
          alert(t('manager.deleteBookmarkNeedExtension'));
        }
      } catch (error) {
        alert(t('manager.deleteBookmarkFailed'));
      }
    }
  }

  exportBookmarks() {
    // 导出书签时确保所有书签节点都有明确的 hidden 标记
    const markHiddenState = (bookmarks) => {
      return bookmarks.map(bookmark => {
        const node = { ...bookmark };
        // 确保每个节点都有明确的 hidden 字段，未设置的默认为 false
        node.hidden = !!node.hidden;
        if (node.children && node.children.length > 0) {
          node.children = markHiddenState(node.children);
        }
        return node;
      });
    };

    const exportData = markHiddenState(this.bookmarks);
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookmarks.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  // 导入书签 - 触发文件选择
  triggerImport() {
    const fileInput = document.getElementById('importFileInput');
    fileInput.value = ''; // 重置，允许再次选择相同文件
    fileInput.click();
  }

  // 处理导入文件选择
  handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data) || data.length === 0) {
          alert(t('manager.importInvalidFormat'));
          return;
        }

        // 验证数据基本结构
        if (!this.validateImportData(data)) {
          alert(t('manager.importInvalidFormat'));
          return;
        }

        // 统计导入数据信息
        const stats = this.analyzeImportData(data);
        this.pendingImportData = data;

        // 显示导入确认对话框
        this.showImportModal(stats);
      } catch (error) {
        alert(t('manager.importInvalidFormat'));
      }
    };
    reader.readAsText(file);
  }

  // 验证导入数据结构
  validateImportData(data) {
    const validate = (items) => {
      for (const item of items) {
        // 每个项必须有 title 字段
        if (typeof item.title !== 'string') {
          return false;
        }
        // 如果有 children，必须是数组且递归验证
        if (item.children !== undefined) {
          if (!Array.isArray(item.children)) {
            return false;
          }
          if (!validate(item.children)) {
            return false;
          }
        }
      }
      return true;
    };
    return validate(data);
  }

  // 分析导入数据统计信息
  analyzeImportData(data) {
    let totalBookmarks = 0;
    let totalFolders = 0;
    let hiddenBookmarks = 0;
    let hiddenFolders = 0;

    const analyze = (items) => {
      for (const item of items) {
        if (item.children) {
          totalFolders++;
          if (item.hidden) hiddenFolders++;
          analyze(item.children);
        } else {
          totalBookmarks++;
          if (item.hidden) hiddenBookmarks++;
        }
      }
    };
    analyze(data);

    return { totalBookmarks, totalFolders, hiddenBookmarks, hiddenFolders };
  }

  // 显示导入确认对话框
  showImportModal(stats) {
    const importInfo = document.getElementById('importInfo');
    let html = `<div style="margin-bottom: 8px; font-weight: 500;">${t('manager.importSummary')}</div>`;
    html += `<div class="import-stat">📑 ${t('manager.importTotalBookmarks', stats.totalBookmarks)}</div>`;
    html += `<div class="import-stat">📁 ${t('manager.importTotalFolders', stats.totalFolders)}</div>`;

    if (stats.hiddenBookmarks > 0 || stats.hiddenFolders > 0) {
      html += `<div class="import-stat"><span class="hidden-tag">👁️‍🗨️ ${t('manager.importHiddenBookmarks', stats.hiddenBookmarks)}</span></div>`;
      html += `<div class="import-stat"><span class="hidden-tag">👁️‍🗨️ ${t('manager.importHiddenFolders', stats.hiddenFolders)}</span></div>`;
    }

    importInfo.innerHTML = html;
    document.getElementById('importModal').style.display = 'flex';
  }

  // 隐藏导入对话框
  hideImportModal() {
    document.getElementById('importModal').style.display = 'none';
    this.pendingImportData = null;
  }

  // 确认导入书签
  confirmImport() {
    if (!this.pendingImportData) return;

    const importMode = document.querySelector('input[name="importMode"]:checked').value;

    try {
      if (importMode === 'overwrite') {
        // 覆盖模式：直接替换
        this.bookmarks = this.processImportedBookmarks(this.pendingImportData);
      } else {
        // 合并模式：将导入数据合并到当前书签
        this.bookmarks = this.mergeImportedBookmarks(this.bookmarks, this.pendingImportData);
      }

      // 保存到storage
      this.saveBookmarksToStorage();

      // 保存到Gitee仓库
      this.saveBookmarkTreeToGitee(this.bookmarks);

      // 更新系统书签（过滤掉隐藏的书签）
      this.updateSystemBookmarks();

      // 重新渲染
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();

      // 关闭对话框
      this.hideImportModal();

      alert(t('manager.importSuccess'));
    } catch (error) {
      alert(t('manager.importFailed'));
    }
  }

  // 处理导入的书签数据，确保 hidden 字段被正确识别
  processImportedBookmarks(data) {
    const process = (items) => {
      return items.map(item => {
        const node = { ...item };
        // 正确识别隐藏状态：hidden 为 true 则标记为隐藏
        if (node.hidden === true) {
          node.hidden = true;
        } else {
          node.hidden = false;
        }
        if (node.children && Array.isArray(node.children)) {
          node.children = process(node.children);
        }
        return node;
      });
    };
    return process(data);
  }

  // 合并导入的书签到当前书签
  mergeImportedBookmarks(currentBookmarks, importedBookmarks) {
    // 合并策略：按标题和URL去重，保留已有的 hidden 状态
    const mergeNodes = (current, imported) => {
      // 创建当前节点的映射（按 title + url 或 title 对于文件夹）
      const currentMap = new Map();
      current.forEach(item => {
        const key = item.children ? `folder:${item.title}` : `bookmark:${item.title}:${item.url || ''}`;
        currentMap.set(key, item);
      });

      // 遍历导入的数据
      imported.forEach(item => {
        const key = item.children ? `folder:${item.title}` : `bookmark:${item.title}:${item.url || ''}`;

        if (currentMap.has(key)) {
          // 已存在的项：如果是文件夹，递归合并 children
          const existing = currentMap.get(key);
          if (existing.children && item.children) {
            existing.children = mergeNodes(existing.children, item.children);
          }
          // 保留导入数据中的 hidden 状态（如果导入数据有隐藏标记，优先保留）
          if (item.hidden === true) {
            existing.hidden = true;
          }
        } else {
          // 新增的项：处理 hidden 状态后添加
          const newItem = { ...item };
          if (newItem.hidden === true) {
            newItem.hidden = true;
          } else {
            newItem.hidden = false;
          }
          if (newItem.children && Array.isArray(newItem.children)) {
            newItem.children = this.processImportedBookmarks(newItem.children);
          }
          current.push(newItem);
        }
      });

      return current;
    };

    // 对顶层节点进行合并
    return mergeNodes([...currentBookmarks], importedBookmarks);
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

      // 保存到storage供popup使用
      this.saveBookmarksToStorage();

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
        reject(new Error(t('manager.giteeConfigIncomplete')));
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
          reject(new Error(t('manager.cannotGetFileContent')));
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

  // 合并两个书签树数组（递归去重），与popup.ts中mergeBookmarks逻辑一致
  mergeBookmarks(arr1, arr2) {
    const map = new Map();
    const getKey = (node) => {
      return node.url ? `bookmark:${node.title}|${node.url}` : `folder:${node.title}`;
    };
    // 先放 arr1（本地优先）
    arr1.forEach(n1 => {
      const key = getKey(n1);
      map.set(key, { ...n1, children: n1.children ? this.mergeBookmarks(n1.children, []) : undefined });
    });
    // 合并 arr2（远程数据）
    arr2.forEach(n2 => {
      const key = getKey(n2);
      if (map.has(key)) {
        // 文件夹递归合并children，保留本地的hidden属性
        if (!n2.url) {
          const existing = map.get(key);
          map.set(key, {
            ...n2,
            hidden: existing.hidden !== undefined ? existing.hidden : n2.hidden,
            children: this.mergeBookmarks(existing.children || [], n2.children || [])
          });
        }
        // 书签已存在则跳过（保留本地版本，包含hidden状态）
      } else {
        map.set(key, { ...n2, children: n2.children ? this.mergeBookmarks([], n2.children) : undefined });
      }
    });
    return Array.from(map.values());
  }

  saveBookmarkTreeToGitee(bookmarks) {
    if (!this.giteeConfig || !this.giteeConfig.owner || !this.giteeConfig.repo || !this.giteeConfig.token) {
      return;
    }

    const apiUrl = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}`;

    // 使用合并保存方式：先获取远程数据，合并后再上传
    fetch(`${apiUrl}?ref=${this.giteeConfig.branch}`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${this.giteeConfig.token}`
      }
    })
    .then(response => response.json())
    .then(data => {
      let mergedBookmarks = bookmarks;
      const sha = data.sha;

      if (data.content) {
        try {
          // 解码远程文件内容
          const remoteContent = decodeURIComponent(escape(atob(data.content)));
          const remoteBookmarks = JSON.parse(remoteContent);

          // 合并本地和远程书签（本地优先，保留hidden状态）
          mergedBookmarks = this.mergeBookmarks(bookmarks, remoteBookmarks);
        } catch (e) {
          // 远程内容解析失败，使用本地数据直接覆盖
          console.warn('远程书签数据解析失败，将直接使用本地数据保存:', e);
        }
      }

      // 编码合并后的内容并上传
      const content = JSON.stringify(mergedBookmarks, null, 2);
      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      return fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${this.giteeConfig.token}`
        },
        body: JSON.stringify({
          message: 'Update bookmark tree - merge hidden attributes',
          content: encodedContent,
          sha: sha
        })
      });
    })
    .then(response => response.json())
    .then(data => {
      if (data.content) {
        console.log('书签合并保存到Gitee成功');
      } else {
        console.warn('书签合并保存到Gitee失败:', data);
      }
    })
    .catch(error => {
      console.error('书签合并保存到Gitee出错:', error);
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
    // 1. 从 IndexedDB 读取原始（加密后的）数据
    const rawResult = await new Promise(resolve => {
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
    // 2. 解密每个字段（兼容未加密的旧数据）
    const decrypted = {};
    for (const f of fields) {
      decrypted[f] = await decryptSafe(rawResult[f]);
    }
    return decrypted;
  }

  async setConfigToIndexedDB(config) {
    // 1. 先加密所有配置值
    const encryptedConfig = {};
    for (const [k, v] of Object.entries(config)) {
      encryptedConfig[k] = v ? await encrypt(v) : v;
    }
    // 2. 写入 IndexedDB
    const db = await this.openDB();
    const tx = db.transaction('gitee-config', 'readwrite');
    const store = tx.objectStore('gitee-config');
    Object.entries(encryptedConfig).forEach(([k, v]) => store.put(v, k));
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
      alert(t('manager.configIncomplete'));
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
    alert(t('manager.configSaved'));
  }

  // ========== 重复书签检测 ==========

  /**
   * 递归展平书签树为平面数组，每项携带文件夹路径
   */
  flattenBookmarks(bookmarks, parentPath = '') {
    const result = [];
    for (const item of bookmarks) {
      const currentPath = parentPath ? `${parentPath} > ${item.title}` : item.title;
      if (item.url) {
        result.push({
          id: item.id,
          title: item.title || '',
          url: item.url,
          path: parentPath || '(root)',
          dateAdded: item.dateAdded || 0,
        });
      }
      if (item.children) {
        result.push(...this.flattenBookmarks(item.children, currentPath));
      }
    }
    return result;
  }

  /**
   * URL 标准化：小写 + 去协议 + 去尾斜杠 + 可选去查询参数
   */
  normalizeUrl(url, stripQuery = false) {
    try {
      let u = url.trim().toLowerCase();
      u = u.replace(/^https?:\/\//, '');
      u = u.replace(/\/+$/, '');
      if (stripQuery) {
        u = u.replace(/[?#].*$/, '');
      }
      return u;
    } catch {
      return url;
    }
  }

  /**
   * 基于 bigram Dice 系数的标题相似度计算（0~1）
   */
  titleSimilarity(a, b) {
    a = a.trim().toLowerCase();
    b = b.trim().toLowerCase();
    if (a === b) return 1.0;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramsA = new Map();
    for (let i = 0; i < a.length - 1; i++) {
      const bigram = a.substring(i, i + 2);
      bigramsA.set(bigram, (bigramsA.get(bigram) || 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bigram = b.substring(i, i + 2);
      const count = bigramsA.get(bigram) || 0;
      if (count > 0) {
        bigramsA.set(bigram, count - 1);
        intersection++;
      }
    }

    return (2 * intersection) / ((a.length - 1) + (b.length - 1));
  }

  /**
   * 按 URL 精确匹配检测重复
   */
  detectDuplicatesByUrl(flatBookmarks, stripQuery = false) {
    const groups = new Map();

    for (const bookmark of flatBookmarks) {
      if (!bookmark.url) continue;
      const key = this.normalizeUrl(bookmark.url, stripQuery);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(bookmark);
    }

    const duplicates = [];
    for (const [key, items] of groups) {
      if (items.length > 1) {
        duplicates.push({ key, items });
      }
    }

    return duplicates;
  }

  /**
   * 按标题模糊匹配检测重复（Dice 系数 >= 0.6）
   */
  detectDuplicatesByTitle(flatBookmarks) {
    const threshold = 0.6;
    const visited = new Set();
    const groups = [];

    for (let i = 0; i < flatBookmarks.length; i++) {
      if (visited.has(i)) continue;
      const group = [flatBookmarks[i]];

      for (let j = i + 1; j < flatBookmarks.length; j++) {
        if (visited.has(j)) continue;
        const similarity = this.titleSimilarity(
          flatBookmarks[i].title,
          flatBookmarks[j].title
        );
        if (similarity >= threshold) {
          group.push(flatBookmarks[j]);
          visited.add(j);
        }
      }

      if (group.length > 1) {
        visited.add(i);
        groups.push({
          key: flatBookmarks[i].title,
          items: group,
        });
      }
    }

    return groups;
  }

  /**
   * 打开重复检测对话框
   */
  showDuplicateModal() {
    document.getElementById('duplicateModal').style.display = 'flex';
    // 重置为 URL 模式
    document.querySelector('input[name="duplicateMode"][value="url"]').checked = true;
    document.getElementById('stripQueryParam').checked = false;
    document.getElementById('stripQueryLabel').style.display = '';
    this.runDuplicateDetection();
  }

  /**
   * 关闭重复检测对话框
   */
  hideDuplicateModal() {
    document.getElementById('duplicateModal').style.display = 'none';
  }

  /**
   * 根据当前模式执行重复检测
   */
  runDuplicateDetection() {
    const mode = document.querySelector('input[name="duplicateMode"]:checked').value;
    const stripQuery = document.getElementById('stripQueryParam').checked;

    // URL 模式才显示「忽略查询参数」
    document.getElementById('stripQueryLabel').style.display = mode === 'url' ? '' : 'none';

    // 展平书签树
    const flatBookmarks = this.flattenBookmarks(this.bookmarks);

    // 执行检测
    let duplicateGroups;
    if (mode === 'url') {
      duplicateGroups = this.detectDuplicatesByUrl(flatBookmarks, stripQuery);
    } else {
      duplicateGroups = this.detectDuplicatesByTitle(flatBookmarks);
    }

    this.currentDuplicateGroups = duplicateGroups;
    this.renderDuplicateResults(duplicateGroups);
  }

  /**
   * 渲染重复检测结果
   */
  renderDuplicateResults(groups) {
    const statsEl = document.getElementById('duplicateStats');
    const resultsEl = document.getElementById('duplicateResults');
    const deleteBtn = document.getElementById('deleteDuplicatesBtn');
    const controlsEl = document.getElementById('duplicateControls');

    if (groups.length === 0) {
      statsEl.style.display = 'none';
      controlsEl.style.display = 'none';
      resultsEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary);">
          <div style="font-size: 40px; margin-bottom: 12px;">✅</div>
          <div style="font-size: 16px; margin-bottom: 8px;">${t('manager.duplicateNone')}</div>
          <div style="font-size: 13px;">${t('manager.duplicateNoneDesc')}</div>
        </div>
      `;
      deleteBtn.style.display = 'none';
      return;
    }

    // 统计
    const totalDuplicates = groups.reduce((sum, g) => sum + g.items.length - 1, 0);
    statsEl.style.display = 'flex';
    statsEl.innerHTML = `
      <span>${t('manager.duplicateGroups', String(groups.length))}</span>
      <span>${t('manager.duplicateTotal', String(totalDuplicates))}</span>
    `;

    controlsEl.style.display = '';
    deleteBtn.style.display = '';

    // 构建分组 HTML
    let html = '';
    groups.forEach((group, groupIdx) => {
      html += `<div class="duplicate-group">`;
      html += `<div class="duplicate-group-header">`;
      html += `<span style="white-space: nowrap;">📑 ${group.items.length} ${t('manager.items')}</span>`;
      if (group.items[0].url) {
        const displayUrl = group.items[0].url.length > 80
          ? group.items[0].url.substring(0, 80) + '...'
          : group.items[0].url;
        html += `<span style="color: var(--color-text-muted); font-weight: 400; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayUrl)}</span>`;
      }
      html += `</div>`;

      group.items.forEach((item, itemIdx) => {
        const isFirst = itemIdx === 0;
        const checked = isFirst ? '' : 'checked';

        html += `
          <div class="duplicate-item">
            <input type="checkbox" class="duplicate-checkbox"
                   data-group="${groupIdx}" data-item="${itemIdx}"
                   data-bookmark-id="${item.id}" ${checked}>
            <div class="duplicate-item-info">
              <div class="duplicate-item-title">
                ${this.escapeHtml(item.title)}
                ${isFirst ? `<span class="duplicate-keep-badge">${t('manager.duplicateKeepHint')}</span>` : ''}
              </div>
              ${item.url ? `<div class="duplicate-item-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(item.url)}</div>` : ''}
              <div class="duplicate-item-path">${t('manager.duplicatePath', this.escapeHtml(item.path))}</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    resultsEl.innerHTML = html;

    // 绑定 checkbox 变更事件
    this.updateDuplicateSelectedCount();
    resultsEl.querySelectorAll('.duplicate-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        this.updateDuplicateSelectedCount();
      });
    });
  }

  /**
   * HTML 转义（防 XSS）
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 更新删除按钮上的选中计数
   */
  updateDuplicateSelectedCount() {
    const checkboxes = document.querySelectorAll('#duplicateResults .duplicate-checkbox:checked');
    const count = checkboxes.length;
    const deleteBtn = document.getElementById('deleteDuplicatesBtn');
    deleteBtn.textContent = t('manager.duplicateDeleteSelected', String(count));
    deleteBtn.disabled = count === 0;
  }

  /**
   * 全选 / 取消全选
   */
  toggleAllDuplicateCheckboxes(checked) {
    document.querySelectorAll('#duplicateResults .duplicate-checkbox').forEach(cb => {
      cb.checked = checked;
    });
    this.updateDuplicateSelectedCount();
  }

  /**
   * 批量删除选中的重复书签
   */
  async deleteSelectedDuplicates() {
    const checkboxes = document.querySelectorAll('#duplicateResults .duplicate-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.getAttribute('data-bookmark-id'));

    if (ids.length === 0) return;

    if (!confirm(t('confirm.deleteDuplicates', String(ids.length)))) {
      return;
    }

    const deleteBtn = document.getElementById('deleteDuplicatesBtn');
    deleteBtn.textContent = t('manager.duplicateDeleting');
    deleteBtn.disabled = true;

    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        for (const id of ids) {
          await new Promise((resolve, reject) => {
            chrome.bookmarks.remove(id, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
      }

      // 刷新书签数据和 UI
      await this.loadBookmarks();
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();

      // 关闭对话框并提示成功
      this.hideDuplicateModal();
      alert(t('manager.duplicateDeleteSuccess', String(ids.length)));
    } catch (error) {
      console.error('Delete duplicates failed:', error);
      alert(t('manager.duplicateDeleteFailed'));
      // 重新执行检测刷新状态
      this.runDuplicateDetection();
    }
  }

  // ========== 失效链接检测 ==========

  /**
   * 打开失效链接检测对话框
   */
  showLinkCheckModal() {
    document.getElementById('linkCheckModal').style.display = 'flex';
    // 重置状态
    this.linkCheckResults = [];
    this.linkCheckRunning = false;
    this.linkCheckCurrentFilter = 'all';
    document.getElementById('linkCheckFilter').value = 'all';
    document.getElementById('linkCheckProgress').style.display = 'none';
    document.getElementById('linkCheckStats').style.display = 'none';
    document.getElementById('linkCheckControls').style.display = 'none';
    document.getElementById('linkCheckResults').innerHTML = '';
    document.getElementById('deleteBrokenLinksBtn').style.display = 'none';
    document.getElementById('linkCheckStartBtn').style.display = '';
    document.getElementById('linkCheckStopBtn').style.display = 'none';
    document.getElementById('linkCheckStartBtn').disabled = false;
  }

  /**
   * 关闭失效链接检测对话框
   */
  hideLinkCheckModal() {
    this.stopLinkCheck();
    document.getElementById('linkCheckModal').style.display = 'none';
  }

  /**
   * 停止链接检测
   */
  stopLinkCheck() {
    this.linkCheckRunning = false;
    document.getElementById('linkCheckStartBtn').style.display = '';
    document.getElementById('linkCheckStopBtn').style.display = 'none';
    document.getElementById('linkCheckStartBtn').disabled = false;
  }

  /**
   * 向 background.ts 发送单个链接检测请求
   */
  checkSingleLink(url) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'checkLink', url }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ status: 'error', statusCode: 0, url, message: chrome.runtime.lastError.message });
          } else {
            resolve(response || { status: 'error', statusCode: 0, url, message: 'No response' });
          }
        });
      } else {
        // 非扩展环境下的回退方案：直接 fetch（可能受 CORS 影响）
        this.checkLinkFallback(url).then(resolve);
      }
    });
  }

  /**
   * 非扩展环境下的 fetch 回退方案
   * no-cors 模式下无法读取真实状态码，仅可判断网络是否可达
   */
  async checkLinkFallback(url) {
    if (!/^https?:\/\//i.test(url)) {
      return { status: 'ok', statusCode: 0, url, message: 'Skipped' };
    }

    // 跳过 Chrome 内部受限域名，避免 CORS 报错
    const RESTRICTED_DOMAINS = [
      'chrome.google.com',
      'chromewebstore.google.com',
      'accounts.google.com',
      'clients2.google.com',
    ];
    try {
      const hostname = new URL(url).hostname;
      if (RESTRICTED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        return { status: 'ok', statusCode: 0, url, message: 'Skipped (restricted domain)' };
      }
    } catch {
      // URL 解析失败，继续正常检测
    }

    const doFetch = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors',
        });
        return response;
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const response = await doFetch();
      // no-cors 模式下 status 为 0（opaque response），只能判定为 ok
      return { status: 'ok', statusCode: response.status || 0, url };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
      }
      // 首次失败后重试一次
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const response = await doFetch();
        return { status: 'ok', statusCode: response.status || 0, url };
      } catch (retryErr) {
        if (retryErr.name === 'AbortError') {
          return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
        }
        return { status: 'error', statusCode: 0, url, message: retryErr.message || 'Network error' };
      }
    }
  }

  /**
   * 开始链接检测
   */
  async startLinkCheck() {
    if (this.linkCheckRunning) return;

    this.linkCheckRunning = true;
    this.linkCheckResults = [];
    this.linkCheckCurrentFilter = 'all';
    document.getElementById('linkCheckFilter').value = 'all';

    // 切换按钮状态
    document.getElementById('linkCheckStartBtn').style.display = 'none';
    document.getElementById('linkCheckStopBtn').style.display = '';
    document.getElementById('linkCheckProgress').style.display = 'block';
    document.getElementById('linkCheckStats').style.display = 'none';
    document.getElementById('linkCheckControls').style.display = 'none';
    document.getElementById('deleteBrokenLinksBtn').style.display = 'none';
    document.getElementById('linkCheckResults').innerHTML = '';

    // 展平书签树，只取带 URL 的书签
    const flatBookmarks = this.flattenBookmarks(this.bookmarks);
    const total = flatBookmarks.length;

    if (total === 0) {
      this.stopLinkCheck();
      document.getElementById('linkCheckProgress').style.display = 'none';
      document.getElementById('linkCheckResults').innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--color-text-secondary);">
          <div style="font-size:40px;margin-bottom:12px;">📭</div>
          <div style="font-size:16px;">没有需要检测的书签</div>
        </div>
      `;
      return;
    }

    const concurrency = parseInt(document.getElementById('linkCheckConcurrency').value, 10) || 8;
    let completed = 0;

    // 更新进度
    const updateProgress = () => {
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      document.getElementById('linkCheckProgressFill').style.width = `${percent}%`;
      document.getElementById('linkCheckProgressText').textContent =
        t('manager.linkCheckProgress', String(completed), String(total));
      document.getElementById('linkCheckProgressPercent').textContent = `${percent}%`;
    };
    updateProgress();

    // 并发控制：使用 worker 池模式
    let index = 0;
    const worker = async () => {
      while (index < total && this.linkCheckRunning) {
        const i = index++;
        const bookmark = flatBookmarks[i];
        const result = await this.checkSingleLink(bookmark.url);
        if (!this.linkCheckRunning) break;

        this.linkCheckResults.push({
          ...bookmark,
          checkStatus: result.status,
          statusCode: result.statusCode,
          checkMessage: result.message || '',
        });

        completed++;
        updateProgress();

        // 每检测完一个就实时更新结果列表（节流：每 5 个或最后一个时刷新）
        if (completed % 5 === 0 || completed === total) {
          this.renderLinkCheckResults();
        }
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(concurrency, total); w++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    // 检测完成
    this.linkCheckRunning = false;
    document.getElementById('linkCheckStartBtn').style.display = '';
    document.getElementById('linkCheckStopBtn').style.display = 'none';
    document.getElementById('linkCheckStartBtn').disabled = false;

    // 最终渲染
    this.renderLinkCheckResults();
  }

  /**
   * 渲染链接检测结果
   */
  renderLinkCheckResults() {
    const results = this.linkCheckResults;
    const statsEl = document.getElementById('linkCheckStats');
    const resultsEl = document.getElementById('linkCheckResults');
    const controlsEl = document.getElementById('linkCheckControls');
    const deleteBtn = document.getElementById('deleteBrokenLinksBtn');

    if (results.length === 0) return;

    // 统计
    const okCount = results.filter(r => r.checkStatus === 'ok').length;
    const warningCount = results.filter(r => r.checkStatus === 'warning').length;
    const errorCount = results.filter(r => r.checkStatus === 'error').length;

    statsEl.style.display = 'flex';
    statsEl.innerHTML = `
      <span>${t('manager.linkCheckTotal', String(results.length))}</span>
      <span class="linkcheck-stat-ok">${t('manager.linkCheckOkCount', String(okCount))}</span>
      <span class="linkcheck-stat-warning">${t('manager.linkCheckWarningCount', String(warningCount))}</span>
      <span class="linkcheck-stat-error">${t('manager.linkCheckErrorCount', String(errorCount))}</span>
    `;

    // 筛选
    const filter = this.linkCheckCurrentFilter;
    let filtered = results;
    if (filter === 'error') {
      filtered = results.filter(r => r.checkStatus === 'error');
    } else if (filter === 'warning') {
      filtered = results.filter(r => r.checkStatus === 'warning');
    } else if (filter === 'ok') {
      filtered = results.filter(r => r.checkStatus === 'ok');
    }

    const hasBroken = errorCount > 0 || warningCount > 0;

    if (!hasBroken && !this.linkCheckRunning) {
      controlsEl.style.display = 'none';
      deleteBtn.style.display = 'none';
      resultsEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--color-text-secondary);">
          <div style="font-size:40px;margin-bottom:12px;">✅</div>
          <div style="font-size:16px;margin-bottom:8px;">${t('manager.linkCheckNoBroken')}</div>
          <div style="font-size:13px;">${t('manager.linkCheckNoBrokenDesc')}</div>
        </div>
      `;
      return;
    }

    if (hasBroken) {
      controlsEl.style.display = '';
      deleteBtn.style.display = '';
    }

    // 构建结果 HTML
    let html = '';
    filtered.forEach((item) => {
      const statusLabel = item.checkStatus === 'ok'
        ? t('manager.linkCheckOk')
        : item.checkStatus === 'warning'
          ? t('manager.linkCheckWarning')
          : t('manager.linkCheckError');

      const statusClass = `linkcheck-status-${item.checkStatus}`;
      const showCheckbox = item.checkStatus !== 'ok';
      const checked = item.checkStatus === 'error' ? '' : '';

      let detail = '';
      if (item.statusCode && item.statusCode > 0) {
        detail = `HTTP ${item.statusCode}`;
      }
      if (item.checkMessage) {
        detail = detail ? `${detail} · ${item.checkMessage}` : item.checkMessage;
      }

      html += `
        <div class="linkcheck-item">
          ${showCheckbox
            ? `<input type="checkbox" class="linkcheck-checkbox" data-bookmark-id="${item.id}" ${checked}>`
            : `<div style="width:17px;flex-shrink:0;"></div>`
          }
          <div class="linkcheck-item-info">
            <div class="linkcheck-item-title">${this.escapeHtml(item.title)}</div>
            <div class="linkcheck-item-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(item.url)}</div>
            <div class="linkcheck-item-path">${t('manager.duplicatePath', this.escapeHtml(item.path))}</div>
            ${detail ? `<div class="linkcheck-status-detail">${this.escapeHtml(detail)}</div>` : ''}
          </div>
          <span class="linkcheck-item-status ${statusClass}">${statusLabel}</span>
        </div>
      `;
    });

    resultsEl.innerHTML = html;

    // 绑定 checkbox 变更事件
    this.updateLinkCheckSelectedCount();
    resultsEl.querySelectorAll('.linkcheck-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        this.updateLinkCheckSelectedCount();
      });
    });
  }

  /**
   * 更新删除按钮上的选中计数
   */
  updateLinkCheckSelectedCount() {
    const checkboxes = document.querySelectorAll('#linkCheckResults .linkcheck-checkbox:checked');
    const count = checkboxes.length;
    const deleteBtn = document.getElementById('deleteBrokenLinksBtn');
    deleteBtn.textContent = t('manager.linkCheckDeleteSelected', String(count));
    deleteBtn.disabled = count === 0;
  }

  /**
   * 全选/取消全选
   * mode: 'broken' = 选中所有失效和警告, 'none' = 取消全选
   */
  toggleLinkCheckCheckboxes(mode) {
    const checkboxes = document.querySelectorAll('#linkCheckResults .linkcheck-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = mode === 'broken';
    });
    this.updateLinkCheckSelectedCount();
  }

  /**
   * 批量删除选中的失效书签
   */
  async deleteSelectedBrokenLinks() {
    const checkboxes = document.querySelectorAll('#linkCheckResults .linkcheck-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.getAttribute('data-bookmark-id'));

    if (ids.length === 0) return;

    if (!confirm(t('confirm.deleteBrokenLinks', String(ids.length)))) {
      return;
    }

    const deleteBtn = document.getElementById('deleteBrokenLinksBtn');
    deleteBtn.textContent = t('manager.linkCheckDeleting');
    deleteBtn.disabled = true;

    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        for (const id of ids) {
          await new Promise((resolve, reject) => {
            chrome.bookmarks.remove(id, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
      }

      // 从检测结果中移除已删除的书签
      const deletedIds = new Set(ids);
      this.linkCheckResults = this.linkCheckResults.filter(r => !deletedIds.has(r.id));

      // 刷新书签数据和 UI
      await this.loadBookmarks();
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();

      // 重新渲染检测结果
      this.renderLinkCheckResults();
      alert(t('manager.linkCheckDeleteSuccess', String(ids.length)));
    } catch (error) {
      console.error('Delete broken links failed:', error);
      alert(t('manager.linkCheckDeleteFailed'));
    }
  }

}

// 密码验证与初始化书签管理器
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化 i18n 和主题（必须在使用 t() 前完成）
  initTheme();
  await initLocale();
  translateDOM();
  setupThemeToggle();
  // 将 i18n 函数暴露到全局（供可能的外部使用）
  window.__i18n = { t: _t, translateDOM, getLocale, setLocale, initLocale };

  const mainContent = document.getElementById('mainContent');
  const lockOverlay = document.getElementById('passwordLockOverlay');

  // 初始化书签管理器（密码验证通过后调用）
  // 使用 verified 标志防止从控���台重复调用
  let verified = false;
  function initManager() {
    if (verified) return; // 防止重复初始化
    verified = true;
    // 将主内容重新添加到DOM（如果之前被移除）
    if (!document.getElementById('mainContent')) {
      document.body.appendChild(mainContent);
    }
    mainContent.style.display = '';
    window.bookmarkManager = new BookmarkManager();
  }

  // 检查是否从 popup 页面跳转（存在有效的认证时间戳）
  const isFromPopup = await new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['bmAuthTimestamp'], (result) => {
        if (result.bmAuthTimestamp) {
          const elapsed = Date.now() - result.bmAuthTimestamp;
          // 消费掉认证时间戳（一次性使用）
          chrome.storage.local.remove(['bmAuthTimestamp']);
          // 10 秒内的跳转视为来自 popup
          if (elapsed < 10000) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      });
    } else {
      resolve(false);
    }
  });

  // 从 popup 跳转，无需二次校验，直接初始化
  if (isFromPopup) {
    initManager();
    return;
  }

  // 非 popup 跳转，需要检查密码保护
  try {
    // 从 IndexedDB 获取 Gitee 配置
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('bookmarks-plus', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('gitee-config')) {
          db.createObjectStore('gitee-config');
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e);
    });

    const getConfig = (fields) => new Promise((resolve) => {
      const tx = db.transaction('gitee-config', 'readonly');
      const store = tx.objectStore('gitee-config');
      const result = {};
      let count = fields.length;
      fields.forEach((f) => {
        const req = store.get(f);
        req.onsuccess = () => {
          result[f] = req.result || '';
          count--;
          if (count === 0) resolve(result);
        };
        req.onerror = () => {
          count--;
          if (count === 0) resolve(result);
        };
      });
    });

    const rawConfig = await getConfig(['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath']);
    // IndexedDB 中的配置值是加密的，需要解密后才能使用
    const pToken = await decryptSafe(rawConfig.giteeToken || '');
    const pOwner = await decryptSafe(rawConfig.giteeOwner || '');
    const pRepo = await decryptSafe(rawConfig.giteeRepo || '');
    const pBranch = await decryptSafe(rawConfig.giteeBranch || '') || 'master';
    const pFilePath = await decryptSafe(rawConfig.giteeFilePath || '');
    const pDir = pFilePath.includes('/') ? pFilePath.substring(0, pFilePath.lastIndexOf('/')) : '';

    let needLock = false;

    if (pToken && pOwner && pRepo && pBranch && pDir) {
      // 从 Gitee 获取密码配置
      const passwordFileName = '密码.json';
      const passwordFilePath = pDir ? `${pDir}/${passwordFileName}` : passwordFileName;
      const encodedPath = passwordFilePath.split('/').map(encodeURIComponent).join('/');
      const apiUrl = `https://gitee.com/api/v5/repos/${pOwner}/${pRepo}/contents/${encodedPath}?ref=${pBranch}`;

      try {
        const response = await fetch(apiUrl, {
          headers: { 'Authorization': `token ${pToken}` }
        });

        if (response.ok) {
          const fileData = await response.json();
          const decodedContent = atob(fileData.content);
          const decoder = new TextDecoder();
          const decodedData = decoder.decode(
            new Uint8Array([...decodedContent].map((char) => char.charCodeAt(0)))
          );
          const pwdConfig = JSON.parse(decodedData);

          if (pwdConfig && pwdConfig.enabled && pwdConfig.password) {
            needLock = true;

            // === 安全优化：从DOM中移除主内容，而不是仅用display:none隐藏 ===
            // 将mainContent从DOM树中移除，存储在闭包变量中
            // 这样即使通过控制���也无法通过修改CSS来显示内容
            mainContent.remove();

            // 显示密码锁定遮罩
            lockOverlay.style.display = 'flex';

            // 使用 MutationObserver 防止通过控制台篡改锁定遮罩
            let unlocked = false;
            const protectObserver = new MutationObserver(() => {
              if (!unlocked) {
                // 确保锁定遮罩始终可见
                if (lockOverlay.style.display !== 'flex') {
                  lockOverlay.style.display = 'flex';
                }
                // 确保主内容未被重新添加到DOM
                if (document.getElementById('mainContent')) {
                  document.getElementById('mainContent').remove();
                }
              }
            });
            protectObserver.observe(lockOverlay, { attributes: true, attributeFilter: ['style', 'class'] });
            protectObserver.observe(document.body, { childList: true });

            const lockInput = document.getElementById('lockPasswordInput');
            const lockSubmit = document.getElementById('lockPasswordSubmit');
            const lockError = document.getElementById('lockPasswordError');

            const doUnlock = () => {
              const inputVal = lockInput.value;
              if (!inputVal) {
                lockError.textContent = t('password.msg.empty');
                return;
              }
              if (inputVal === pwdConfig.password) {
                // 标记已解锁，停止保护
                unlocked = true;
                protectObserver.disconnect();

                // 隐藏锁定遮罩
                lockOverlay.style.display = 'none';

                // 初始化管理器（会将mainContent重新添加到DOM）
                initManager();
              } else {
                lockError.textContent = t('password.lock.error');
                lockInput.value = '';
                lockInput.focus();
              }
            };

            lockSubmit.addEventListener('click', doUnlock);
            lockInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') doUnlock();
            });
            setTimeout(() => lockInput.focus(), 50);
          }
        }
      } catch (error) {
        // 密码配置获取失败，不锁定
      }
    }

    // 无需密码保护，直接初始化
    if (!needLock) {
      initManager();
    }
  } catch (e) {
    // 发生异常，不阻塞用户使用
    initManager();
  }
});
