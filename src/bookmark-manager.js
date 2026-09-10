import { initLocale, t as _t, translateDOM, getLocale, setLocale } from './i18n/index';
import { initTheme, setupThemeToggle } from './theme';
import { getConfig, setConfig } from './config-repository';
import { replaceBookmarkBarSafely } from './bookmark-service';
import { assertResponseOk, fetchJson, fetchWithTimeout, getErrorMessage } from './http';
import { escapeHtml, escapeRegExp, safeExternalUrl } from './sanitize';
import { showToast } from './toast';
import { getLocalPasswordPolicy, resolvePasswordPolicy, verifyPassword } from './password-service';

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

    void this.init().catch(error => {
      showToast(t('manager.localBookmarksLoadFailed', getErrorMessage(error)), 'error');
    });
  }

  async init() {
    await this.loadConfigFromIndexedDB();
    await this.loadBookmarks({ promptOnConflict: true });
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

  async loadBookmarks(options = {}) {
    const promptOnConflict = options.promptOnConflict === true;
    try {
      const localBookmarks = await this.getLocalBookmarksWithHiddenState();
      let resolvedBookmarks = this.cloneBookmarks(localBookmarks);

      if (this.isGiteeConfigured()) {
        try {
          const remoteBookmarks = await this.loadBookmarksFromGitee();
          if (Array.isArray(remoteBookmarks) && remoteBookmarks.length > 0) {
            if (this.areBookmarksEquivalent(localBookmarks, remoteBookmarks)) {
              // 数据一致时保持“本地 + 远程”的合并语义（结果会与任一方一致）
              resolvedBookmarks = this.mergeBookmarks(localBookmarks, remoteBookmarks);
            } else {
              if (promptOnConflict) {
                resolvedBookmarks = await this.resolveInitialSyncConflict(localBookmarks, remoteBookmarks);
              } else {
                // 非初始化场景静默合并，避免重复弹窗干扰用户
                resolvedBookmarks = this.mergeBookmarks(localBookmarks, remoteBookmarks);
              }
            }
          }
        } catch (error) {
          // 远程不可用时回退到本地
        }
      }

      this.bookmarks = resolvedBookmarks;
      this.saveBookmarksToStorage();
    } catch (error) {
      throw error;
    }
  }

  isGiteeConfigured() {
    return !!(
      this.giteeConfig &&
      this.giteeConfig.owner &&
      this.giteeConfig.repo &&
      this.giteeConfig.token &&
      this.giteeConfig.filePath
    );
  }

  syncBookmarksToGiteeInBackground() {
    if (!this.isGiteeConfigured()) return;
    void this.saveBookmarkTreeToGitee(this.bookmarks).catch(error => {
      showToast(t('manager.saveToGiteeFailedDetail', getErrorMessage(error)), 'error');
    });
  }

  cloneBookmarks(bookmarks) {
    return JSON.parse(JSON.stringify(Array.isArray(bookmarks) ? bookmarks : []));
  }

  normalizeBookmarkNodeForCompare(node) {
    if (!node || typeof node !== 'object') return null;
    const normalized = {
      title: node.title || '',
      hidden: node.hidden === true
    };

    if (node.url) {
      normalized.url = node.url;
    } else if (Array.isArray(node.children)) {
      normalized.children = node.children
        .map(child => this.normalizeBookmarkNodeForCompare(child))
        .filter(Boolean);
    } else {
      normalized.children = [];
    }

    return normalized;
  }

  normalizeBookmarksForCompare(bookmarks) {
    if (!Array.isArray(bookmarks)) return [];
    return bookmarks
      .map(node => this.normalizeBookmarkNodeForCompare(node))
      .filter(Boolean);
  }

  areBookmarksEquivalent(localBookmarks, remoteBookmarks) {
    const localNormalized = this.normalizeBookmarksForCompare(localBookmarks);
    const remoteNormalized = this.normalizeBookmarksForCompare(remoteBookmarks);
    return JSON.stringify(localNormalized) === JSON.stringify(remoteNormalized);
  }

  askSyncConflictResolution() {
    const remoteFileName = this.giteeConfig?.filePath || 'unknown';
    const message = t('manager.syncConflictPrompt', remoteFileName);
    const input = window.prompt(message, '3');
    const value = (input || '').trim().toLowerCase();

    if (!value) return 'merge';
    if (['1', 'local', 'l'].includes(value)) return 'local';
    if (['2', 'remote', 'r'].includes(value)) return 'remote';
    if (['3', 'merge', 'm'].includes(value)) return 'merge';

    showToast(t('manager.syncConflictInvalidChoice'), 'warning');
    return 'merge';
  }

  async resolveInitialSyncConflict(localBookmarks, remoteBookmarks) {
    const choice = this.askSyncConflictResolution();

    if (choice === 'local') {
      await this.saveBookmarkTreeToGitee(localBookmarks, {
        mode: 'overwrite',
        message: 'Sync conflict resolved by local browser bookmarks'
      });
      return this.cloneBookmarks(localBookmarks);
    }

    if (choice === 'remote') {
      await this.applyBookmarksToBrowser(remoteBookmarks);
      return this.cloneBookmarks(remoteBookmarks);
    }

    const merged = this.mergeBookmarks(localBookmarks, remoteBookmarks);
    await Promise.all([
      this.applyBookmarksToBrowser(merged),
      this.saveBookmarkTreeToGitee(merged, {
        mode: 'overwrite',
        message: 'Sync conflict resolved by merged bookmarks'
      })
    ]);
    return merged;
  }

  async getLocalBookmarksWithHiddenState() {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      const tree = await chrome.bookmarks.getTree();
      const chromeBookmarks = tree?.[0]?.children || [];

      if (typeof chrome !== 'undefined' && chrome.storage) {
        const storedData = await this.loadBookmarksFromStorage();
        if (storedData && storedData.length > 0) {
          // 总是以浏览器当前书签树为准，仅从存储数据恢复 hidden 状态
          return this.mergeHiddenState(chromeBookmarks, storedData);
        }
      }

      return chromeBookmarks;
    }

    return [
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
        if (chrome.runtime.lastError) {
          showToast(t('manager.localStateSaveFailed', chrome.runtime.lastError.message), 'error');
        }
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

    document.getElementById('refreshBtn').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = t('manager.refreshing');
      try {
        await this.loadBookmarks();
        // 重新渲染文件夹树
        this.renderFolderTree();
        // 重新渲染当前文件夹内容
        this.renderBookmarks();
        // 更新统计信息
        this.updateStats();
      } catch (error) {
        showToast(t('manager.refreshFailed', getErrorMessage(error)), 'error');
      } finally {
        button.disabled = false;
        button.textContent = button.dataset.i18n ? t(button.dataset.i18n) : t('btn.refresh');
      }
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
          target.parentElement.setAttribute('aria-expanded', String(children.style.display !== 'none'));
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
    this.folderTree.addEventListener('keydown', event => {
      const folderItem = event.target.closest('.folder-item');
      if (!folderItem) return;
      const folderItems = Array.from(this.folderTree.querySelectorAll('.folder-item'))
        .filter(item => item.offsetParent !== null);
      const currentIndex = folderItems.indexOf(folderItem);

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const folderId = folderItem.getAttribute('data-folder-id');
        if (folderId) this.selectFolder(folderId);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        folderItems[(currentIndex + offset + folderItems.length) % folderItems.length]?.focus();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const children = folderItem.nextElementSibling;
        const toggle = folderItem.querySelector('.folder-toggle');
        if (!children?.classList.contains('folder-children') || !toggle) return;
        event.preventDefault();
        const shouldExpand = event.key === 'ArrowRight';
        children.style.display = shouldExpand ? 'block' : 'none';
        toggle.textContent = shouldExpand ? '▼' : '▶';
        folderItem.setAttribute('aria-expanded', String(shouldExpand));
      }
    });

    // 使用事件委托处理书签项目的事件
    this.bookmarkTree.addEventListener('click', (e) => {
      const target = e.target;

      // 如果点击的是拖动句柄，不处理其他事件
      if (target.classList.contains('drag-handle')) {
        return;
      }

      if (target.classList.contains('action-btn-move-up') || target.classList.contains('action-btn-move-down')) {
        e.stopPropagation();
        const bookmarkId = target.getAttribute('data-bookmark-id');
        if (bookmarkId) {
          void this.moveBookmarkByOffset(bookmarkId, target.classList.contains('action-btn-move-up') ? -1 : 1);
        }
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

    this.setupAccessibleModals();
  }

  setupAccessibleModals() {
    const modals = Array.from(document.querySelectorAll('.modal'));
    const returnFocus = new WeakMap();
    const focusableSelector = 'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    modals.forEach((modal, index) => {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      const title = modal.querySelector('.modal-header h3');
      if (title) {
        if (!title.id) title.id = `${modal.id || `managerModal${index}`}Title`;
        modal.setAttribute('aria-labelledby', title.id);
      }
      const content = modal.querySelector('.modal-content');
      if (content && !content.hasAttribute('tabindex')) content.setAttribute('tabindex', '-1');

      modal.querySelectorAll('.close').forEach(closeButton => {
        closeButton.setAttribute('role', 'button');
        closeButton.setAttribute('tabindex', '0');
        closeButton.setAttribute('aria-label', t('btn.close'));
        closeButton.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            closeButton.click();
          }
        });
      });

      const observer = new MutationObserver(() => {
        const isOpen = getComputedStyle(modal).display !== 'none';
        if (isOpen) {
          if (!returnFocus.has(modal)) returnFocus.set(modal, document.activeElement);
          requestAnimationFrame(() => {
            const preferred = modal.querySelector('[autofocus], input:not([type="hidden"]), button:not(.close), .close, [tabindex="-1"]');
            preferred?.focus();
          });
        } else {
          const previous = returnFocus.get(modal);
          if (previous instanceof HTMLElement) previous.focus();
          returnFocus.delete(modal);
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
    });

    document.addEventListener('keydown', event => {
      const openModal = [...modals].reverse().find(modal => getComputedStyle(modal).display !== 'none');
      if (!openModal) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        const closeControl = openModal.querySelector('.close, [id^="cancel"]');
        closeControl?.click();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(openModal.querySelectorAll(focusableSelector))
        .filter(element => element instanceof HTMLElement && element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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

  async moveBookmarkByOffset(bookmarkId, offset) {
    const currentFolder = this.findFolderById(this.bookmarks, this.currentFolder?.id);
    const bookmarks = currentFolder?.children;
    if (!Array.isArray(bookmarks)) return;
    const currentIndex = bookmarks.findIndex(bookmark => bookmark.id === bookmarkId);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= bookmarks.length) {
      showToast(t('manager.moveBoundary'), 'info');
      return;
    }

    const [bookmark] = bookmarks.splice(currentIndex, 1);
    bookmarks.splice(targetIndex, 0, bookmark);
    try {
      if (typeof chrome !== 'undefined' && chrome.bookmarks?.move) {
        await chrome.bookmarks.move(bookmarkId, { parentId: currentFolder.id, index: targetIndex });
      }
      this.saveBookmarksToStorage();
      this.renderBookmarks();
      this.syncBookmarksToGiteeInBackground();
      showToast(t(offset < 0 ? 'manager.moveUpSuccess' : 'manager.moveDownSuccess'));
    } catch (error) {
      bookmarks.splice(targetIndex, 1);
      bookmarks.splice(currentIndex, 0, bookmark);
      this.renderBookmarks();
      showToast(t('manager.moveFailed', getErrorMessage(error)), 'error');
    }
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

  findBookmarkById(bookmarksOrId, maybeId) {
    // 兼容两种调用方式：
    // 1) findBookmarkById(bookmarks, id)
    // 2) findBookmarkById(id) -> 默认从 this.bookmarks 开始查找
    const bookmarks = Array.isArray(bookmarksOrId) ? bookmarksOrId : this.bookmarks;
    const id = Array.isArray(bookmarksOrId) ? maybeId : bookmarksOrId;

    if (!Array.isArray(bookmarks) || id === undefined || id === null) {
      return null;
    }

    for (const bookmark of bookmarks) {
      if (!bookmark || typeof bookmark !== 'object') continue;
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
              showToast(t('manager.scriptExecutionFailed') + error.message, 'error');
            });
          } else {
            showToast(t('manager.noWebPageTab') || '请先打开一个网页标签页，再执行脚本书签', 'warning');
          }
        });
      } catch (error) {
        showToast(t('manager.scriptExecutionFailed') + error.message, 'error');
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
        <div class="folder-item${hiddenClass}" data-folder-id="${this.escapeHtml(folder.id)}" role="treeitem" tabindex="0" aria-expanded="${hasChildren ? 'true' : 'false'}" style="padding-left: ${16 + level * 16}px;">
          ${hasChildren ? '<div class="folder-toggle">▼</div>' : '<div class="folder-toggle" style="visibility: hidden;">▼</div>'}
          <div class="folder-icon">📁</div>
          <div class="folder-name">${this.escapeHtml(folder.title)} ${hiddenIcon}</div>
        </div>
        ${hasChildren ? `
          <div class="folder-children" role="group" style="display: block;">
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
          <p>${this.escapeHtml(t('manager.searchNoResult', searchTerm))}</p>
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
          const safeUrl = safeExternalUrl(bookmark.url);
          clickHandler = safeUrl
            ? `href="${this.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer"`
            : 'href="#" aria-disabled="true"';
        }

        html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${this.escapeHtml(bookmark.id)}" draggable="true">
            <div class="drag-handle">⋮⋮</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t('manager.statBookmarks')}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${this.highlightSearchTerm(bookmark.title, searchTerm)} ${hiddenIcon}</a>
              <div class="bookmark-url">${this.escapeHtml(displayUrl)}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${t('btn.edit')}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${isHidden ? t('btn.show') : t('btn.hide')}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${t('btn.delete')}</button>
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
    const escapedText = this.escapeHtml(text);
    if (!searchTerm) return escapedText;
    const regex = new RegExp(`(${escapeRegExp(this.escapeHtml(searchTerm))})`, 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
  }

  renderSearchResultsInFolder(folder, searchTerm) {
    // 在该目录中搜索匹配的内容
    const searchResults = this.searchInBookmarks(folder.children || [], searchTerm.toLowerCase());

    if (searchResults.length === 0) {
      this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t('manager.noMatchInFolder')}</h3>
          <p>${this.escapeHtml(t('manager.noSearchResultInFolder', folder.title, searchTerm))}</p>
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
          const safeUrl = safeExternalUrl(bookmark.url);
          clickHandler = safeUrl
            ? `href="${this.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer"`
            : 'href="#" aria-disabled="true"';
        }

        html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${this.escapeHtml(bookmark.id)}" draggable="true">
            <div class="drag-handle">⋮⋮</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t('manager.statBookmarks')}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${this.escapeHtml(bookmark.title)} ${hiddenIcon}</a>
              <div class="bookmark-url">${this.escapeHtml(displayUrl)}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-move-up" data-bookmark-id="${this.escapeHtml(bookmark.id)}" title="${this.escapeHtml(t('manager.moveUp'))}" aria-label="${this.escapeHtml(t('manager.moveUp'))}">↑</button>
                <button class="action-btn action-btn-move-down" data-bookmark-id="${this.escapeHtml(bookmark.id)}" title="${this.escapeHtml(t('manager.moveDown'))}" aria-label="${this.escapeHtml(t('manager.moveDown'))}">↓</button>
                <button class="action-btn action-btn-edit" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${t('btn.edit')}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${isHidden ? t('btn.show') : t('btn.hide')}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${t('btn.delete')}</button>
              </div>
            </div>
          </div>
        `;
      } else if (bookmark.children) {
        // 子文件夹
        const hiddenClass = isHidden ? ' hidden-bookmark' : '';
        const hiddenIcon = isHidden ? '👁️‍🗨️' : '';
        html += `
          <div class="bookmark-item folder-item${hiddenClass}" data-folder-id="${this.escapeHtml(bookmark.id)}" data-bookmark-id="${this.escapeHtml(bookmark.id)}" draggable="true">
            <div class="drag-handle">⋮⋮</div>
            <div class="folder-icon">📁</div>
            <div class="bookmark-content">
              <div class="bookmark-title">${this.escapeHtml(bookmark.title)} ${hiddenIcon}</div>
              <div class="bookmark-url">${t('manager.folderItems', String(bookmark.children.length))}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-move-up" data-bookmark-id="${this.escapeHtml(bookmark.id)}" title="${this.escapeHtml(t('manager.moveUp'))}" aria-label="${this.escapeHtml(t('manager.moveUp'))}">↑</button>
                <button class="action-btn action-btn-move-down" data-bookmark-id="${this.escapeHtml(bookmark.id)}" title="${this.escapeHtml(t('manager.moveDown'))}" aria-label="${this.escapeHtml(t('manager.moveDown'))}">↓</button>
                <button class="action-btn action-btn-edit" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${t('btn.edit')}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${isHidden ? t('btn.show') : t('btn.hide')}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${this.escapeHtml(bookmark.id)}">${t('btn.delete')}</button>
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
      showToast(t('manager.editNotFound'), 'warning');
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
      showToast(t('manager.editTitleRequired'), 'warning');
      return;
    }

    // 查找书签数据
    const bookmark = this.findBookmarkById(id);
    if (!bookmark) {
      showToast(t('manager.editNotFound'), 'warning');
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
      this.syncBookmarksToGiteeInBackground();

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
      showToast(t('manager.editFailed'), 'error');
    }
  }

  removeBookmarkById(bookmarks, id) {
    if (!Array.isArray(bookmarks) || !id) {
      return false;
    }

    for (let i = 0; i < bookmarks.length; i++) {
      const item = bookmarks[i];
      if (!item) continue;

      if (item.id === id) {
        bookmarks.splice(i, 1);
        return true;
      }

      if (Array.isArray(item.children) && this.removeBookmarkById(item.children, id)) {
        return true;
      }
    }

    return false;
  }

  deleteBookmark(id) {
    if (confirm(t('confirm.deleteBookmark'))) {
      try {
        const removed = this.removeBookmarkById(this.bookmarks, id);
        if (!removed) {
          showToast(t('manager.editNotFound'), 'warning');
          return;
        }

        // 本地数据为准，避免使用已失效的 chrome bookmark id 导致报错
        this.saveBookmarksToStorage();
        this.syncBookmarksToGiteeInBackground();
        this.updateSystemBookmarks();

        this.renderFolderTree();
        if (this.currentFolder && !this.findFolderById(this.bookmarks, this.currentFolder.id)) {
          this.selectRootFolder();
        } else {
          this.renderBookmarks();
        }
        this.updateStats();
      } catch (error) {
        showToast(t('manager.deleteBookmarkFailed'), 'error');
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
          showToast(t('manager.importInvalidFormat'), 'warning');
          return;
        }

        // 验证数据基本结构
        if (!this.validateImportData(data)) {
          showToast(t('manager.importInvalidFormat'), 'warning');
          return;
        }

        // 统计导入数据信息
        const stats = this.analyzeImportData(data);
        this.pendingImportData = data;

        // 显示导入确认对话框
        this.showImportModal(stats);
      } catch (error) {
        showToast(t('manager.importInvalidFormat'), 'warning');
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
  async confirmImport() {
    if (!this.pendingImportData) return;

    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    const previousBookmarks = this.cloneBookmarks(this.bookmarks);
    const confirmButton = document.getElementById('confirmImportBtn');
    const originalLabel = confirmButton.textContent;
    confirmButton.disabled = true;
    confirmButton.textContent = t('manager.importing');

    try {
      if (importMode === 'overwrite') {
        // 覆盖模式：直接替换
        this.bookmarks = this.processImportedBookmarks(this.pendingImportData);
      } else {
        // 合并模式：将导入数据合并到当前书签
        this.bookmarks = this.mergeImportedBookmarks(this.bookmarks, this.pendingImportData);
      }

      // 浏览器书签替换带自动备份与失败回滚。
      await this.applyBookmarksToBrowser(this.bookmarks);
      if (this.isGiteeConfigured()) await this.saveBookmarkTreeToGitee(this.bookmarks);
      this.saveBookmarksToStorage();

      // 重新渲染
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();

      // 关闭对话框
      this.hideImportModal();

      showToast(t('manager.importSuccess'));
    } catch (error) {
      this.bookmarks = previousBookmarks;
      this.saveBookmarksToStorage();
      try {
        await this.applyBookmarksToBrowser(previousBookmarks);
      } catch (rollbackError) {
        console.error('Failed to restore bookmarks after import error:', rollbackError);
      }
      showToast(t('manager.importFailedDetail', getErrorMessage(error)), 'error');
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = confirmButton.dataset.i18n ? t(confirmButton.dataset.i18n) : originalLabel;
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
      this.syncBookmarksToGiteeInBackground();

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

  async applyBookmarksToBrowser(bookmarksTree) {
    if (!(typeof chrome !== 'undefined' && chrome.bookmarks)) {
      return;
    }

    const root = Array.isArray(bookmarksTree)
      ? (bookmarksTree.find(item => item && (item.title === '书签栏' || item.title === 'Bookmarks bar')) || bookmarksTree[0])
      : null;
    const sourceChildren = root?.children || [];
    const visibleBookmarks = this.filterVisibleBookmarks(this.cloneBookmarks(sourceChildren));

    await replaceBookmarkBarSafely(visibleBookmarks);
  }

  updateSystemBookmarks() {
    // 更新系统书签，过滤掉隐藏的书签（系统书签栏不显示隐藏书签）
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      void this.applyBookmarksToBrowser(this.bookmarks).catch(error => {
        showToast(t('manager.browserUpdateFailedDetail', getErrorMessage(error)), 'error');
      });
    }
  }

  filterVisibleBookmarks(bookmarks) {
    // 递归过滤掉隐藏的书签，且不修改原始数据
    if (!Array.isArray(bookmarks)) return [];

    return bookmarks.reduce((result, bookmark) => {
      if (!bookmark || bookmark.hidden === true) return result;

      if (Array.isArray(bookmark.children)) {
        const filteredChildren = this.filterVisibleBookmarks(bookmark.children);
        if (filteredChildren.length === 0) {
          return result;
        }
        result.push({
          ...bookmark,
          children: filteredChildren
        });
        return result;
      }

      result.push(bookmark);
      return result;
    }, []);
  }

  async loadBookmarksFromGitee() {
    if (!this.isGiteeConfigured()) throw new Error(t('manager.giteeConfigIncomplete'));
    const encodedPath = this.giteeConfig.filePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://gitee.com/api/v5/repos/${encodeURIComponent(this.giteeConfig.owner)}/${encodeURIComponent(this.giteeConfig.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(this.giteeConfig.branch)}`;
    const data = await fetchJson(url, {
      headers: { Authorization: `token ${this.giteeConfig.token}` },
    }, { fallbackMessage: t('manager.cannotGetFileContent') });
    if (!data?.content) throw new Error(t('manager.cannotGetFileContent'));
    const content = decodeURIComponent(escape(atob(data.content)));
    return JSON.parse(content);
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

  async saveBookmarkTreeToGitee(bookmarks, options = {}) {
    if (!this.isGiteeConfigured()) {
      throw new Error(t('manager.giteeConfigIncomplete'));
    }

    const mode = options.mode === 'overwrite' ? 'overwrite' : 'merge';
    const commitMessage = options.message || (
      mode === 'overwrite'
        ? 'Update bookmark tree - overwrite'
        : 'Update bookmark tree - merge hidden attributes'
    );

    const encodedPath = this.giteeConfig.filePath.split('/').map(encodeURIComponent).join('/');
    const apiUrl = `https://gitee.com/api/v5/repos/${encodeURIComponent(this.giteeConfig.owner)}/${encodeURIComponent(this.giteeConfig.repo)}/contents/${encodedPath}`;
    const refUrl = `${apiUrl}?ref=${encodeURIComponent(this.giteeConfig.branch)}`;

    const getResp = await fetchWithTimeout(refUrl, {
      method: 'GET',
      headers: { Authorization: `token ${this.giteeConfig.token}` },
    });
    await assertResponseOk(getResp, t('manager.cannotGetFileContent'));
    const data = await getResp.json();

    const sha = data?.sha;
    if (!sha) throw new Error(t('manager.cannotGetFileContent'));
    let finalBookmarks = bookmarks;

    if (mode === 'merge' && data?.content) {
      try {
        const remoteContent = decodeURIComponent(escape(atob(data.content)));
        const remoteBookmarks = JSON.parse(remoteContent);
        finalBookmarks = this.mergeBookmarks(bookmarks, remoteBookmarks);
      } catch (error) {
        console.warn('Remote bookmark data could not be parsed:', error);
        throw new Error(t('manager.remoteDataInvalid'));
      }
    }

    const content = JSON.stringify(finalBookmarks, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));
    const putResp = await fetchWithTimeout(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${this.giteeConfig.token}`,
      },
      body: JSON.stringify({ message: commitMessage, content: encodedContent, sha }),
    });
    await assertResponseOk(putResp, t('manager.saveToGiteeFailed'));
    return true;
  }




  async getConfigFromIndexedDB(fields) {
    return getConfig(fields);
  }

  async setConfigToIndexedDB(config) {
    return setConfig(config);
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
      const encodedPath = this.giteeConfig.filePath.split('/').map(encodeURIComponent).join('/');
      const apiUrl = `https://gitee.com/api/v5/repos/${encodeURIComponent(this.giteeConfig.owner)}/${encodeURIComponent(this.giteeConfig.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(this.giteeConfig.branch)}`;
      const data = await fetchJson(apiUrl, {
        headers: { Authorization: `token ${this.giteeConfig.token}` },
      }, { fallbackMessage: t('manager.cannotGetFileContent') });
      return data?.sha || null;
    } catch (error) {
      console.warn('Failed to load Gitee file SHA:', error);
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
      showToast(t('manager.configIncomplete'), 'warning');
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
      this.hideConfigModal();
      showToast(t('manager.configSaved'));
    } catch (error) {
      showToast(t('manager.configSaveFailed', getErrorMessage(error)), 'error');
    }
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
                   data-bookmark-id="${this.escapeHtml(item.id)}" ${checked}>
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
    return escapeHtml(text);
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
      showToast(t('manager.duplicateDeleteSuccess', String(ids.length)));
    } catch (error) {
      console.error('Delete duplicates failed:', error);
      showToast(t('manager.duplicateDeleteFailed'), 'error');
      // 重新执行检测刷新状态
      this.runDuplicateDetection();
    } finally {
      if (document.getElementById('duplicateModal').style.display !== 'none') {
        this.updateDuplicateSelectedCount();
      }
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
            ? `<input type="checkbox" class="linkcheck-checkbox" data-bookmark-id="${this.escapeHtml(item.id)}" ${checked}>`
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
      showToast(t('manager.linkCheckDeleteSuccess', String(ids.length)));
    } catch (error) {
      console.error('Delete broken links failed:', error);
      showToast(t('manager.linkCheckDeleteFailed'), 'error');
    } finally {
      this.updateLinkCheckSelectedCount();
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

  const lockInput = document.getElementById('lockPasswordInput');
  const lockSubmit = document.getElementById('lockPasswordSubmit');
  const lockError = document.getElementById('lockPasswordError');

  function activatePasswordLock(policy) {
    mainContent.remove();
    lockOverlay.style.display = 'flex';
    let unlocked = false;
    const protectObserver = new MutationObserver(() => {
      if (!unlocked) {
        if (lockOverlay.style.display !== 'flex') lockOverlay.style.display = 'flex';
        document.getElementById('mainContent')?.remove();
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
          initManager();
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
    lockInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') void doUnlock();
    });
    setTimeout(() => lockInput.focus(), 50);
  }

  // 非 popup 跳转时刷新远程策略；网络故障时回退到本地策略，避免绕过已启用的锁定。
  try {
    const config = await getConfig(['giteeToken', 'giteeOwner', 'giteeRepo', 'giteeBranch', 'giteeFilePath']);
    const filePath = config.giteeFilePath || '';
    const bookmarkDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
    const location = config.giteeToken && config.giteeOwner && config.giteeRepo
      ? {
          token: config.giteeToken,
          owner: config.giteeOwner,
          repo: config.giteeRepo,
          branch: config.giteeBranch || 'master',
          bookmarkDir,
        }
      : undefined;
    const policy = await resolvePasswordPolicy(location);
    if (policy?.enabled) activatePasswordLock(policy);
    else initManager();
  } catch (error) {
    const localPolicy = await getLocalPasswordPolicy().catch(() => null);
    if (localPolicy?.enabled) activatePasswordLock(localPolicy);
    else initManager();
  }
});
