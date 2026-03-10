(() => {
  // src/crypto.ts
  var CRYPTO_KEY_NAME = "_bm_encryption_key";
  var cachedKey = null;
  async function getEncryptionKey() {
    if (cachedKey) return cachedKey;
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([CRYPTO_KEY_NAME], async (result) => {
        try {
          if (result[CRYPTO_KEY_NAME]) {
            const key = await crypto.subtle.importKey(
              "jwk",
              result[CRYPTO_KEY_NAME],
              { name: "AES-GCM" },
              true,
              ["encrypt", "decrypt"]
            );
            cachedKey = key;
            resolve(key);
          } else {
            const key = await crypto.subtle.generateKey(
              { name: "AES-GCM", length: 256 },
              true,
              ["encrypt", "decrypt"]
            );
            const jwk = await crypto.subtle.exportKey("jwk", key);
            chrome.storage.local.set({ [CRYPTO_KEY_NAME]: jwk }, () => {
              cachedKey = key;
              resolve(key);
            });
          }
        } catch (e) {
          reject(e);
        }
      });
    });
  }
  async function encrypt(plaintext) {
    if (!plaintext) return plaintext;
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );
    const ciphertextArray = new Uint8Array(ciphertext);
    const combined = new Uint8Array(iv.length + ciphertextArray.length);
    combined.set(iv);
    combined.set(ciphertextArray, iv.length);
    let binary = "";
    for (const byte of combined) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  async function decrypt(encryptedBase64) {
    if (!encryptedBase64) return encryptedBase64;
    const key = await getEncryptionKey();
    const binaryStr = atob(encryptedBase64);
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      combined[i] = binaryStr.charCodeAt(i);
    }
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }
  async function decryptSafe(value) {
    if (!value) return value;
    try {
      return await decrypt(value);
    } catch {
      return value;
    }
  }

  // src/bookmark-manager.js
  var t = (key, ...args) => {
    if (window.__i18n && window.__i18n.t) {
      return window.__i18n.t(key, ...args);
    }
    return key;
  };
  var BookmarkManager = class {
    constructor() {
      this.bookmarks = [];
      this.filteredBookmarks = [];
      this.currentFolder = null;
      this.searchInput = document.getElementById("searchInput");
      this.bookmarkTree = document.getElementById("bookmarkTree");
      this.folderTree = document.getElementById("folderTree");
      this.panelTitle = document.getElementById("panelTitle");
      this.backButton = document.getElementById("backButton");
      this.showHidden = true;
      this.currentFilter = "all";
      this.draggedElement = null;
      this.dragOverElement = null;
      this.pendingImportData = null;
      this.currentDuplicateGroups = [];
      this.linkCheckResults = [];
      this.linkCheckRunning = false;
      this.linkCheckCurrentFilter = "all";
      this.giteeConfig = {
        owner: "",
        repo: "",
        token: "",
        branch: "master",
        filePath: "hidden-bookmarks.json"
      };
      this.init();
    }
    async init() {
      await this.loadConfigFromIndexedDB();
      await this.loadBookmarks();
      this.setupEventListeners();
      this.renderFolderTree();
      this.updateStats();
      this.applyFilter("all");
      this.selectRootFolder();
      this.renderBookmarks();
    }
    async loadBookmarks() {
      try {
        if (this.giteeConfig && this.giteeConfig.owner && this.giteeConfig.repo && this.giteeConfig.token) {
          try {
            const data = await this.loadBookmarksFromGitee();
            if (data && data.length > 0) {
              this.bookmarks = data;
              this.saveBookmarksToStorage();
              return;
            }
          } catch (error) {
          }
        }
        if (typeof chrome !== "undefined" && chrome.bookmarks) {
          const tree = await chrome.bookmarks.getTree();
          const chromeBookmarks = tree[0].children || [];
          if (typeof chrome !== "undefined" && chrome.storage) {
            const storedData = await this.loadBookmarksFromStorage();
            if (storedData && storedData.length > 0) {
              if (this.validateStoredBookmarks(storedData, chromeBookmarks)) {
                this.bookmarks = storedData;
                return;
              } else {
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
          this.bookmarks = [
            {
              id: "1",
              title: t("manager.sampleFolder"),
              children: [
                {
                  id: "2",
                  title: "Google",
                  url: "https://www.google.com"
                },
                {
                  id: "3",
                  title: "GitHub",
                  url: "https://github.com"
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
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.get(["bookmarkManagerData"], (result) => {
            resolve(result.bookmarkManagerData || null);
          });
        } else {
          resolve(null);
        }
      });
    }
    // 验证存储的书签数据是否仍然有效
    validateStoredBookmarks(storedData, chromeBookmarks) {
      const chromeIds = /* @__PURE__ */ new Set();
      const collectIds = (bookmarks) => {
        bookmarks.forEach((bookmark) => {
          chromeIds.add(bookmark.id);
          if (bookmark.children) {
            collectIds(bookmark.children);
          }
        });
      };
      collectIds(chromeBookmarks);
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
      const hiddenStateMap = /* @__PURE__ */ new Map();
      const collectHiddenState = (bookmarks) => {
        bookmarks.forEach((bookmark) => {
          if (bookmark.hidden !== void 0) {
            hiddenStateMap.set(bookmark.id, bookmark.hidden);
          }
          if (bookmark.children) {
            collectHiddenState(bookmark.children);
          }
        });
      };
      collectHiddenState(storedData);
      const mergeRecursive = (chromeItems) => {
        return chromeItems.map((item) => {
          const merged = { ...item };
          if (hiddenStateMap.has(item.id)) {
            merged.hidden = hiddenStateMap.get(item.id);
          }
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
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.set({ "bookmarkManagerData": this.bookmarks }, () => {
        });
      }
    }
    setupEventListeners() {
      this.searchInput.addEventListener("input", (e) => {
        this.filterBookmarks(e.target.value);
      });
      document.getElementById("filterSelect").addEventListener("change", (e) => {
        this.applyFilter(e.target.value);
      });
      document.getElementById("refreshBtn").addEventListener("click", () => {
        this.loadBookmarks().then(() => {
          this.renderFolderTree();
          this.renderBookmarks();
          this.updateStats();
        });
      });
      document.getElementById("exportBtn").addEventListener("click", () => {
        this.exportBookmarks();
      });
      document.getElementById("importBtn").addEventListener("click", () => {
        this.triggerImport();
      });
      document.getElementById("importFileInput").addEventListener("change", (e) => {
        this.handleImportFile(e);
      });
      document.getElementById("closeImportModal").addEventListener("click", () => {
        this.hideImportModal();
      });
      document.getElementById("cancelImportBtn").addEventListener("click", () => {
        this.hideImportModal();
      });
      document.getElementById("confirmImportBtn").addEventListener("click", () => {
        this.confirmImport();
      });
      document.getElementById("detectDuplicatesBtn").addEventListener("click", () => {
        this.showDuplicateModal();
      });
      document.getElementById("closeDuplicateModal").addEventListener("click", () => {
        this.hideDuplicateModal();
      });
      document.getElementById("cancelDuplicateBtn").addEventListener("click", () => {
        this.hideDuplicateModal();
      });
      document.getElementById("deleteDuplicatesBtn").addEventListener("click", () => {
        this.deleteSelectedDuplicates();
      });
      document.getElementById("duplicateSelectAllBtn").addEventListener("click", () => {
        this.toggleAllDuplicateCheckboxes(true);
      });
      document.getElementById("duplicateDeselectAllBtn").addEventListener("click", () => {
        this.toggleAllDuplicateCheckboxes(false);
      });
      document.querySelectorAll('input[name="duplicateMode"]').forEach((radio) => {
        radio.addEventListener("change", () => {
          this.runDuplicateDetection();
        });
      });
      document.getElementById("stripQueryParam").addEventListener("change", () => {
        this.runDuplicateDetection();
      });
      document.getElementById("linkCheckBtn").addEventListener("click", () => {
        this.showLinkCheckModal();
      });
      document.getElementById("closeLinkCheckModal").addEventListener("click", () => {
        this.hideLinkCheckModal();
      });
      document.getElementById("cancelLinkCheckBtn").addEventListener("click", () => {
        this.hideLinkCheckModal();
      });
      document.getElementById("linkCheckStartBtn").addEventListener("click", () => {
        this.startLinkCheck();
      });
      document.getElementById("linkCheckStopBtn").addEventListener("click", () => {
        this.stopLinkCheck();
      });
      document.getElementById("linkCheckFilter").addEventListener("change", (e) => {
        this.linkCheckCurrentFilter = e.target.value;
        this.renderLinkCheckResults();
      });
      document.getElementById("linkCheckSelectAllBrokenBtn").addEventListener("click", () => {
        this.toggleLinkCheckCheckboxes("broken");
      });
      document.getElementById("linkCheckDeselectAllBtn").addEventListener("click", () => {
        this.toggleLinkCheckCheckboxes("none");
      });
      document.getElementById("deleteBrokenLinksBtn").addEventListener("click", () => {
        this.deleteSelectedBrokenLinks();
      });
      document.getElementById("configBtn").addEventListener("click", () => {
        this.showConfigModal();
      });
      document.getElementById("closeConfigModal").addEventListener("click", () => {
        this.hideConfigModal();
      });
      document.getElementById("cancelConfigBtn").addEventListener("click", () => {
        this.hideConfigModal();
      });
      document.getElementById("saveConfigBtn").addEventListener("click", () => {
        this.saveConfig();
      });
      document.getElementById("closeEditModal").addEventListener("click", () => {
        this.hideEditModal();
      });
      document.getElementById("cancelEditBtn").addEventListener("click", () => {
        this.hideEditModal();
      });
      document.getElementById("saveEditBtn").addEventListener("click", () => {
        this.saveEditBookmark();
      });
      document.getElementById("editBookmarkTitle").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.saveEditBookmark();
        }
      });
      document.getElementById("editBookmarkUrl").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          this.saveEditBookmark();
        }
      });
      this.backButton.addEventListener("click", (e) => {
        e.preventDefault();
        const parentId = this.backButton.getAttribute("data-parent-id");
        if (parentId) {
          this.selectFolder(parentId);
          this.syncLeftSidebarSelection(parentId);
        }
      });
      this.setupDragAndDrop();
      this.folderTree.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("folder-toggle")) {
          const children = target.parentElement.nextElementSibling;
          if (children) {
            children.style.display = children.style.display === "none" ? "block" : "none";
            target.textContent = target.textContent === "\u25BC" ? "\u25B6" : "\u25BC";
          }
        }
        if (target.classList.contains("folder-item") || target.closest(".folder-item")) {
          const folderItem = target.classList.contains("folder-item") ? target : target.closest(".folder-item");
          const folderId = folderItem.getAttribute("data-folder-id");
          if (folderId) {
            this.selectFolder(folderId);
          }
        }
      });
      this.bookmarkTree.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("drag-handle")) {
          return;
        }
        if (target.classList.contains("action-btn-edit")) {
          e.stopPropagation();
          const bookmarkId = target.getAttribute("data-bookmark-id");
          if (bookmarkId) {
            this.editBookmark(bookmarkId);
          }
          return;
        }
        if (target.classList.contains("action-btn-hide")) {
          e.stopPropagation();
          const bookmarkId = target.getAttribute("data-bookmark-id");
          if (bookmarkId) {
            this.toggleBookmarkVisibility(bookmarkId);
          }
          return;
        }
        if (target.classList.contains("action-btn-delete")) {
          e.stopPropagation();
          const bookmarkId = target.getAttribute("data-bookmark-id");
          if (bookmarkId) {
            this.deleteBookmark(bookmarkId);
          }
          return;
        }
        if (target.classList.contains("script-bookmark") || target.closest(".script-bookmark")) {
          e.stopPropagation();
          const scriptElement = target.classList.contains("script-bookmark") ? target : target.closest(".script-bookmark");
          const scriptUrl = decodeURIComponent(scriptElement.getAttribute("data-script-url"));
          this.executeScript(scriptUrl);
          return;
        }
        if ((target.classList.contains("folder-item") || target.closest(".folder-item")) && !target.classList.contains("drag-handle")) {
          const folderItem = target.classList.contains("folder-item") ? target : target.closest(".folder-item");
          const folderId = folderItem.getAttribute("data-folder-id");
          if (folderId) {
            this.selectFolder(folderId);
            this.syncLeftSidebarSelection(folderId);
          }
        }
      });
    }
    setupDragAndDrop() {
      this.bookmarkTree.addEventListener("dragstart", (e) => {
        const bookmarkItem = e.target.closest(".bookmark-item");
        if (bookmarkItem) {
          this.resetDragState();
          this.draggedElement = bookmarkItem;
          bookmarkItem.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/html", bookmarkItem.outerHTML);
        }
      });
      this.bookmarkTree.addEventListener("dragend", (e) => {
        const bookmarkItem = e.target.closest(".bookmark-item");
        if (bookmarkItem) {
          bookmarkItem.classList.remove("dragging");
          this.draggedElement = null;
          this.dragOverElement = null;
          this.clearDragOverClasses();
        }
      });
      this.bookmarkTree.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const draggedOver = e.target.closest(".bookmark-item");
        if (draggedOver && draggedOver !== this.draggedElement) {
          this.clearDragOverClasses();
          this.dragOverElement = draggedOver;
          const rect = draggedOver.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          if (e.clientY < midpoint) {
            draggedOver.classList.add("drag-over");
          } else {
            draggedOver.classList.add("drag-over-bottom");
          }
        }
      });
      this.bookmarkTree.addEventListener("dragleave", (e) => {
        if (!e.target.closest(".bookmark-item")) {
          this.clearDragOverClasses();
        }
      });
      this.bookmarkTree.addEventListener("drop", (e) => {
        e.preventDefault();
        if (this.draggedElement && this.dragOverElement) {
          this.handleDrop(this.draggedElement, this.dragOverElement, e);
        }
        this.draggedElement = null;
        this.dragOverElement = null;
        this.clearDragOverClasses();
      });
    }
    resetDragState() {
      this.draggedElement = null;
      this.dragOverElement = null;
      this.clearDragOverClasses();
      const elements = this.bookmarkTree.querySelectorAll(".bookmark-item");
      elements.forEach((el) => {
        el.classList.remove("dragging", "drag-over", "drag-over-bottom");
      });
    }
    clearDragOverClasses() {
      const elements = this.bookmarkTree.querySelectorAll(".bookmark-item");
      elements.forEach((el) => {
        el.classList.remove("drag-over", "drag-over-bottom");
      });
      this.dragOverElement = null;
    }
    handleDrop(draggedElement, dropTarget, event) {
      const draggedId = draggedElement.getAttribute("data-bookmark-id");
      const dropTargetId = dropTarget.getAttribute("data-bookmark-id");
      if (draggedId === dropTargetId) return;
      const currentFolder = this.findFolderById(this.bookmarks, this.currentFolder.id);
      if (!currentFolder || !currentFolder.children) return;
      const bookmarks = currentFolder.children;
      const draggedIndex = bookmarks.findIndex((b) => b.id === draggedId);
      const dropIndex = bookmarks.findIndex((b) => b.id === dropTargetId);
      if (draggedIndex === -1 || dropIndex === -1) return;
      const rect = dropTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const insertIndex = event.clientY < midpoint ? dropIndex : dropIndex + 1;
      const draggedBookmark = bookmarks.splice(draggedIndex, 1)[0];
      const adjustedInsertIndex = insertIndex > draggedIndex ? insertIndex - 1 : insertIndex;
      bookmarks.splice(adjustedInsertIndex, 0, draggedBookmark);
      this.updateBookmarkOrder(draggedId, dropTargetId, insertIndex > dropIndex);
      this.saveBookmarksToStorage();
      setTimeout(() => {
        this.renderBookmarks();
      }, 50);
    }
    async updateBookmarkOrder(draggedId, dropTargetId, insertAfter) {
      try {
        const parentId = this.currentFolder.id;
        const currentFolder = this.findFolderById(this.bookmarks, this.currentFolder.id);
        if (!currentFolder || !currentFolder.children) return;
        const bookmarks = currentFolder.children;
        const dropIndex = bookmarks.findIndex((b) => b.id === dropTargetId);
        if (dropIndex === -1) return;
        const newIndex = insertAfter ? dropIndex + 1 : dropIndex;
        await chrome.bookmarks.move(draggedId, {
          parentId,
          index: newIndex
        });
      } catch (error) {
        console.error("Failed to update bookmark order:", error);
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
      return currentFolder.children.findIndex((b) => b.id === bookmarkId);
    }
    filterBookmarks(searchTerm) {
      this.renderBookmarks();
      this.renderFolderTree();
    }
    applyFilter(filterType) {
      this.currentFilter = filterType;
      switch (filterType) {
        case "all":
          this.filteredBookmarks = this.bookmarks;
          break;
        case "visible":
          this.filteredBookmarks = this.filterVisibleBookmarks(this.bookmarks);
          break;
        case "hidden":
          this.filteredBookmarks = this.filterHiddenOnlyBookmarks(this.bookmarks);
          break;
      }
      this.renderFolderTree();
      this.renderBookmarks();
      this.updateStats();
    }
    searchInBookmarks(bookmarks, searchTerm) {
      const results = [];
      for (const bookmark of bookmarks) {
        if (bookmark.children) {
          const matchingChildren = this.searchInBookmarks(bookmark.children, searchTerm);
          if (matchingChildren.length > 0) {
            results.push({
              ...bookmark,
              children: matchingChildren
            });
          }
        } else if (bookmark.url) {
          if (bookmark.title.toLowerCase().includes(searchTerm) || bookmark.url.toLowerCase().includes(searchTerm)) {
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
          if (searchTerm) {
            const hasSearchResults = this.hasSearchResults(bookmark, searchTerm.toLowerCase());
            if (!hasSearchResults) {
              continue;
            }
          }
          if (this.currentFilter === "hidden") {
            const hasHiddenContent = bookmark.hidden || this.hasHiddenContent(bookmark.children);
            if (!hasHiddenContent) {
              continue;
            }
          } else if (this.currentFilter === "visible") {
            if (bookmark.hidden) {
              continue;
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
          return true;
        }
        if (child.children && this.hasHiddenContent(child.children)) {
          return true;
        }
      }
      return false;
    }
    // 检查目录是否包含搜索结果
    hasSearchResults(bookmark, searchTerm) {
      if (bookmark.title.toLowerCase().includes(searchTerm)) {
        return true;
      }
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
        const faviconUrls = [
          `https://www.google.com/s2/favicons?domain=${domain}&sz=16`,
          `https://favicons.githubusercontent.com/${domain}`,
          `https://${domain}/favicon.ico`,
          `https://${domain}/favicon.png`,
          `https://${domain}/apple-touch-icon.png`
        ];
        return faviconUrls[0];
      } catch (error) {
        return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=";
      }
    }
    // 执行脚本书签
    executeScript(scriptUrl) {
      if (scriptUrl.startsWith("javascript:")) {
        const script = scriptUrl.substring(11);
        try {
          const newWindow = window.open("", "_blank");
          if (newWindow) {
            newWindow.document.write(`
            <html>
              <head><title>${t("manager.scriptExecution")}</title></head>
              <body>
                <h3>${t("manager.scriptExecutionResult")}</h3>
                <div id="result"></div>
                <script>
                  try {
                    const result = ${script};
                    document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                  } catch (error) {
                    document.getElementById('result').innerHTML = '<p style="color: #f44336;">${t("manager.executionError")}' + error.message + '</p>';
                  }
                <\/script>
              </body>
            </html>
          `);
            newWindow.document.close();
          }
        } catch (error) {
          alert(t("manager.scriptExecutionFailed") + error.message);
        }
      } else if (scriptUrl.startsWith("data:")) {
        window.open(scriptUrl, "_blank");
      }
    }
    renderFolderList(folders, level = 0) {
      let html = "";
      for (const folder of folders) {
        const isHidden = folder.hidden || false;
        const hiddenIcon = isHidden ? "\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F" : "";
        const hiddenClass = isHidden ? " hidden-folder" : "";
        const hasChildren = folder.children && folder.children.length > 0;
        html += `
        <div class="folder-item${hiddenClass}" data-folder-id="${folder.id}" style="padding-left: ${16 + level * 16}px;">
          ${hasChildren ? '<div class="folder-toggle">\u25BC</div>' : '<div class="folder-toggle" style="visibility: hidden;">\u25BC</div>'}
          <div class="folder-icon">\u{1F4C1}</div>
          <div class="folder-name">${folder.title} ${hiddenIcon}</div>
        </div>
        ${hasChildren ? `
          <div class="folder-children" style="display: block;">
            ${this.renderFolderList(folder.children, level + 1)}
          </div>
        ` : ""}
      `;
      }
      return html;
    }
    selectRootFolder() {
      const bookmarkBar = this.bookmarks.find(
        (bookmark) => bookmark.title === "\u4E66\u7B7E\u680F" || bookmark.title === "Bookmarks bar"
      );
      if (bookmarkBar) {
        this.selectFolder(bookmarkBar.id);
      } else if (this.bookmarks.length > 0) {
        this.selectFolder(this.bookmarks[0].id);
      }
    }
    selectFolder(folderId) {
      document.querySelectorAll(".folder-item").forEach((item) => {
        item.classList.remove("active");
      });
      const selectedItem = document.querySelector(`[data-folder-id="${folderId}"]`);
      if (selectedItem) {
        selectedItem.classList.add("active");
      }
      const folder = this.findFolderById(this.bookmarks, folderId);
      if (folder) {
        this.currentFolder = folder;
        this.panelTitle.textContent = folder.title;
        const searchTerm = this.searchInput.value.trim();
        if (searchTerm) {
          this.renderSearchResultsInFolder(folder, searchTerm);
        } else {
          this.renderBookmarks();
        }
      }
    }
    syncLeftSidebarSelection(folderId) {
      document.querySelectorAll(".sidebar .folder-item").forEach((item) => {
        item.classList.remove("active");
      });
      const leftSidebarItem = document.querySelector(`.sidebar [data-folder-id="${folderId}"]`);
      if (leftSidebarItem) {
        leftSidebarItem.classList.add("active");
        this.ensureParentFoldersExpanded(leftSidebarItem);
      }
    }
    ensureParentFoldersExpanded(element) {
      let parent = element.parentElement;
      while (parent && parent !== this.folderTree) {
        if (parent.classList.contains("folder-children")) {
          parent.style.display = "block";
          const toggle = parent.previousElementSibling?.querySelector(".folder-toggle");
          if (toggle) {
            toggle.textContent = "\u25BC";
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
      if (searchTerm) {
        this.renderSearchResults(searchTerm);
        return;
      }
      if (!this.currentFolder) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t("manager.selectFolderHint")}</h3>
          <p>${t("manager.selectFolderDesc")}</p>
        </div>
      `;
        return;
      }
      const parentFolder = this.findParentFolder(this.bookmarks, this.currentFolder.id);
      if (parentFolder) {
        this.backButton.style.display = "flex";
        this.backButton.setAttribute("data-parent-id", parentFolder.id);
        this.backButton.querySelector(".back-text").textContent = `${t("btn.back")} ${parentFolder.title}`;
      } else {
        this.backButton.style.display = "none";
      }
      const folder = this.findFolderById(this.bookmarks, this.currentFolder.id);
      if (!folder) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t("manager.folderNotExist")}</h3>
          <p>${t("manager.folderMayBeDeleted")}</p>
        </div>
      `;
        return;
      }
      this.currentFolder = folder;
      const bookmarks = this.currentFolder.children || [];
      if (bookmarks.length === 0) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t("manager.folderEmpty")}</h3>
          <p>${t("manager.folderNoBookmarks")}</p>
        </div>
      `;
        return;
      }
      let filteredBookmarks = bookmarks;
      switch (this.currentFilter) {
        case "visible":
          filteredBookmarks = this.filterVisibleBookmarks(bookmarks);
          break;
        case "hidden":
          filteredBookmarks = this.filterHiddenOnlyBookmarks(bookmarks);
          break;
        case "all":
        default:
          filteredBookmarks = bookmarks;
          break;
      }
      if (filteredBookmarks.length === 0) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t("manager.noMatchingBookmarks")}</h3>
          <p>${t("manager.noBookmarksInFilter")}</p>
        </div>
      `;
        return;
      }
      this.bookmarkTree.innerHTML = this.renderBookmarkList(filteredBookmarks);
    }
    renderSearchResults(searchTerm) {
      const rootBookmarks = this.bookmarks[0]?.children || [];
      let filteredBookmarks = rootBookmarks;
      switch (this.currentFilter) {
        case "visible":
          filteredBookmarks = this.filterVisibleBookmarks(rootBookmarks);
          break;
        case "hidden":
          filteredBookmarks = this.filterHiddenOnlyBookmarks(rootBookmarks);
          break;
        case "all":
        default:
          filteredBookmarks = rootBookmarks;
          break;
      }
      const searchResults = this.searchInBookmarks(filteredBookmarks, searchTerm.toLowerCase());
      if (searchResults.length === 0) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t("manager.noSearchResults")}</h3>
          <p>${t("manager.searchNoResult", searchTerm)}</p>
        </div>
      `;
        document.querySelectorAll(".folder-item").forEach((item) => {
          item.classList.remove("active");
        });
        this.panelTitle.textContent = t("manager.searchResults");
        return;
      }
      this.bookmarkTree.innerHTML = this.renderSearchResultsList(searchResults, searchTerm);
      this.panelTitle.textContent = `${t("manager.searchResults")} (${searchResults.length} ${t("manager.items")})`;
      document.querySelectorAll(".folder-item").forEach((item) => {
        item.classList.remove("active");
      });
    }
    renderSearchResultsList(bookmarks, searchTerm) {
      let html = "";
      for (const bookmark of bookmarks) {
        if (bookmark.url) {
          const isHidden = bookmark.hidden || false;
          const hiddenClass = isHidden ? " hidden-bookmark" : "";
          const hiddenIcon = isHidden ? "\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F" : "";
          const isJavaScript = bookmark.url.startsWith("javascript:");
          const isDataUrl = bookmark.url.startsWith("data:");
          let faviconUrl, displayUrl, clickHandler;
          if (isJavaScript || isDataUrl) {
            faviconUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=";
            displayUrl = t("manager.scriptBookmark");
            clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
          } else {
            faviconUrl = this.getFaviconUrl(bookmark.url);
            displayUrl = bookmark.url;
            clickHandler = `href="${bookmark.url}" target="_blank"`;
          }
          html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">\u22EE\u22EE</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t("manager.statBookmarks")}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${this.highlightSearchTerm(bookmark.title, searchTerm)} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t("btn.edit")}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t("btn.show") : t("btn.hide")}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t("btn.delete")}</button>
              </div>
            </div>
          </div>
        `;
        } else if (bookmark.children) {
          html += this.renderSearchResultsList(bookmark.children, searchTerm);
        }
      }
      return html;
    }
    highlightSearchTerm(text, searchTerm) {
      if (!searchTerm) return text;
      const regex = new RegExp(`(${searchTerm})`, "gi");
      return text.replace(regex, "<mark>$1</mark>");
    }
    renderSearchResultsInFolder(folder, searchTerm) {
      const searchResults = this.searchInBookmarks(folder.children || [], searchTerm.toLowerCase());
      if (searchResults.length === 0) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t("manager.noMatchInFolder")}</h3>
          <p>${t("manager.noSearchResultInFolder", folder.title, searchTerm)}</p>
        </div>
      `;
        this.panelTitle.textContent = `${folder.title} - ${t("manager.searchResults")} (0 ${t("manager.items")})`;
        return;
      }
      this.bookmarkTree.innerHTML = this.renderSearchResultsList(searchResults, searchTerm);
      this.panelTitle.textContent = `${folder.title} - ${t("manager.searchResults")} (${searchResults.length} ${t("manager.items")})`;
    }
    renderBookmarkList(bookmarks) {
      let html = "";
      for (const bookmark of bookmarks) {
        const isHidden = bookmark.hidden || false;
        if (bookmark.url) {
          const hiddenClass = isHidden ? " hidden-bookmark" : "";
          const hiddenIcon = isHidden ? "\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F" : "";
          const isJavaScript = bookmark.url.startsWith("javascript:");
          const isDataUrl = bookmark.url.startsWith("data:");
          let faviconUrl, displayUrl, clickHandler;
          if (isJavaScript || isDataUrl) {
            faviconUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo=";
            displayUrl = t("manager.scriptBookmark");
            clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
          } else {
            faviconUrl = this.getFaviconUrl(bookmark.url);
            displayUrl = bookmark.url;
            clickHandler = `href="${bookmark.url}" target="_blank"`;
          }
          html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">\u22EE\u22EE</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t("manager.statBookmarks")}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${bookmark.title} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t("btn.edit")}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t("btn.show") : t("btn.hide")}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t("btn.delete")}</button>
              </div>
            </div>
          </div>
        `;
        } else if (bookmark.children) {
          const hiddenClass = isHidden ? " hidden-bookmark" : "";
          const hiddenIcon = isHidden ? "\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F" : "";
          html += `
          <div class="bookmark-item folder-item${hiddenClass}" data-folder-id="${bookmark.id}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">\u22EE\u22EE</div>
            <div class="folder-icon">\u{1F4C1}</div>
            <div class="bookmark-content">
              <div class="bookmark-title">${bookmark.title} ${hiddenIcon}</div>
              <div class="bookmark-url">${t("manager.folderItems", String(bookmark.children.length))}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t("btn.edit")}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t("btn.show") : t("btn.hide")}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t("btn.delete")}</button>
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
      document.getElementById("totalBookmarks").textContent = stats.totalBookmarks;
      document.getElementById("totalFolders").textContent = stats.totalFolders;
      document.getElementById("recentBookmarks").textContent = stats.recentBookmarks;
    }
    calculateStats(bookmarks) {
      let totalBookmarks = 0;
      let totalFolders = 0;
      let recentBookmarks = 0;
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
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
      const bookmark = this.findBookmarkById(id);
      if (!bookmark) {
        alert(t("manager.editNotFound"));
        return;
      }
      const isFolder = !!bookmark.children;
      const modalTitle = document.getElementById("editModalTitle");
      modalTitle.textContent = isFolder ? t("manager.editFolder") : t("manager.editBookmark");
      document.getElementById("editBookmarkId").value = id;
      document.getElementById("editBookmarkTitle").value = bookmark.title || "";
      document.getElementById("editBookmarkUrl").value = bookmark.url || "";
      const urlGroup = document.getElementById("editUrlGroup");
      urlGroup.style.display = isFolder ? "none" : "block";
      document.getElementById("editModal").style.display = "flex";
      setTimeout(() => {
        document.getElementById("editBookmarkTitle").focus();
      }, 100);
    }
    hideEditModal() {
      document.getElementById("editModal").style.display = "none";
    }
    saveEditBookmark() {
      const id = document.getElementById("editBookmarkId").value;
      const newTitle = document.getElementById("editBookmarkTitle").value.trim();
      const newUrl = document.getElementById("editBookmarkUrl").value.trim().replace(/[\r\n]/g, "");
      if (!newTitle) {
        alert(t("manager.editTitleRequired"));
        return;
      }
      const bookmark = this.findBookmarkById(id);
      if (!bookmark) {
        alert(t("manager.editNotFound"));
        return;
      }
      const isFolder = !!bookmark.children;
      const updateLocalData = () => {
        bookmark.title = newTitle;
        if (!isFolder && newUrl) {
          bookmark.url = newUrl;
        }
        this.saveBookmarksToStorage();
        this.saveBookmarkTreeToGitee(this.bookmarks);
        this.updateSystemBookmarks();
        this.hideEditModal();
        this.renderFolderTree();
        this.renderBookmarks();
        this.updateStats();
      };
      try {
        if (typeof chrome !== "undefined" && chrome.bookmarks) {
          const updateData = { title: newTitle };
          if (!isFolder && newUrl) {
            updateData.url = newUrl;
          }
          chrome.bookmarks.update(id, updateData, () => {
            updateLocalData();
          });
        } else {
          updateLocalData();
        }
      } catch (error) {
        alert(t("manager.editFailed"));
      }
    }
    deleteBookmark(id) {
      if (confirm(t("confirm.deleteBookmark"))) {
        try {
          if (typeof chrome !== "undefined" && chrome.bookmarks) {
            chrome.bookmarks.remove(id, () => {
              this.loadBookmarks().then(() => {
                this.renderFolderTree();
                this.renderBookmarks();
                this.updateStats();
              });
            });
          } else {
            alert(t("manager.deleteBookmarkNeedExtension"));
          }
        } catch (error) {
          alert(t("manager.deleteBookmarkFailed"));
        }
      }
    }
    exportBookmarks() {
      const markHiddenState = (bookmarks) => {
        return bookmarks.map((bookmark) => {
          const node = { ...bookmark };
          node.hidden = !!node.hidden;
          if (node.children && node.children.length > 0) {
            node.children = markHiddenState(node.children);
          }
          return node;
        });
      };
      const exportData = markHiddenState(this.bookmarks);
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bookmarks.json";
      link.click();
      URL.revokeObjectURL(url);
    }
    // 导入书签 - 触发文件选择
    triggerImport() {
      const fileInput = document.getElementById("importFileInput");
      fileInput.value = "";
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
            alert(t("manager.importInvalidFormat"));
            return;
          }
          if (!this.validateImportData(data)) {
            alert(t("manager.importInvalidFormat"));
            return;
          }
          const stats = this.analyzeImportData(data);
          this.pendingImportData = data;
          this.showImportModal(stats);
        } catch (error) {
          alert(t("manager.importInvalidFormat"));
        }
      };
      reader.readAsText(file);
    }
    // 验证导入数据结构
    validateImportData(data) {
      const validate = (items) => {
        for (const item of items) {
          if (typeof item.title !== "string") {
            return false;
          }
          if (item.children !== void 0) {
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
      const importInfo = document.getElementById("importInfo");
      let html = `<div style="margin-bottom: 8px; font-weight: 500;">${t("manager.importSummary")}</div>`;
      html += `<div class="import-stat">\u{1F4D1} ${t("manager.importTotalBookmarks", stats.totalBookmarks)}</div>`;
      html += `<div class="import-stat">\u{1F4C1} ${t("manager.importTotalFolders", stats.totalFolders)}</div>`;
      if (stats.hiddenBookmarks > 0 || stats.hiddenFolders > 0) {
        html += `<div class="import-stat"><span class="hidden-tag">\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F ${t("manager.importHiddenBookmarks", stats.hiddenBookmarks)}</span></div>`;
        html += `<div class="import-stat"><span class="hidden-tag">\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F ${t("manager.importHiddenFolders", stats.hiddenFolders)}</span></div>`;
      }
      importInfo.innerHTML = html;
      document.getElementById("importModal").style.display = "flex";
    }
    // 隐藏导入对话框
    hideImportModal() {
      document.getElementById("importModal").style.display = "none";
      this.pendingImportData = null;
    }
    // 确认导入书签
    confirmImport() {
      if (!this.pendingImportData) return;
      const importMode = document.querySelector('input[name="importMode"]:checked').value;
      try {
        if (importMode === "overwrite") {
          this.bookmarks = this.processImportedBookmarks(this.pendingImportData);
        } else {
          this.bookmarks = this.mergeImportedBookmarks(this.bookmarks, this.pendingImportData);
        }
        this.saveBookmarksToStorage();
        this.saveBookmarkTreeToGitee(this.bookmarks);
        this.updateSystemBookmarks();
        this.renderFolderTree();
        this.renderBookmarks();
        this.updateStats();
        this.hideImportModal();
        alert(t("manager.importSuccess"));
      } catch (error) {
        alert(t("manager.importFailed"));
      }
    }
    // 处理导入的书签数据，确保 hidden 字段被正确识别
    processImportedBookmarks(data) {
      const process = (items) => {
        return items.map((item) => {
          const node = { ...item };
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
      const mergeNodes = (current, imported) => {
        const currentMap = /* @__PURE__ */ new Map();
        current.forEach((item) => {
          const key = item.children ? `folder:${item.title}` : `bookmark:${item.title}:${item.url || ""}`;
          currentMap.set(key, item);
        });
        imported.forEach((item) => {
          const key = item.children ? `folder:${item.title}` : `bookmark:${item.title}:${item.url || ""}`;
          if (currentMap.has(key)) {
            const existing = currentMap.get(key);
            if (existing.children && item.children) {
              existing.children = mergeNodes(existing.children, item.children);
            }
            if (item.hidden === true) {
              existing.hidden = true;
            }
          } else {
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
      return mergeNodes([...currentBookmarks], importedBookmarks);
    }
    toggleBookmarkVisibility(bookmarkId) {
      const bookmark = this.findBookmarkById(bookmarkId);
      if (bookmark) {
        bookmark.hidden = !bookmark.hidden;
        if (bookmark.children && bookmark.children.length > 0) {
          this.toggleFolderVisibility(bookmark, bookmark.hidden);
        }
        this.saveBookmarkTreeToGitee(this.bookmarks);
        this.saveBookmarksToStorage();
        this.updateSystemBookmarks();
        this.renderFolderTree();
        this.renderBookmarks();
        this.updateStats();
      } else {
      }
    }
    // 递归处理目录的隐藏/显示
    toggleFolderVisibility(folder, isHidden) {
      folder.hidden = isHidden;
      if (folder.children && folder.children.length > 0) {
        for (const child of folder.children) {
          child.hidden = isHidden;
          if (child.children && child.children.length > 0) {
            this.toggleFolderVisibility(child, isHidden);
          }
        }
      }
    }
    updateSystemBookmarks() {
      if (typeof chrome !== "undefined" && chrome.bookmarks) {
        const visibleBookmarks = this.filterVisibleBookmarks(this.bookmarks[0].children);
        this.removeAllBookmarks().then(() => {
          this.createBookmarks(visibleBookmarks, "1").then(() => {
          });
        }).catch((error) => {
        });
      }
    }
    removeAllBookmarks() {
      return new Promise((resolve) => {
        chrome.bookmarks.getTree((nodes) => {
          const rootChildren = nodes[0]?.children || [];
          let toDelete = [];
          rootChildren.forEach((node) => {
            if (node.children && node.children.length) {
              node.children.forEach((child) => toDelete.push(child.id));
            }
          });
          let count = toDelete.length;
          if (count === 0) return resolve();
          toDelete.forEach((id) => {
            chrome.bookmarks.removeTree(id, () => {
              count--;
              if (count === 0) resolve();
            });
          });
        });
      });
    }
    filterVisibleBookmarks(bookmarks) {
      if (!Array.isArray(bookmarks)) {
        return [];
      }
      return bookmarks.filter((bookmark) => {
        if (!bookmark) {
          return false;
        }
        if (bookmark.hidden === true) {
          return false;
        }
        if (bookmark.children && Array.isArray(bookmark.children)) {
          const filteredChildren = this.filterVisibleBookmarks(bookmark.children);
          if (filteredChildren.length > 0) {
            bookmark.children = filteredChildren;
          } else {
            return false;
          }
        }
        return true;
      });
    }
    createBookmarks(nodes, parentId = "1") {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return Promise.resolve();
      }
      return Promise.all(nodes.map((node) => {
        if (!node) {
          return Promise.resolve();
        }
        if (node.url) {
          return new Promise((res) => {
            chrome.bookmarks.create({
              parentId,
              title: node.title,
              url: node.url
            }, (bookmark) => {
              if (chrome.runtime.lastError) {
              } else {
              }
              res(void 0);
            });
          });
        } else {
          return new Promise((res) => {
            chrome.bookmarks.create({
              parentId,
              title: node.title
            }, (folder) => {
              if (chrome.runtime.lastError) {
                res(void 0);
              } else {
                if (node.children && node.children.length > 0) {
                  this.createBookmarks(node.children, folder.id).then(() => res(void 0));
                } else {
                  res(void 0);
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
          reject(new Error(t("manager.giteeConfigIncomplete")));
          return;
        }
        const url = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}`;
        fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `token ${this.giteeConfig.token}`
          }
        }).then((response) => response.json()).then((data) => {
          if (data.content) {
            const content = decodeURIComponent(escape(atob(data.content)));
            const bookmarks = JSON.parse(content);
            resolve(bookmarks);
          } else {
            reject(new Error(t("manager.cannotGetFileContent")));
          }
        }).catch((error) => {
          reject(error);
        });
      });
    }
    filterHiddenBookmarks(bookmarks) {
      const filterBookmarks = (items) => {
        return items.filter((item) => {
          if (item.hidden) {
            return false;
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
      const filterBookmarks = (items) => {
        return items.filter((item) => {
          if (item.hidden) {
            return true;
          }
          if (item.children && item.children.length > 0) {
            const filteredChildren = filterBookmarks(item.children);
            if (item.hidden || filteredChildren.length > 0) {
              return {
                ...item,
                children: filteredChildren
              };
            } else {
              return false;
            }
          }
          return false;
        });
      };
      return filterBookmarks(bookmarks);
    }
    // 合并两个书签树数组（递归去重），与popup.ts中mergeBookmarks逻辑一致
    mergeBookmarks(arr1, arr2) {
      const map = /* @__PURE__ */ new Map();
      const getKey = (node) => {
        return node.url ? `bookmark:${node.title}|${node.url}` : `folder:${node.title}`;
      };
      arr1.forEach((n1) => {
        const key = getKey(n1);
        map.set(key, { ...n1, children: n1.children ? this.mergeBookmarks(n1.children, []) : void 0 });
      });
      arr2.forEach((n2) => {
        const key = getKey(n2);
        if (map.has(key)) {
          if (!n2.url) {
            const existing = map.get(key);
            map.set(key, {
              ...n2,
              hidden: existing.hidden !== void 0 ? existing.hidden : n2.hidden,
              children: this.mergeBookmarks(existing.children || [], n2.children || [])
            });
          }
        } else {
          map.set(key, { ...n2, children: n2.children ? this.mergeBookmarks([], n2.children) : void 0 });
        }
      });
      return Array.from(map.values());
    }
    saveBookmarkTreeToGitee(bookmarks) {
      if (!this.giteeConfig || !this.giteeConfig.owner || !this.giteeConfig.repo || !this.giteeConfig.token) {
        return;
      }
      const apiUrl = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}`;
      fetch(`${apiUrl}?ref=${this.giteeConfig.branch}`, {
        method: "GET",
        headers: {
          "Authorization": `token ${this.giteeConfig.token}`
        }
      }).then((response) => response.json()).then((data) => {
        let mergedBookmarks = bookmarks;
        const sha = data.sha;
        if (data.content) {
          try {
            const remoteContent = decodeURIComponent(escape(atob(data.content)));
            const remoteBookmarks = JSON.parse(remoteContent);
            mergedBookmarks = this.mergeBookmarks(bookmarks, remoteBookmarks);
          } catch (e) {
            console.warn("\u8FDC\u7A0B\u4E66\u7B7E\u6570\u636E\u89E3\u6790\u5931\u8D25\uFF0C\u5C06\u76F4\u63A5\u4F7F\u7528\u672C\u5730\u6570\u636E\u4FDD\u5B58:", e);
          }
        }
        const content = JSON.stringify(mergedBookmarks, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        return fetch(apiUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `token ${this.giteeConfig.token}`
          },
          body: JSON.stringify({
            message: "Update bookmark tree - merge hidden attributes",
            content: encodedContent,
            sha
          })
        });
      }).then((response) => response.json()).then((data) => {
        if (data.content) {
          console.log("\u4E66\u7B7E\u5408\u5E76\u4FDD\u5B58\u5230Gitee\u6210\u529F");
        } else {
          console.warn("\u4E66\u7B7E\u5408\u5E76\u4FDD\u5B58\u5230Gitee\u5931\u8D25:", data);
        }
      }).catch((error) => {
        console.error("\u4E66\u7B7E\u5408\u5E76\u4FDD\u5B58\u5230Gitee\u51FA\u9519:", error);
      });
    }
    // IndexedDB 相关方法
    async openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("bookmarks-plus", 1);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("gitee-config")) {
            db.createObjectStore("gitee-config");
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
      const rawResult = await new Promise((resolve) => {
        const tx = db.transaction("gitee-config", "readonly");
        const store = tx.objectStore("gitee-config");
        const result = {};
        let count = fields.length;
        fields.forEach((f) => {
          const req = store.get(f);
          req.onsuccess = function() {
            result[f] = req.result || "";
            count--;
            if (count === 0) resolve(result);
          };
          req.onerror = function() {
            count--;
            if (count === 0) resolve(result);
          };
        });
      });
      const decrypted = {};
      for (const f of fields) {
        decrypted[f] = await decryptSafe(rawResult[f]);
      }
      return decrypted;
    }
    async setConfigToIndexedDB(config) {
      const encryptedConfig = {};
      for (const [k, v] of Object.entries(config)) {
        encryptedConfig[k] = v ? await encrypt(v) : v;
      }
      const db = await this.openDB();
      const tx = db.transaction("gitee-config", "readwrite");
      const store = tx.objectStore("gitee-config");
      Object.entries(encryptedConfig).forEach(([k, v]) => store.put(v, k));
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    async loadConfigFromIndexedDB() {
      const fields = ["giteeToken", "giteeOwner", "giteeRepo", "giteeBranch", "giteeFilePath"];
      const data = await this.getConfigFromIndexedDB(fields);
      this.giteeConfig.owner = data.giteeOwner || "";
      this.giteeConfig.repo = data.giteeRepo || "";
      this.giteeConfig.token = data.giteeToken || "";
      this.giteeConfig.branch = data.giteeBranch || "master";
      this.giteeConfig.filePath = data.giteeFilePath || "hidden-bookmarks.json";
    }
    async getFileSha() {
      try {
        const apiUrl = `https://gitee.com/api/v5/repos/${this.giteeConfig.owner}/${this.giteeConfig.repo}/contents/${this.giteeConfig.filePath}?ref=${this.giteeConfig.branch}`;
        const response = await fetch(apiUrl, {
          headers: {
            "Authorization": `token ${this.giteeConfig.token}`
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
      const modal = document.getElementById("configModal");
      modal.style.display = "flex";
      document.getElementById("giteeOwner").value = this.giteeConfig.owner;
      document.getElementById("giteeRepo").value = this.giteeConfig.repo;
      document.getElementById("giteeToken").value = this.giteeConfig.token;
    }
    hideConfigModal() {
      const modal = document.getElementById("configModal");
      modal.style.display = "none";
    }
    async saveConfig() {
      const owner = document.getElementById("giteeOwner").value.trim();
      const repo = document.getElementById("giteeRepo").value.trim();
      const token = document.getElementById("giteeToken").value.trim();
      if (!owner || !repo || !token) {
        alert(t("manager.configIncomplete"));
        return;
      }
      this.giteeConfig.owner = owner;
      this.giteeConfig.repo = repo;
      this.giteeConfig.token = token;
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
      alert(t("manager.configSaved"));
    }
    // ========== 重复书签检测 ==========
    /**
     * 递归展平书签树为平面数组，每项携带文件夹路径
     */
    flattenBookmarks(bookmarks, parentPath = "") {
      const result = [];
      for (const item of bookmarks) {
        const currentPath = parentPath ? `${parentPath} > ${item.title}` : item.title;
        if (item.url) {
          result.push({
            id: item.id,
            title: item.title || "",
            url: item.url,
            path: parentPath || "(root)",
            dateAdded: item.dateAdded || 0
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
        u = u.replace(/^https?:\/\//, "");
        u = u.replace(/\/+$/, "");
        if (stripQuery) {
          u = u.replace(/[?#].*$/, "");
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
      if (a === b) return 1;
      if (a.length < 2 || b.length < 2) return 0;
      const bigramsA = /* @__PURE__ */ new Map();
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
      return 2 * intersection / (a.length - 1 + (b.length - 1));
    }
    /**
     * 按 URL 精确匹配检测重复
     */
    detectDuplicatesByUrl(flatBookmarks, stripQuery = false) {
      const groups = /* @__PURE__ */ new Map();
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
      const visited = /* @__PURE__ */ new Set();
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
            items: group
          });
        }
      }
      return groups;
    }
    /**
     * 打开重复检测对话框
     */
    showDuplicateModal() {
      document.getElementById("duplicateModal").style.display = "flex";
      document.querySelector('input[name="duplicateMode"][value="url"]').checked = true;
      document.getElementById("stripQueryParam").checked = false;
      document.getElementById("stripQueryLabel").style.display = "";
      this.runDuplicateDetection();
    }
    /**
     * 关闭重复检测对话框
     */
    hideDuplicateModal() {
      document.getElementById("duplicateModal").style.display = "none";
    }
    /**
     * 根据当前模式执行重复检测
     */
    runDuplicateDetection() {
      const mode = document.querySelector('input[name="duplicateMode"]:checked').value;
      const stripQuery = document.getElementById("stripQueryParam").checked;
      document.getElementById("stripQueryLabel").style.display = mode === "url" ? "" : "none";
      const flatBookmarks = this.flattenBookmarks(this.bookmarks);
      let duplicateGroups;
      if (mode === "url") {
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
      const statsEl = document.getElementById("duplicateStats");
      const resultsEl = document.getElementById("duplicateResults");
      const deleteBtn = document.getElementById("deleteDuplicatesBtn");
      const controlsEl = document.getElementById("duplicateControls");
      if (groups.length === 0) {
        statsEl.style.display = "none";
        controlsEl.style.display = "none";
        resultsEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary);">
          <div style="font-size: 40px; margin-bottom: 12px;">\u2705</div>
          <div style="font-size: 16px; margin-bottom: 8px;">${t("manager.duplicateNone")}</div>
          <div style="font-size: 13px;">${t("manager.duplicateNoneDesc")}</div>
        </div>
      `;
        deleteBtn.style.display = "none";
        return;
      }
      const totalDuplicates = groups.reduce((sum, g) => sum + g.items.length - 1, 0);
      statsEl.style.display = "flex";
      statsEl.innerHTML = `
      <span>${t("manager.duplicateGroups", String(groups.length))}</span>
      <span>${t("manager.duplicateTotal", String(totalDuplicates))}</span>
    `;
      controlsEl.style.display = "";
      deleteBtn.style.display = "";
      let html = "";
      groups.forEach((group, groupIdx) => {
        html += `<div class="duplicate-group">`;
        html += `<div class="duplicate-group-header">`;
        html += `<span style="white-space: nowrap;">\u{1F4D1} ${group.items.length} ${t("manager.items")}</span>`;
        if (group.items[0].url) {
          const displayUrl = group.items[0].url.length > 80 ? group.items[0].url.substring(0, 80) + "..." : group.items[0].url;
          html += `<span style="color: var(--color-text-muted); font-weight: 400; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayUrl)}</span>`;
        }
        html += `</div>`;
        group.items.forEach((item, itemIdx) => {
          const isFirst = itemIdx === 0;
          const checked = isFirst ? "" : "checked";
          html += `
          <div class="duplicate-item">
            <input type="checkbox" class="duplicate-checkbox"
                   data-group="${groupIdx}" data-item="${itemIdx}"
                   data-bookmark-id="${item.id}" ${checked}>
            <div class="duplicate-item-info">
              <div class="duplicate-item-title">
                ${this.escapeHtml(item.title)}
                ${isFirst ? `<span class="duplicate-keep-badge">${t("manager.duplicateKeepHint")}</span>` : ""}
              </div>
              ${item.url ? `<div class="duplicate-item-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(item.url)}</div>` : ""}
              <div class="duplicate-item-path">${t("manager.duplicatePath", this.escapeHtml(item.path))}</div>
            </div>
          </div>
        `;
        });
        html += `</div>`;
      });
      resultsEl.innerHTML = html;
      this.updateDuplicateSelectedCount();
      resultsEl.querySelectorAll(".duplicate-checkbox").forEach((cb) => {
        cb.addEventListener("change", () => {
          this.updateDuplicateSelectedCount();
        });
      });
    }
    /**
     * HTML 转义（防 XSS）
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    /**
     * 更新删除按钮上的选中计数
     */
    updateDuplicateSelectedCount() {
      const checkboxes = document.querySelectorAll("#duplicateResults .duplicate-checkbox:checked");
      const count = checkboxes.length;
      const deleteBtn = document.getElementById("deleteDuplicatesBtn");
      deleteBtn.textContent = t("manager.duplicateDeleteSelected", String(count));
      deleteBtn.disabled = count === 0;
    }
    /**
     * 全选 / 取消全选
     */
    toggleAllDuplicateCheckboxes(checked) {
      document.querySelectorAll("#duplicateResults .duplicate-checkbox").forEach((cb) => {
        cb.checked = checked;
      });
      this.updateDuplicateSelectedCount();
    }
    /**
     * 批量删除选中的重复书签
     */
    async deleteSelectedDuplicates() {
      const checkboxes = document.querySelectorAll("#duplicateResults .duplicate-checkbox:checked");
      const ids = Array.from(checkboxes).map((cb) => cb.getAttribute("data-bookmark-id"));
      if (ids.length === 0) return;
      if (!confirm(t("confirm.deleteDuplicates", String(ids.length)))) {
        return;
      }
      const deleteBtn = document.getElementById("deleteDuplicatesBtn");
      deleteBtn.textContent = t("manager.duplicateDeleting");
      deleteBtn.disabled = true;
      try {
        if (typeof chrome !== "undefined" && chrome.bookmarks) {
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
        await this.loadBookmarks();
        this.renderFolderTree();
        this.renderBookmarks();
        this.updateStats();
        this.hideDuplicateModal();
        alert(t("manager.duplicateDeleteSuccess", String(ids.length)));
      } catch (error) {
        console.error("Delete duplicates failed:", error);
        alert(t("manager.duplicateDeleteFailed"));
        this.runDuplicateDetection();
      }
    }
    // ========== 失效链接检测 ==========
    /**
     * 打开失效链接检测对话框
     */
    showLinkCheckModal() {
      document.getElementById("linkCheckModal").style.display = "flex";
      this.linkCheckResults = [];
      this.linkCheckRunning = false;
      this.linkCheckCurrentFilter = "all";
      document.getElementById("linkCheckFilter").value = "all";
      document.getElementById("linkCheckProgress").style.display = "none";
      document.getElementById("linkCheckStats").style.display = "none";
      document.getElementById("linkCheckControls").style.display = "none";
      document.getElementById("linkCheckResults").innerHTML = "";
      document.getElementById("deleteBrokenLinksBtn").style.display = "none";
      document.getElementById("linkCheckStartBtn").style.display = "";
      document.getElementById("linkCheckStopBtn").style.display = "none";
      document.getElementById("linkCheckStartBtn").disabled = false;
    }
    /**
     * 关闭失效链接检测对话框
     */
    hideLinkCheckModal() {
      this.stopLinkCheck();
      document.getElementById("linkCheckModal").style.display = "none";
    }
    /**
     * 停止链接检测
     */
    stopLinkCheck() {
      this.linkCheckRunning = false;
      document.getElementById("linkCheckStartBtn").style.display = "";
      document.getElementById("linkCheckStopBtn").style.display = "none";
      document.getElementById("linkCheckStartBtn").disabled = false;
    }
    /**
     * 向 background.ts 发送单个链接检测请求
     */
    checkSingleLink(url) {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "checkLink", url }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ status: "error", statusCode: 0, url, message: chrome.runtime.lastError.message });
            } else {
              resolve(response || { status: "error", statusCode: 0, url, message: "No response" });
            }
          });
        } else {
          this.checkLinkFallback(url).then(resolve);
        }
      });
    }
    /**
     * 非扩展环境下的 fetch 回退方案
     */
    async checkLinkFallback(url) {
      if (!/^https?:\/\//i.test(url)) {
        return { status: "ok", statusCode: 0, url, message: "Skipped" };
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15e3);
        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
          mode: "no-cors"
        });
        clearTimeout(timer);
        return { status: "ok", statusCode: response.status || 0, url };
      } catch (err) {
        if (err.name === "AbortError") {
          return { status: "warning", statusCode: 0, url, message: "Timeout" };
        }
        return { status: "error", statusCode: 0, url, message: err.message || "Network error" };
      }
    }
    /**
     * 开始链接检测
     */
    async startLinkCheck() {
      if (this.linkCheckRunning) return;
      this.linkCheckRunning = true;
      this.linkCheckResults = [];
      this.linkCheckCurrentFilter = "all";
      document.getElementById("linkCheckFilter").value = "all";
      document.getElementById("linkCheckStartBtn").style.display = "none";
      document.getElementById("linkCheckStopBtn").style.display = "";
      document.getElementById("linkCheckProgress").style.display = "block";
      document.getElementById("linkCheckStats").style.display = "none";
      document.getElementById("linkCheckControls").style.display = "none";
      document.getElementById("deleteBrokenLinksBtn").style.display = "none";
      document.getElementById("linkCheckResults").innerHTML = "";
      const flatBookmarks = this.flattenBookmarks(this.bookmarks);
      const total = flatBookmarks.length;
      if (total === 0) {
        this.stopLinkCheck();
        document.getElementById("linkCheckProgress").style.display = "none";
        document.getElementById("linkCheckResults").innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--color-text-secondary);">
          <div style="font-size:40px;margin-bottom:12px;">\u{1F4ED}</div>
          <div style="font-size:16px;">\u6CA1\u6709\u9700\u8981\u68C0\u6D4B\u7684\u4E66\u7B7E</div>
        </div>
      `;
        return;
      }
      const concurrency = parseInt(document.getElementById("linkCheckConcurrency").value, 10) || 8;
      let completed = 0;
      const updateProgress = () => {
        const percent = total > 0 ? Math.round(completed / total * 100) : 0;
        document.getElementById("linkCheckProgressFill").style.width = `${percent}%`;
        document.getElementById("linkCheckProgressText").textContent = t("manager.linkCheckProgress", String(completed), String(total));
        document.getElementById("linkCheckProgressPercent").textContent = `${percent}%`;
      };
      updateProgress();
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
            checkMessage: result.message || ""
          });
          completed++;
          updateProgress();
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
      this.linkCheckRunning = false;
      document.getElementById("linkCheckStartBtn").style.display = "";
      document.getElementById("linkCheckStopBtn").style.display = "none";
      document.getElementById("linkCheckStartBtn").disabled = false;
      this.renderLinkCheckResults();
    }
    /**
     * 渲染链接检测结果
     */
    renderLinkCheckResults() {
      const results = this.linkCheckResults;
      const statsEl = document.getElementById("linkCheckStats");
      const resultsEl = document.getElementById("linkCheckResults");
      const controlsEl = document.getElementById("linkCheckControls");
      const deleteBtn = document.getElementById("deleteBrokenLinksBtn");
      if (results.length === 0) return;
      const okCount = results.filter((r) => r.checkStatus === "ok").length;
      const warningCount = results.filter((r) => r.checkStatus === "warning").length;
      const errorCount = results.filter((r) => r.checkStatus === "error").length;
      statsEl.style.display = "flex";
      statsEl.innerHTML = `
      <span>${t("manager.linkCheckTotal", String(results.length))}</span>
      <span class="linkcheck-stat-ok">${t("manager.linkCheckOkCount", String(okCount))}</span>
      <span class="linkcheck-stat-warning">${t("manager.linkCheckWarningCount", String(warningCount))}</span>
      <span class="linkcheck-stat-error">${t("manager.linkCheckErrorCount", String(errorCount))}</span>
    `;
      const filter = this.linkCheckCurrentFilter;
      let filtered = results;
      if (filter === "error") {
        filtered = results.filter((r) => r.checkStatus === "error");
      } else if (filter === "warning") {
        filtered = results.filter((r) => r.checkStatus === "warning");
      } else if (filter === "ok") {
        filtered = results.filter((r) => r.checkStatus === "ok");
      }
      const hasBroken = errorCount > 0 || warningCount > 0;
      if (!hasBroken && !this.linkCheckRunning) {
        controlsEl.style.display = "none";
        deleteBtn.style.display = "none";
        resultsEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--color-text-secondary);">
          <div style="font-size:40px;margin-bottom:12px;">\u2705</div>
          <div style="font-size:16px;margin-bottom:8px;">${t("manager.linkCheckNoBroken")}</div>
          <div style="font-size:13px;">${t("manager.linkCheckNoBrokenDesc")}</div>
        </div>
      `;
        return;
      }
      if (hasBroken) {
        controlsEl.style.display = "";
        deleteBtn.style.display = "";
      }
      let html = "";
      filtered.forEach((item) => {
        const statusLabel = item.checkStatus === "ok" ? t("manager.linkCheckOk") : item.checkStatus === "warning" ? t("manager.linkCheckWarning") : t("manager.linkCheckError");
        const statusClass = `linkcheck-status-${item.checkStatus}`;
        const showCheckbox = item.checkStatus !== "ok";
        const checked = item.checkStatus === "error" ? "" : "";
        let detail = "";
        if (item.statusCode && item.statusCode > 0) {
          detail = `HTTP ${item.statusCode}`;
        }
        if (item.checkMessage) {
          detail = detail ? `${detail} \xB7 ${item.checkMessage}` : item.checkMessage;
        }
        html += `
        <div class="linkcheck-item">
          ${showCheckbox ? `<input type="checkbox" class="linkcheck-checkbox" data-bookmark-id="${item.id}" ${checked}>` : `<div style="width:17px;flex-shrink:0;"></div>`}
          <div class="linkcheck-item-info">
            <div class="linkcheck-item-title">${this.escapeHtml(item.title)}</div>
            <div class="linkcheck-item-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(item.url)}</div>
            <div class="linkcheck-item-path">${t("manager.duplicatePath", this.escapeHtml(item.path))}</div>
            ${detail ? `<div class="linkcheck-status-detail">${this.escapeHtml(detail)}</div>` : ""}
          </div>
          <span class="linkcheck-item-status ${statusClass}">${statusLabel}</span>
        </div>
      `;
      });
      resultsEl.innerHTML = html;
      this.updateLinkCheckSelectedCount();
      resultsEl.querySelectorAll(".linkcheck-checkbox").forEach((cb) => {
        cb.addEventListener("change", () => {
          this.updateLinkCheckSelectedCount();
        });
      });
    }
    /**
     * 更新删除按钮上的选中计数
     */
    updateLinkCheckSelectedCount() {
      const checkboxes = document.querySelectorAll("#linkCheckResults .linkcheck-checkbox:checked");
      const count = checkboxes.length;
      const deleteBtn = document.getElementById("deleteBrokenLinksBtn");
      deleteBtn.textContent = t("manager.linkCheckDeleteSelected", String(count));
      deleteBtn.disabled = count === 0;
    }
    /**
     * 全选/取消全选
     * mode: 'broken' = 选中所有失效和警告, 'none' = 取消全选
     */
    toggleLinkCheckCheckboxes(mode) {
      const checkboxes = document.querySelectorAll("#linkCheckResults .linkcheck-checkbox");
      checkboxes.forEach((cb) => {
        cb.checked = mode === "broken";
      });
      this.updateLinkCheckSelectedCount();
    }
    /**
     * 批量删除选中的失效书签
     */
    async deleteSelectedBrokenLinks() {
      const checkboxes = document.querySelectorAll("#linkCheckResults .linkcheck-checkbox:checked");
      const ids = Array.from(checkboxes).map((cb) => cb.getAttribute("data-bookmark-id"));
      if (ids.length === 0) return;
      if (!confirm(t("confirm.deleteBrokenLinks", String(ids.length)))) {
        return;
      }
      const deleteBtn = document.getElementById("deleteBrokenLinksBtn");
      deleteBtn.textContent = t("manager.linkCheckDeleting");
      deleteBtn.disabled = true;
      try {
        if (typeof chrome !== "undefined" && chrome.bookmarks) {
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
        const deletedIds = new Set(ids);
        this.linkCheckResults = this.linkCheckResults.filter((r) => !deletedIds.has(r.id));
        await this.loadBookmarks();
        this.renderFolderTree();
        this.renderBookmarks();
        this.updateStats();
        this.renderLinkCheckResults();
        alert(t("manager.linkCheckDeleteSuccess", String(ids.length)));
      } catch (error) {
        console.error("Delete broken links failed:", error);
        alert(t("manager.linkCheckDeleteFailed"));
      }
    }
  };
  document.addEventListener("DOMContentLoaded", async () => {
    const mainContent = document.getElementById("mainContent");
    const lockOverlay = document.getElementById("passwordLockOverlay");
    let verified = false;
    function initManager() {
      if (verified) return;
      verified = true;
      if (!document.getElementById("mainContent")) {
        document.body.appendChild(mainContent);
      }
      mainContent.style.display = "";
      window.bookmarkManager = new BookmarkManager();
    }
    const isFromPopup = await new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["bmAuthTimestamp"], (result) => {
          if (result.bmAuthTimestamp) {
            const elapsed = Date.now() - result.bmAuthTimestamp;
            chrome.storage.local.remove(["bmAuthTimestamp"]);
            if (elapsed < 1e4) {
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
    if (isFromPopup) {
      initManager();
      return;
    }
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("bookmarks-plus", 1);
        req.onupgradeneeded = (e) => {
          const db2 = e.target.result;
          if (!db2.objectStoreNames.contains("gitee-config")) {
            db2.createObjectStore("gitee-config");
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e);
      });
      const getConfig = (fields) => new Promise((resolve) => {
        const tx = db.transaction("gitee-config", "readonly");
        const store = tx.objectStore("gitee-config");
        const result = {};
        let count = fields.length;
        fields.forEach((f) => {
          const req = store.get(f);
          req.onsuccess = () => {
            result[f] = req.result || "";
            count--;
            if (count === 0) resolve(result);
          };
          req.onerror = () => {
            count--;
            if (count === 0) resolve(result);
          };
        });
      });
      const configData = await getConfig(["giteeToken", "giteeOwner", "giteeRepo", "giteeBranch", "giteeFilePath"]);
      const pToken = configData.giteeToken || "";
      const pOwner = configData.giteeOwner || "";
      const pRepo = configData.giteeRepo || "";
      const pBranch = configData.giteeBranch || "master";
      const pFilePath = configData.giteeFilePath || "";
      const pDir = pFilePath.includes("/") ? pFilePath.substring(0, pFilePath.lastIndexOf("/")) : "";
      let needLock = false;
      if (pToken && pOwner && pRepo && pBranch && pDir) {
        const passwordFileName = "\u5BC6\u7801.json";
        const passwordFilePath = pDir ? `${pDir}/${passwordFileName}` : passwordFileName;
        const encodedPath = passwordFilePath.split("/").map(encodeURIComponent).join("/");
        const apiUrl = `https://gitee.com/api/v5/repos/${pOwner}/${pRepo}/contents/${encodedPath}?ref=${pBranch}`;
        try {
          const response = await fetch(apiUrl, {
            headers: { "Authorization": `token ${pToken}` }
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
              mainContent.remove();
              lockOverlay.style.display = "flex";
              let unlocked = false;
              const protectObserver = new MutationObserver(() => {
                if (!unlocked) {
                  if (lockOverlay.style.display !== "flex") {
                    lockOverlay.style.display = "flex";
                  }
                  if (document.getElementById("mainContent")) {
                    document.getElementById("mainContent").remove();
                  }
                }
              });
              protectObserver.observe(lockOverlay, { attributes: true, attributeFilter: ["style", "class"] });
              protectObserver.observe(document.body, { childList: true });
              const lockInput = document.getElementById("lockPasswordInput");
              const lockSubmit = document.getElementById("lockPasswordSubmit");
              const lockError = document.getElementById("lockPasswordError");
              const doUnlock = () => {
                const inputVal = lockInput.value;
                if (!inputVal) {
                  lockError.textContent = t("password.msg.empty");
                  return;
                }
                if (inputVal === pwdConfig.password) {
                  unlocked = true;
                  protectObserver.disconnect();
                  lockOverlay.style.display = "none";
                  initManager();
                } else {
                  lockError.textContent = t("password.lock.error");
                  lockInput.value = "";
                  lockInput.focus();
                }
              };
              lockSubmit.addEventListener("click", doUnlock);
              lockInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") doUnlock();
              });
              setTimeout(() => lockInput.focus(), 50);
            }
          }
        } catch (error) {
        }
      }
      if (!needLock) {
        initManager();
      }
    } catch (e) {
      initManager();
    }
  });
})();
