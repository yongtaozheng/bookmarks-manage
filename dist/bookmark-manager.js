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

  // src/i18n/zh-CN.ts
  var zh_CN_default = {
    // === 通用 ===
    "app.name": "JYeontu\u4E66\u7B7E\u7BA1\u7406\u5668",
    "app.title": "\u4E66\u7B7E\u7BA1\u7406\u5668",
    "btn.help": "\u5E2E\u52A9",
    "btn.cancel": "\u53D6\u6D88",
    "btn.save": "\u4FDD\u5B58\u914D\u7F6E",
    "btn.refresh": "\u{1F504} \u5237\u65B0",
    "btn.export": "\u{1F4E4} \u5BFC\u51FA",
    "btn.import": "\u{1F4E5} \u5BFC\u5165",
    "btn.delete": "\u5220\u9664",
    "btn.back": "\u8FD4\u56DE",
    "btn.edit": "\u7F16\u8F91",
    "btn.show": "\u663E\u793A",
    "btn.hide": "\u9690\u85CF",
    // === Popup 按钮 ===
    "popup.systemBookmarks": "\u7CFB\u7EDF\u4E66\u7B7E\u7BA1\u7406\u5668",
    "popup.myBookmarks": "\u6211\u7684\u4E66\u7B7E\u7BA1\u7406\u5668",
    // === Gitee 配置 ===
    "gitee.token": "Gitee Token",
    "gitee.tokenPlaceholder": "\u4E2A\u4EBA\u8BBF\u95EEToken",
    "gitee.getToken": "\u83B7\u53D6Token \u2192",
    "gitee.owner": "\u4ED3\u5E93\u6240\u6709\u8005\uFF08owner\uFF09",
    "gitee.ownerPlaceholder": "\u5982: zheng_yongtao",
    "gitee.repo": "\u4ED3\u5E93\u540D\uFF08repo\uFF09",
    "gitee.repoPlaceholder": "\u5982: chrome-bookmarks-manage",
    "gitee.branch": "\u5206\u652F\uFF08branch\uFF09",
    "gitee.branchPlaceholder": "\u5982: master",
    "gitee.bookmarkDir": "\u4E66\u7B7E\u76EE\u5F55\uFF08bookmarkDir\uFF09",
    "gitee.bookmarkDirPlaceholder": "\u5982: bookmarks",
    "gitee.bookmarkFile": "\u4E66\u7B7E\u6587\u4EF6",
    "gitee.addFile": "\u65B0\u589E\u4E66\u7B7E\u6587\u4EF6",
    "gitee.deleteFile": "\u5220\u9664\u4E66\u7B7E\u6587\u4EF6",
    "gitee.openRepo": "\u6253\u5F00Gitee\u4ED3\u5E93",
    // === 同步 ===
    "sync.overwriteSave": "\u8986\u76D6\u4FDD\u5B58",
    "sync.mergeSave": "\u5408\u5E76\u4FDD\u5B58",
    "sync.overwriteGet": "\u8986\u76D6\u83B7\u53D6",
    "sync.mergeGet": "\u5408\u5E76\u83B7\u53D6",
    // === 快捷键设置 ===
    "shortcut.title": "\u2328\uFE0F \u5FEB\u6377\u952E\u8BBE\u7F6E",
    "shortcut.enableSearch": "\u542F\u7528\u5168\u5C40\u4E66\u7B7E\u641C\u7D22",
    "shortcut.triggerKey": "\u89E6\u53D1\u952E",
    "shortcut.triggerAnyModifier": "\u4EFB\u610F\u4FEE\u9970\u952E (Cmd/Ctrl/Alt)",
    "shortcut.triggerMeta": "Cmd (Mac) / Win (Windows)",
    "shortcut.pressCount": "\u8FDE\u6309\u6B21\u6570",
    "shortcut.pressCountUnit": "{0} \u6B21",
    "shortcut.timeWindow": "\u65F6\u95F4\u7A97\u53E3",
    "shortcut.timeWindowFast": "500ms (\u5FEB\u901F)",
    "shortcut.timeWindowDefault": "800ms (\u9ED8\u8BA4)",
    "shortcut.timeWindowSlow": "1000ms (\u6162\u901F)",
    "shortcut.timeWindowSlowest": "1500ms (\u6700\u6162)",
    "shortcut.enableCloseTab": "\u542F\u7528\u5173\u95ED\u5F53\u524D\u6807\u7B7E\u9875\u5FEB\u6377\u952E",
    "shortcut.modifier": "\u4FEE\u9970\u952E",
    "shortcut.key": "\u6309\u952E",
    "shortcut.keyPlaceholder": "\u5982\uFF1AW",
    // === 搜索 ===
    "search.placeholder": "\u641C\u7D22\u4E66\u7B7E...",
    // === 消息提示 ===
    "msg.configSaved": "Gitee \u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF01",
    "msg.shortcutSaved": "\u5FEB\u6377\u952E\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF01",
    "msg.tokenUpdated": "Token\u5DF2\u81EA\u52A8\u66F4\u65B0",
    "msg.uploaded": "\u5DF2\u4E0A\u4F20\u4E66\u7B7E\u6570\u636E",
    "msg.uploadFailed": "\u4E0A\u4F20\u4E66\u7B7E\u6570\u636E\u5931\u8D25",
    "msg.hiddenBookmarksKept": "\u5DF2\u4FDD\u7559\u4E66\u7B7E\u7BA1\u7406\u5668\u4E2D\u7684\u9690\u85CF\u4E66\u7B7E\u5E76\u5408\u5E76\u5230\u4FDD\u5B58\u5185\u5BB9\u4E2D",
    "msg.cannotGetManagerData": "\u65E0\u6CD5\u83B7\u53D6\u4E66\u7B7E\u7BA1\u7406\u5668\u6570\u636E\uFF0C\u5C06\u76F4\u63A5\u4F7F\u7528\u5F53\u524D\u4E66\u7B7E\u8986\u76D6",
    "msg.getManagerDataFailed": "\u83B7\u53D6\u4E66\u7B7E\u7BA1\u7406\u5668\u6570\u636E\u5931\u8D25\uFF0C\u5C06\u76F4\u63A5\u4F7F\u7528\u5F53\u524D\u4E66\u7B7E\u8986\u76D6",
    "msg.overwriteSaveSuccess": "\u8986\u76D6\u4FDD\u5B58\u6210\u529F\uFF01",
    "msg.overwriteSaveFailed": "\u8986\u76D6\u4FDD\u5B58\u5931\u8D25: {0}",
    "msg.mergeSaveSuccess": "\u5408\u5E76\u4FDD\u5B58\u6210\u529F\uFF01",
    "msg.mergeSaveFailed": "\u5408\u5E76\u4FDD\u5B58\u5931\u8D25: {0}",
    "msg.overwriteGetSuccess": "\u8986\u76D6\u83B7\u53D6\u5E76\u66FF\u6362\u672C\u5730\u4E66\u7B7E\u6210\u529F\uFF01",
    "msg.overwriteGetFailed": "\u8986\u76D6\u83B7\u53D6\u5931\u8D25: {0}",
    "msg.mergeGetSuccess": "\u5408\u5E76\u83B7\u53D6\u5E76\u66FF\u6362\u672C\u5730\u4E66\u7B7E\u6210\u529F\uFF01",
    "msg.mergeGetFailed": "\u5408\u5E76\u83B7\u53D6\u5931\u8D25: {0}",
    "msg.remoteDataFormatError": "\u8FDC\u7A0B\u4E66\u7B7E\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E",
    "msg.fillConfigFirst": "\u8BF7\u5148\u586B\u5199\u5B8C\u6574\u7684\u914D\u7F6E\u4FE1\u606F",
    "msg.selectFileFirst": "\u8BF7\u5148\u9009\u62E9\u8981\u5220\u9664\u7684\u4E66\u7B7E\u6587\u4EF6",
    "msg.fileInfoFailed": "\u83B7\u53D6\u6587\u4EF6\u4FE1\u606F\u5931\u8D25",
    "msg.addFileSuccess": "\u65B0\u589E\u4E66\u7B7E\u6587\u4EF6\u6210\u529F\uFF1A{0}",
    "msg.addFileFailed": "\u65B0\u589E\u4E66\u7B7E\u6587\u4EF6\u5931\u8D25",
    "msg.addFileFailedDetail": "\u65B0\u589E\u4E66\u7B7E\u6587\u4EF6\u5931\u8D25\uFF1A{0}",
    "msg.deleteFileSuccess": "\u5220\u9664\u4E66\u7B7E\u6587\u4EF6\u6210\u529F\uFF1A{0}",
    "msg.deleteFileFailed": "\u5220\u9664\u4E66\u7B7E\u6587\u4EF6\u5931\u8D25",
    "msg.deleteFileFailedDetail": "\u5220\u9664\u4E66\u7B7E\u6587\u4EF6\u5931\u8D25\uFF1A{0}",
    "msg.fillOwnerRepo": "\u8BF7\u5148\u586B\u5199\u4ED3\u5E93\u6240\u6709\u8005(owner)\u548C\u4ED3\u5E93\u540D(repo)",
    "msg.selectBookmarkFile": "\u8BF7\u5148\u9009\u62E9\u4E66\u7B7E\u6587\u4EF6",
    "msg.cannotOpenManager": "\u65E0\u6CD5\u81EA\u52A8\u6253\u5F00\u4E66\u7B7E\u7BA1\u7406\u5668\uFF0C\u8BF7\u624B\u52A8\u8BBF\u95EE chrome://bookmarks/",
    "msg.pleaseOpenManually": "\u8BF7\u624B\u52A8\u6253\u5F00 chrome://bookmarks/",
    "msg.cannotOpenMyManager": "\u65E0\u6CD5\u6253\u5F00\u6211\u7684\u4E66\u7B7E\u7BA1\u7406\u5668",
    // === 确认对话框 ===
    "confirm.overwriteSave": "\u786E\u5B9A\u8981\u8986\u76D6\u4FDD\u5B58\u5230Gitee\u5417\uFF1F\u8FD9\u5C06\u8986\u76D6\u8FDC\u7A0B\u4ED3\u5E93\u4E2D\u7684\u4E66\u7B7E\u6570\u636E\u3002",
    "confirm.keepHidden": '\u662F\u5426\u4FDD\u7559\u8FDC\u7A0B\u4ED3\u5E93\u4E2D\u7684\u9690\u85CF\u4E66\u7B7E\uFF1F\n\n\u70B9\u51FB"\u786E\u5B9A"\uFF1A\u4FDD\u7559\u8FDC\u7A0B\u9690\u85CF\u4E66\u7B7E\u5E76\u5408\u5E76\u5230\u672C\u5730\u4E66\u7B7E\n\u70B9\u51FB"\u53D6\u6D88"\uFF1A\u76F4\u63A5\u4F7F\u7528\u672C\u5730\u4E66\u7B7E\u8986\u76D6\u8FDC\u7A0B\u4ED3\u5E93',
    "confirm.mergeSave": "\u786E\u5B9A\u8981\u5408\u5E76\u4FDD\u5B58\u5230Gitee\u5417\uFF1F\u8FD9\u5C06\u628A\u672C\u5730\u4E66\u7B7E\u4E0E\u8FDC\u7A0B\u4E66\u7B7E\u5408\u5E76\u540E\u4FDD\u5B58\u3002",
    "confirm.overwriteGet": "\u786E\u5B9A\u8981\u8986\u76D6\u83B7\u53D6\u5417\uFF1F\u8FD9\u5C06\u7528\u8FDC\u7A0B\u4E66\u7B7E\u5B8C\u5168\u66FF\u6362\u672C\u5730\u4E66\u7B7E\u6570\u636E\uFF0C\u672C\u5730\u4E66\u7B7E\u5C06\u88AB\u5220\u9664\u3002",
    "confirm.mergeGet": "\u786E\u5B9A\u8981\u5408\u5E76\u83B7\u53D6\u5417\uFF1F\u8FD9\u5C06\u628A\u8FDC\u7A0B\u4E66\u7B7E\u4E0E\u672C\u5730\u4E66\u7B7E\u5408\u5E76\u540E\u66FF\u6362\u672C\u5730\u6570\u636E\u3002",
    "confirm.deleteFile": "\u786E\u5B9A\u8981\u5220\u9664\u4E66\u7B7E\u6587\u4EF6\uFF1A{0} \u5417\uFF1F",
    "confirm.deleteBookmark": "\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A\u4E66\u7B7E\u5417\uFF1F",
    // === 下拉选项 ===
    "select.placeholder": "\u8BF7\u9009\u62E9",
    "select.loading": "\u52A0\u8F7D\u4E2D...",
    "select.selectFile": "\u8BF7\u9009\u62E9\u6587\u4EF6",
    "select.getFileFailed": "\u83B7\u53D6\u6587\u4EF6\u5931\u8D25",
    "select.selectBranch": "\u8BF7\u5148\u9009\u62E9\u5206\u652F",
    "select.getBranchFailed": "\u83B7\u53D6\u5206\u652F\u5931\u8D25",
    // === 输入提示 ===
    "prompt.bookmarkTitle": "\u8BF7\u8F93\u5165\u4E66\u7B7E\u6807\u9898:",
    "prompt.bookmarkUrl": "\u8BF7\u8F93\u5165\u4E66\u7B7EURL:",
    "prompt.newFileName": "\u8BF7\u8F93\u5165\u4E66\u7B7E\u6587\u4EF6\u540D\uFF08\u5982\uFF1Abookmarks.json\uFF09\uFF1A",
    // === 帮助面板 ===
    "help.title": "\u529F\u80FD\u8BF4\u660E",
    "help.overwriteSave": "\u8986\u76D6\u4FDD\u5B58\uFF1A",
    "help.overwriteSaveDesc": "\u5C06\u672C\u5730\u4E66\u7B7E\u8986\u76D6\u4FDD\u5B58\u5230Gitee",
    "help.mergeSave": "\u5408\u5E76\u4FDD\u5B58\uFF1A",
    "help.mergeSaveDesc": "\u5C06\u672C\u5730\u4E66\u7B7E\u4E0EGitee\u4E0A\u7684\u4E66\u7B7E\u6570\u636E\u5408\u5E76\u540E\u4FDD\u5B58\u5230Gitee",
    "help.overwriteGet": "\u8986\u76D6\u83B7\u53D6\uFF1A",
    "help.overwriteGetDesc": "\u4F7F\u7528Gitee\u4E0A\u7684\u4E66\u7B7E\u6570\u636E\u6765\u66FF\u6362\u672C\u5730\u7684\u4E66\u7B7E\u6570\u636E",
    "help.mergeGet": "\u5408\u5E76\u83B7\u53D6\uFF1A",
    "help.mergeGetDesc": "\u83B7\u53D6Gitee\u4E0A\u7684\u4E66\u7B7E\u6570\u636E\u5E76\u4E0E\u672C\u5730\u4E66\u7B7E\u6570\u636E\u5408\u5E76\u540E\u66FF\u6362\u672C\u5730\u7684\u4E66\u7B7E\u6570\u636E",
    "help.shortcutTitle": "\u5FEB\u6377\u952E",
    "help.shortcutCustomizable": "\uFF08\u53EF\u5728\u300C\u5FEB\u6377\u952E\u8BBE\u7F6E\u300D\u4E2D\u81EA\u5B9A\u4E49\uFF09",
    "help.shortcutCloseTab": "\u4FEE\u9970\u952E+\u5B57\u6BCD\u952E\uFF1A",
    "help.shortcutCloseTabDesc": "\u5173\u95ED\u5F53\u524D\u6807\u7B7E\u9875\uFF08\u9ED8\u8BA4 Alt+W\uFF09",
    "help.shortcutSearch": "\u8FDE\u7EED\u6309\u4FEE\u9970\u952E\uFF1A",
    "help.shortcutSearchDesc": "\u547C\u51FA\u5168\u5C40\u4E66\u7B7E\u641C\u7D22\uFF08\u9ED8\u8BA4\u8FDE\u7EED\u4E09\u6B21 Cmd/Ctrl/Alt\uFF09",
    "help.shortcutContextMenu": "\u53F3\u952E\u83DC\u5355\uFF1A",
    "help.shortcutContextMenuDesc": "\u5728\u9875\u9762\u53F3\u952E\u53EF\u5FEB\u901F\u6253\u5F00\u4E66\u7B7E\u7BA1\u7406\u5668",
    "help.shortcutEsc": "ESC\uFF1A",
    "help.shortcutEscDesc": "\u5173\u95ED\u641C\u7D22\u6846",
    "help.configTitle": "\u914D\u7F6E\u8BF4\u660E",
    "help.configToken": "Gitee Token\uFF1A",
    "help.configTokenDesc": "\u4E2A\u4EBA\u8BBF\u95EE\u4EE4\u724C\uFF0C\u7528\u4E8EAPI\u8C03\u7528",
    "help.configOwner": "\u4ED3\u5E93\u6240\u6709\u8005\uFF1A",
    "help.configOwnerDesc": "Gitee\u7528\u6237\u540D\u6216\u7EC4\u7EC7\u540D",
    "help.configRepo": "\u4ED3\u5E93\u540D\uFF1A",
    "help.configRepoDesc": "\u7528\u4E8E\u5B58\u50A8\u4E66\u7B7E\u7684\u4ED3\u5E93\u540D\u79F0",
    "help.configBranch": "\u5206\u652F\uFF1A",
    "help.configBranchDesc": "\u9ED8\u8BA4master\uFF0C\u81EA\u52A8\u83B7\u53D6\u4ED3\u5E93\u5206\u652F\u5217\u8868",
    "help.configDir": "\u4E66\u7B7E\u76EE\u5F55\uFF1A",
    "help.configDirDesc": "\u5B58\u653E\u4E66\u7B7E\u6587\u4EF6\u7684\u76EE\u5F55\u8DEF\u5F84",
    "help.configFile": "\u4E66\u7B7E\u6587\u4EF6\uFF1A",
    "help.configFileDesc": "\u5177\u4F53\u7684\u4E66\u7B7E\u6587\u4EF6\uFF0C\u652F\u6301\u65B0\u589E\u548C\u5220\u9664",
    "help.tipsTitle": "\u4F7F\u7528\u6280\u5DE7",
    "help.tipAutoConfig": "\u81EA\u52A8\u914D\u7F6E\uFF1A",
    "help.tipAutoConfigDesc": "\u8F93\u5165Token\u3001Owner\u3001Repo\u540E\u81EA\u52A8\u83B7\u53D6\u5206\u652F\u548C\u6587\u4EF6\u5217\u8868",
    "help.tipSmartSort": "\u667A\u80FD\u6392\u5E8F\uFF1A",
    "help.tipSmartSortDesc": "\u641C\u7D22\u65F6\u4F18\u5148\u663E\u793A\u6700\u8FD1\u4F7F\u7528\u548C\u6700\u5E38\u7528\u7684\u4E66\u7B7E",
    "help.tipFileManage": "\u6587\u4EF6\u7BA1\u7406\uFF1A",
    "help.tipFileManageDesc": "\u652F\u6301\u5728\u6307\u5B9A\u76EE\u5F55\u4E0B\u65B0\u589E\u548C\u5220\u9664\u4E66\u7B7E\u6587\u4EF6",
    "help.tipQuickAccess": "\u5FEB\u901F\u8BBF\u95EE\uFF1A",
    "help.tipQuickAccessDesc": "\u4E00\u952E\u8DF3\u8F6C\u5230Gitee\u4ED3\u5E93\u67E5\u770B\u4E66\u7B7E\u6587\u4EF6",
    "help.contactTitle": "\u8054\u7CFB\u4F5C\u8005",
    "help.wechat": "\u5FAE\u4FE1\u516C\u4F17\u53F7\uFF1A",
    "help.wechatName": "\u524D\u7AEF\u4E5F\u80FD\u8FD9\u4E48\u6709\u8DA3",
    "help.github": "GitHub\uFF1A",
    "help.gitee": "Gitee\uFF1A",
    "help.projectLink": "\u9879\u76EE\u5730\u5740",
    // === 书签管理器页面 ===
    "manager.title": "\u6211\u7684\u4E66\u7B7E\u7BA1\u7406\u5668",
    "manager.header": "\u4E66\u7B7E\u7BA1\u7406\u5668",
    "manager.config": "\u2699\uFE0F \u914D\u7F6E",
    "manager.addBookmark": "+ \u6DFB\u52A0\u4E66\u7B7E",
    "manager.searchPlaceholder": "\u641C\u7D22\u4E66\u7B7E...",
    "manager.filterAll": "\u663E\u793A\u6240\u6709",
    "manager.filterVisible": "\u53EA\u663E\u793A\u53EF\u89C1",
    "manager.filterHidden": "\u53EA\u663E\u793A\u9690\u85CF",
    "manager.statBookmarks": "\u4E66\u7B7E",
    "manager.statFolders": "\u6587\u4EF6\u5939",
    "manager.statRecent": "\u6700\u8FD1\u6DFB\u52A0",
    "manager.loading": "\u52A0\u8F7D\u4E2D...",
    "manager.selectFolder": "\u9009\u62E9\u6587\u4EF6\u5939",
    "manager.selectFolderHint": "\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6\u5939",
    "manager.selectFolderDesc": "\u4ECE\u5DE6\u4FA7\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6\u5939\u6765\u67E5\u770B\u5176\u4E2D\u7684\u4E66\u7B7E",
    "manager.giteeConfig": "Gitee \u4ED3\u5E93\u914D\u7F6E",
    "manager.giteeOwner": "Gitee \u7528\u6237\u540D:",
    "manager.giteeOwnerPlaceholder": "\u8F93\u5165\u4F60\u7684Gitee\u7528\u6237\u540D",
    "manager.giteeRepo": "\u4ED3\u5E93\u540D:",
    "manager.giteeRepoPlaceholder": "\u8F93\u5165\u4ED3\u5E93\u540D",
    "manager.giteeToken": "\u8BBF\u95EE\u4EE4\u724C:",
    "manager.giteeTokenPlaceholder": "\u8F93\u5165\u4F60\u7684Gitee\u8BBF\u95EE\u4EE4\u724C",
    "manager.folderItems": "\u6587\u4EF6\u5939 ({0} \u9879)",
    "manager.scriptBookmark": "\u811A\u672C\u4E66\u7B7E",
    "manager.addBookmarkNeedExtension": "\u4E66\u7B7E\u6DFB\u52A0\u529F\u80FD\u9700\u8981\u6D4F\u89C8\u5668\u6269\u5C55\u73AF\u5883",
    "manager.addBookmarkFailed": "\u6DFB\u52A0\u4E66\u7B7E\u5931\u8D25",
    "manager.editTodo": "\u7F16\u8F91\u529F\u80FD\u5F85\u5B9E\u73B0",
    "manager.editBookmark": "\u7F16\u8F91\u4E66\u7B7E",
    "manager.editFolder": "\u7F16\u8F91\u6587\u4EF6\u5939",
    "manager.editTitle": "\u6807\u9898:",
    "manager.editTitlePlaceholder": "\u8F93\u5165\u4E66\u7B7E\u6807\u9898",
    "manager.editUrl": "URL:",
    "manager.editUrlPlaceholder": "\u8F93\u5165\u4E66\u7B7EURL",
    "manager.editSuccess": "\u4E66\u7B7E\u5DF2\u66F4\u65B0",
    "manager.editFailed": "\u7F16\u8F91\u4E66\u7B7E\u5931\u8D25",
    "manager.editNeedExtension": "\u7F16\u8F91\u4E66\u7B7E\u529F\u80FD\u9700\u8981\u6D4F\u89C8\u5668\u6269\u5C55\u73AF\u5883",
    "manager.editNotFound": "\u672A\u627E\u5230\u8BE5\u4E66\u7B7E",
    "manager.editTitleRequired": "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A",
    "manager.deleteBookmarkNeedExtension": "\u4E66\u7B7E\u5220\u9664\u529F\u80FD\u9700\u8981\u6D4F\u89C8\u5668\u6269\u5C55\u73AF\u5883",
    "manager.deleteBookmarkFailed": "\u5220\u9664\u4E66\u7B7E\u5931\u8D25",
    "manager.giteeConfigIncomplete": "Gitee\u914D\u7F6E\u4E0D\u5B8C\u6574",
    "manager.cannotGetFileContent": "\u65E0\u6CD5\u83B7\u53D6\u6587\u4EF6\u5185\u5BB9",
    "manager.configIncomplete": "\u8BF7\u586B\u5199\u5B8C\u6574\u7684\u914D\u7F6E\u4FE1\u606F",
    "manager.configSaved": "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF01",
    "manager.sampleFolder": "\u793A\u4F8B\u6587\u4EF6\u5939",
    "manager.scriptExecution": "\u811A\u672C\u6267\u884C",
    "manager.scriptExecutionResult": "\u811A\u672C\u6267\u884C\u7ED3\u679C\uFF1A",
    "manager.executionError": "\u6267\u884C\u9519\u8BEF: ",
    "manager.scriptExecutionFailed": "\u811A\u672C\u6267\u884C\u5931\u8D25: ",
    "manager.folderNotExist": "\u6587\u4EF6\u5939\u4E0D\u5B58\u5728",
    "manager.folderMayBeDeleted": "\u6B64\u6587\u4EF6\u5939\u53EF\u80FD\u5DF2\u88AB\u5220\u9664",
    "manager.folderEmpty": "\u6587\u4EF6\u5939\u4E3A\u7A7A",
    "manager.folderNoBookmarks": "\u6B64\u6587\u4EF6\u5939\u4E2D\u6CA1\u6709\u4E66\u7B7E",
    "manager.noMatchingBookmarks": "\u6CA1\u6709\u5339\u914D\u7684\u4E66\u7B7E",
    "manager.noBookmarksInFilter": "\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u4E66\u7B7E",
    "manager.noSearchResults": "\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u4E66\u7B7E",
    "manager.searchNoResult": '\u641C\u7D22 "{0}" \u6CA1\u6709\u627E\u5230\u7ED3\u679C',
    "manager.searchResults": "\u641C\u7D22\u7ED3\u679C",
    "manager.items": "\u9879",
    "manager.noMatchInFolder": "\u8BE5\u76EE\u5F55\u4E2D\u6CA1\u6709\u5339\u914D\u7684\u4E66\u7B7E",
    "manager.noSearchResultInFolder": '\u5728\u6587\u4EF6\u5939 "{0}" \u4E2D\u641C\u7D22 "{1}" \u6CA1\u6709\u627E\u5230\u7ED3\u679C',
    "manager.importBookmarks": "\u5BFC\u5165\u4E66\u7B7E",
    "manager.importOverwrite": "\u8986\u76D6\u5BFC\u5165 - \u7528\u5BFC\u5165\u6570\u636E\u5B8C\u5168\u66FF\u6362\u5F53\u524D\u4E66\u7B7E",
    "manager.importMerge": "\u5408\u5E76\u5BFC\u5165 - \u5C06\u5BFC\u5165\u6570\u636E\u4E0E\u5F53\u524D\u4E66\u7B7E\u5408\u5E76",
    "manager.importConfirm": "\u786E\u8BA4\u5BFC\u5165",
    "manager.importSuccess": "\u4E66\u7B7E\u5BFC\u5165\u6210\u529F\uFF01",
    "manager.importFailed": "\u4E66\u7B7E\u5BFC\u5165\u5931\u8D25",
    "manager.importInvalidFormat": "\u5BFC\u5165\u6587\u4EF6\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u9009\u62E9\u6709\u6548\u7684\u4E66\u7B7EJSON\u6587\u4EF6",
    "manager.importFileEmpty": "\u5BFC\u5165\u6587\u4EF6\u4E3A\u7A7A",
    "manager.importSummary": "\u5373\u5C06\u5BFC\u5165\u7684\u4E66\u7B7E\u6570\u636E\uFF1A",
    "manager.importTotalBookmarks": "\u4E66\u7B7E\u603B\u6570\uFF1A{0}",
    "manager.importTotalFolders": "\u6587\u4EF6\u5939\u603B\u6570\uFF1A{0}",
    "manager.importHiddenBookmarks": "\u9690\u85CF\u4E66\u7B7E\uFF1A{0}",
    "manager.importHiddenFolders": "\u9690\u85CF\u6587\u4EF6\u5939\uFF1A{0}",
    // === 重复检测 ===
    "manager.detectDuplicates": "\u{1F50D} \u68C0\u6D4B\u91CD\u590D",
    "manager.duplicateTitle": "\u91CD\u590D\u4E66\u7B7E\u68C0\u6D4B",
    "manager.duplicateUrlMode": "URL \u7CBE\u786E\u5339\u914D",
    "manager.duplicateTitleMode": "\u6807\u9898\u6A21\u7CCA\u5339\u914D",
    "manager.duplicateStripQuery": "\u5FFD\u7565\u67E5\u8BE2\u53C2\u6570",
    "manager.duplicateGroups": "\u91CD\u590D\u7EC4\u6570\uFF1A{0}",
    "manager.duplicateTotal": "\u91CD\u590D\u4E66\u7B7E\u603B\u6570\uFF1A{0}",
    "manager.duplicateNone": "\u672A\u53D1\u73B0\u91CD\u590D\u4E66\u7B7E \u{1F389}",
    "manager.duplicateNoneDesc": "\u60A8\u7684\u4E66\u7B7E\u6CA1\u6709\u53D1\u73B0\u91CD\u590D\u9879",
    "manager.duplicateSelectAll": "\u5168\u9009",
    "manager.duplicateDeselectAll": "\u53D6\u6D88\u5168\u9009",
    "manager.duplicateDeleteSelected": "\u5220\u9664\u9009\u4E2D ({0})",
    "manager.duplicateDeleting": "\u6B63\u5728\u5220\u9664...",
    "manager.duplicateDeleteSuccess": "\u6210\u529F\u5220\u9664 {0} \u4E2A\u91CD\u590D\u4E66\u7B7E",
    "manager.duplicateDeleteFailed": "\u5220\u9664\u5931\u8D25",
    "manager.duplicatePath": "\u4F4D\u7F6E\uFF1A{0}",
    "manager.duplicateKeepHint": "(\u4FDD\u7559)",
    "confirm.deleteDuplicates": "\u786E\u5B9A\u8981\u5220\u9664\u9009\u4E2D\u7684 {0} \u4E2A\u91CD\u590D\u4E66\u7B7E\u5417\uFF1F",
    // === 失效链接检测 ===
    "manager.linkCheck": "\u{1F517} \u68C0\u6D4B\u5931\u6548\u94FE\u63A5",
    "manager.linkCheckTitle": "\u5931\u6548\u94FE\u63A5\u68C0\u6D4B",
    "manager.linkCheckStart": "\u5F00\u59CB\u68C0\u6D4B",
    "manager.linkCheckStop": "\u505C\u6B62\u68C0\u6D4B",
    "manager.linkCheckProgress": "\u68C0\u6D4B\u8FDB\u5EA6\uFF1A{0} / {1}",
    "manager.linkCheckOk": "\u2705 \u53EF\u7528",
    "manager.linkCheckWarning": "\u26A0\uFE0F \u53EF\u80FD\u5931\u6548",
    "manager.linkCheckError": "\u274C \u5DF2\u5931\u6548",
    "manager.linkCheckNoBroken": "\u6240\u6709\u94FE\u63A5\u5747\u53EF\u7528 \u{1F389}",
    "manager.linkCheckNoBrokenDesc": "\u60A8\u7684\u4E66\u7B7E\u6CA1\u6709\u53D1\u73B0\u5931\u6548\u94FE\u63A5",
    "manager.linkCheckTotal": "\u603B\u8BA1\uFF1A{0}",
    "manager.linkCheckOkCount": "\u53EF\u7528\uFF1A{0}",
    "manager.linkCheckWarningCount": "\u53EF\u80FD\u5931\u6548\uFF1A{0}",
    "manager.linkCheckErrorCount": "\u5DF2\u5931\u6548\uFF1A{0}",
    "manager.linkCheckSelectAllBroken": "\u9009\u4E2D\u6240\u6709\u5931\u6548",
    "manager.linkCheckDeselectAll": "\u53D6\u6D88\u5168\u9009",
    "manager.linkCheckDeleteSelected": "\u5220\u9664\u9009\u4E2D ({0})",
    "manager.linkCheckDeleting": "\u6B63\u5728\u5220\u9664...",
    "manager.linkCheckDeleteSuccess": "\u6210\u529F\u5220\u9664 {0} \u4E2A\u5931\u6548\u4E66\u7B7E",
    "manager.linkCheckDeleteFailed": "\u5220\u9664\u5931\u8D25",
    "manager.linkCheckFilterAll": "\u5168\u90E8",
    "manager.linkCheckFilterBroken": "\u4EC5\u5931\u6548",
    "manager.linkCheckFilterWarning": "\u4EC5\u8B66\u544A",
    "manager.linkCheckFilterOk": "\u4EC5\u53EF\u7528",
    "manager.linkCheckTimeout": "\u8FDE\u63A5\u8D85\u65F6",
    "manager.linkCheckNetError": "\u7F51\u7EDC\u9519\u8BEF",
    "manager.linkCheckConcurrency": "\u5E76\u53D1\u6570",
    "confirm.deleteBrokenLinks": "\u786E\u5B9A\u8981\u5220\u9664\u9009\u4E2D\u7684 {0} \u4E2A\u5931\u6548\u4E66\u7B7E\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
    // === 内容脚本 ===
    "content.openManually": "\u8BF7\u624B\u52A8\u6253\u5F00\u4E66\u7B7E\uFF1A{0}",
    "content.cannotOpen": "\u65E0\u6CD5\u6253\u5F00\u6B64\u7C7B\u578B\u7684\u4E66\u7B7E\uFF0C\u8BF7\u624B\u52A8\u8BBF\u95EE\uFF1A{0}",
    // === 密码设置 ===
    "password.title": "\u{1F512} \u5BC6\u7801\u8BBE\u7F6E",
    "password.enable": "\u542F\u7528\u5BC6\u7801\u4FDD\u62A4",
    "password.label": "\u5BC6\u7801",
    "password.placeholder": "\u8BF7\u8F93\u5165\u5BC6\u7801",
    "password.confirmLabel": "\u786E\u8BA4\u5BC6\u7801",
    "password.confirmPlaceholder": "\u8BF7\u518D\u6B21\u8F93\u5165\u5BC6\u7801",
    "password.save": "\u4FDD\u5B58\u5BC6\u7801\u8BBE\u7F6E",
    "password.msg.saved": "\u5BC6\u7801\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF01",
    "password.msg.saveFailed": "\u5BC6\u7801\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25",
    "password.msg.mismatch": "\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4",
    "password.msg.empty": "\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A",
    "password.msg.configFirst": "\u8BF7\u5148\u914D\u7F6EGitee\u4FE1\u606F\uFF08Token\u3001Owner\u3001Repo\u3001\u5206\u652F\u3001\u4E66\u7B7E\u76EE\u5F55\uFF09",
    "password.msg.disabled": "\u5BC6\u7801\u4FDD\u62A4\u5DF2\u5173\u95ED",
    "password.msg.enabled": "\u5BC6\u7801\u4FDD\u62A4\u5DF2\u5F00\u542F",
    "password.msg.noPassword": "\u672A\u8BBE\u7F6E\u5BC6\u7801\uFF0C\u5C06\u81EA\u52A8\u5173\u95ED\u5BC6\u7801\u4FDD\u62A4",
    "password.lock.title": "\u5BC6\u7801\u4FDD\u62A4",
    "password.lock.desc": "\u4E66\u7B7E\u7BA1\u7406\u5668\u5DF2\u542F\u7528\u5BC6\u7801\u4FDD\u62A4\uFF0C\u8BF7\u8F93\u5165\u5BC6\u7801\u4EE5\u7EE7\u7EED\u8BBF\u95EE\u3002",
    "password.lock.placeholder": "\u8BF7\u8F93\u5165\u5BC6\u7801",
    "password.lock.submit": "\u89E3\u9501",
    "password.lock.error": "\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5",
    "password.lock.noConfig": "Gitee\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u65E0\u6CD5\u9A8C\u8BC1\u5BC6\u7801",
    // === Tab 标签 ===
    "tab.config": "\u2699\uFE0F \u914D\u7F6E",
    "tab.shortcut": "\u2328\uFE0F \u5FEB\u6377\u952E",
    "tab.password": "\u{1F512} \u5BC6\u7801",
    "tab.feedback": "\u{1F4AC} \u53CD\u9988",
    // === 反馈 ===
    "feedback.title": "\u{1F4AC} \u53CD\u9988\u4E0E\u4EA4\u6D41",
    "feedback.desc": "\u5982\u679C\u60A8\u5728\u4F7F\u7528\u4E2D\u9047\u5230\u95EE\u9898\u6216\u6709\u529F\u80FD\u5EFA\u8BAE\uFF0C\u6B22\u8FCE\u901A\u8FC7\u4EE5\u4E0B\u6E20\u9053\u53CD\u9988\uFF1A",
    "feedback.giteeIssue": "Gitee Issue",
    "feedback.giteeIssueDesc": "\u5728 Gitee \u4E0A\u63D0\u4EA4\u95EE\u9898\u6216\u5EFA\u8BAE",
    "feedback.githubIssue": "GitHub Issue",
    "feedback.githubIssueDesc": "\u5728 GitHub \u4E0A\u63D0\u4EA4\u95EE\u9898\u6216\u5EFA\u8BAE",
    "feedback.wechatOA": "\u5FAE\u4FE1\u516C\u4F17\u53F7",
    "feedback.wechatOADesc": "\u5173\u6CE8\u516C\u4F17\u53F7\u83B7\u53D6\u6700\u65B0\u52A8\u6001\u548C\u4F7F\u7528\u6280\u5DE7",
    "feedback.wechatOAName": "\u524D\u7AEF\u4E5F\u80FD\u8FD9\u4E48\u6709\u8DA3",
    "feedback.wechatGroup": "\u5FAE\u4FE1\u4EA4\u6D41\u7FA4",
    "feedback.wechatGroupDesc": "\u626B\u63CF\u4E0B\u65B9\u4E8C\u7EF4\u7801\u52A0\u5165\u5FAE\u4FE1\u4EA4\u6D41\u7FA4\uFF0C\u4E0E\u5176\u4ED6\u7528\u6237\u4EA4\u6D41\u4F7F\u7528\u5FC3\u5F97",
    // === 主题设置 ===
    "theme.toggle": "\u5207\u6362\u4E3B\u9898",
    "theme.system": "\u8DDF\u968F\u7CFB\u7EDF",
    "theme.light": "\u6D45\u8272",
    "theme.dark": "\u6DF1\u8272",
    // === 语言 ===
    "lang.zh": "\u4E2D\u6587",
    "lang.en": "English",
    // === 配置导出/导入 ===
    "config.export": "\u{1F4E4} \u5BFC\u51FA\u914D\u7F6E",
    "config.import": "\u{1F4E5} \u5BFC\u5165\u914D\u7F6E",
    "msg.exportConfigSuccess": "\u914D\u7F6E\u5DF2\u5BFC\u51FA\uFF01",
    "msg.exportConfigFailed": "\u914D\u7F6E\u5BFC\u51FA\u5931\u8D25",
    "msg.importConfigSuccess": "\u914D\u7F6E\u5BFC\u5165\u6210\u529F\uFF01\u9875\u9762\u5C06\u81EA\u52A8\u5237\u65B0\u3002",
    "msg.importConfigFailed": "\u914D\u7F6E\u5BFC\u5165\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u683C\u5F0F",
    "msg.importConfigInvalid": "\u5BFC\u5165\u6587\u4EF6\u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u9009\u62E9\u6B63\u786E\u7684\u914D\u7F6E\u6587\u4EF6",
    "confirm.importConfig": "\u786E\u5B9A\u8981\u5BFC\u5165\u914D\u7F6E\u5417\uFF1F\u8FD9\u5C06\u8986\u76D6\u5F53\u524D\u7684\u6240\u6709\u914D\u7F6E\uFF08Gitee\u914D\u7F6E\u3001\u5FEB\u6377\u952E\u3001\u4E3B\u9898\u3001\u8BED\u8A00\uFF09\u3002",
    // === 版本更新 ===
    "version.current": "\u5F53\u524D\u7248\u672C\uFF1Av{0}",
    "version.newAvailable": "\u{1F389} \u53D1\u73B0\u65B0\u7248\u672C v{0}",
    "version.download": "\u7ACB\u5373\u4E0B\u8F7D",
    "version.viewChanges": "\u67E5\u770B\u66F4\u65B0",
    "version.dismiss": "\u5FFD\u7565\u6B64\u7248\u672C",
    "version.checking": "\u6B63\u5728\u68C0\u67E5\u66F4\u65B0...",
    "version.latest": "\u5DF2\u662F\u6700\u65B0\u7248\u672C",
    "version.checkFailed": "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25",
    "version.downloading": "\u6B63\u5728\u4E0B\u8F7D...",
    "version.downloadSuccess": "\u4E0B\u8F7D\u5B8C\u6210 \u2713",
    "version.downloadFailed": "\u4E0B\u8F7D\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"
  };

  // src/i18n/en.ts
  var en_default = {
    // === Common ===
    "app.name": "JYeontu Bookmarks Manager",
    "app.title": "Bookmarks Manager",
    "btn.help": "Help",
    "btn.cancel": "Cancel",
    "btn.save": "Save Config",
    "btn.refresh": "\u{1F504} Refresh",
    "btn.export": "\u{1F4E4} Export",
    "btn.import": "\u{1F4E5} Import",
    "btn.delete": "Delete",
    "btn.back": "Back",
    "btn.edit": "Edit",
    "btn.show": "Show",
    "btn.hide": "Hide",
    // === Popup Buttons ===
    "popup.systemBookmarks": "System Bookmarks",
    "popup.myBookmarks": "My Bookmarks",
    // === Gitee Config ===
    "gitee.token": "Gitee Token",
    "gitee.tokenPlaceholder": "Personal access token",
    "gitee.getToken": "Get Token \u2192",
    "gitee.owner": "Owner",
    "gitee.ownerPlaceholder": "e.g. zheng_yongtao",
    "gitee.repo": "Repository",
    "gitee.repoPlaceholder": "e.g. chrome-bookmarks-manage",
    "gitee.branch": "Branch",
    "gitee.branchPlaceholder": "e.g. master",
    "gitee.bookmarkDir": "Bookmark Directory",
    "gitee.bookmarkDirPlaceholder": "e.g. bookmarks",
    "gitee.bookmarkFile": "Bookmark File",
    "gitee.addFile": "New File",
    "gitee.deleteFile": "Delete File",
    "gitee.openRepo": "Open Gitee Repo",
    // === Sync ===
    "sync.overwriteSave": "Overwrite Save",
    "sync.mergeSave": "Merge Save",
    "sync.overwriteGet": "Overwrite Get",
    "sync.mergeGet": "Merge Get",
    // === Shortcut Settings ===
    "shortcut.title": "\u2328\uFE0F Shortcut Settings",
    "shortcut.enableSearch": "Enable global bookmark search",
    "shortcut.triggerKey": "Trigger Key",
    "shortcut.triggerAnyModifier": "Any modifier (Cmd/Ctrl/Alt)",
    "shortcut.triggerMeta": "Cmd (Mac) / Win (Windows)",
    "shortcut.pressCount": "Press Count",
    "shortcut.pressCountUnit": "{0} times",
    "shortcut.timeWindow": "Time Window",
    "shortcut.timeWindowFast": "500ms (fast)",
    "shortcut.timeWindowDefault": "800ms (default)",
    "shortcut.timeWindowSlow": "1000ms (slow)",
    "shortcut.timeWindowSlowest": "1500ms (slowest)",
    "shortcut.enableCloseTab": "Enable close current tab shortcut",
    "shortcut.modifier": "Modifier",
    "shortcut.key": "Key",
    "shortcut.keyPlaceholder": "e.g. W",
    // === Search ===
    "search.placeholder": "Search bookmarks...",
    // === Messages ===
    "msg.configSaved": "Gitee config saved!",
    "msg.shortcutSaved": "Shortcut settings saved!",
    "msg.tokenUpdated": "Token auto-updated",
    "msg.uploaded": "Bookmark data uploaded",
    "msg.uploadFailed": "Failed to upload bookmark data",
    "msg.hiddenBookmarksKept": "Hidden bookmarks from the manager have been preserved and merged into the save content",
    "msg.cannotGetManagerData": "Unable to get bookmark manager data, will overwrite directly with current bookmarks",
    "msg.getManagerDataFailed": "Failed to get bookmark manager data, will overwrite directly with current bookmarks",
    "msg.overwriteSaveSuccess": "Overwrite save successful!",
    "msg.overwriteSaveFailed": "Overwrite save failed: {0}",
    "msg.mergeSaveSuccess": "Merge save successful!",
    "msg.mergeSaveFailed": "Merge save failed: {0}",
    "msg.overwriteGetSuccess": "Overwrite get and replace local bookmarks successful!",
    "msg.overwriteGetFailed": "Overwrite get failed: {0}",
    "msg.mergeGetSuccess": "Merge get and replace local bookmarks successful!",
    "msg.mergeGetFailed": "Merge get failed: {0}",
    "msg.remoteDataFormatError": "Remote bookmark data format is incorrect",
    "msg.fillConfigFirst": "Please fill in the complete configuration first",
    "msg.selectFileFirst": "Please select a bookmark file to delete first",
    "msg.fileInfoFailed": "Failed to get file info",
    "msg.addFileSuccess": "Bookmark file created successfully: {0}",
    "msg.addFileFailed": "Failed to create bookmark file",
    "msg.addFileFailedDetail": "Failed to create bookmark file: {0}",
    "msg.deleteFileSuccess": "Bookmark file deleted successfully: {0}",
    "msg.deleteFileFailed": "Failed to delete bookmark file",
    "msg.deleteFileFailedDetail": "Failed to delete bookmark file: {0}",
    "msg.fillOwnerRepo": "Please fill in the owner and repository name first",
    "msg.selectBookmarkFile": "Please select a bookmark file first",
    "msg.cannotOpenManager": "Unable to open bookmarks manager automatically, please visit chrome://bookmarks/ manually",
    "msg.pleaseOpenManually": "Please open chrome://bookmarks/ manually",
    "msg.cannotOpenMyManager": "Unable to open My Bookmarks Manager",
    // === Confirm Dialogs ===
    "confirm.overwriteSave": "Are you sure you want to overwrite save to Gitee? This will overwrite the bookmark data in the remote repository.",
    "confirm.keepHidden": 'Keep hidden bookmarks from the remote repository?\n\nClick "OK": Keep remote hidden bookmarks and merge with local bookmarks\nClick "Cancel": Overwrite remote repository directly with local bookmarks',
    "confirm.mergeSave": "Are you sure you want to merge save to Gitee? This will merge local bookmarks with remote bookmarks and save.",
    "confirm.overwriteGet": "Are you sure you want to overwrite get? This will completely replace local bookmarks with remote bookmarks. Local bookmarks will be deleted.",
    "confirm.mergeGet": "Are you sure you want to merge get? This will merge remote bookmarks with local bookmarks and replace local data.",
    "confirm.deleteFile": "Are you sure you want to delete the bookmark file: {0}?",
    "confirm.deleteBookmark": "Are you sure you want to delete this bookmark?",
    // === Select Options ===
    "select.placeholder": "Please select",
    "select.loading": "Loading...",
    "select.selectFile": "Select a file",
    "select.getFileFailed": "Failed to get files",
    "select.selectBranch": "Please select a branch first",
    "select.getBranchFailed": "Failed to get branches",
    // === Input Prompts ===
    "prompt.bookmarkTitle": "Enter bookmark title:",
    "prompt.bookmarkUrl": "Enter bookmark URL:",
    "prompt.newFileName": "Enter bookmark file name (e.g. bookmarks.json):",
    // === Help Panel ===
    "help.title": "Feature Guide",
    "help.overwriteSave": "Overwrite Save:",
    "help.overwriteSaveDesc": "Overwrite save local bookmarks to Gitee",
    "help.mergeSave": "Merge Save:",
    "help.mergeSaveDesc": "Merge local bookmarks with Gitee bookmarks and save to Gitee",
    "help.overwriteGet": "Overwrite Get:",
    "help.overwriteGetDesc": "Replace local bookmarks with Gitee bookmark data",
    "help.mergeGet": "Merge Get:",
    "help.mergeGetDesc": "Get Gitee bookmark data and merge with local bookmarks to replace local data",
    "help.shortcutTitle": "Shortcuts",
    "help.shortcutCustomizable": "(Customizable in Shortcut Settings)",
    "help.shortcutCloseTab": "Modifier + Letter:",
    "help.shortcutCloseTabDesc": "Close current tab (default Alt+W)",
    "help.shortcutSearch": "Press modifier repeatedly:",
    "help.shortcutSearchDesc": "Open global bookmark search (default triple Cmd/Ctrl/Alt)",
    "help.shortcutContextMenu": "Context Menu:",
    "help.shortcutContextMenuDesc": "Right-click on any page to quickly open bookmark manager",
    "help.shortcutEsc": "ESC:",
    "help.shortcutEscDesc": "Close search box",
    "help.configTitle": "Configuration",
    "help.configToken": "Gitee Token:",
    "help.configTokenDesc": "Personal access token for API calls",
    "help.configOwner": "Owner:",
    "help.configOwnerDesc": "Gitee username or organization name",
    "help.configRepo": "Repository:",
    "help.configRepoDesc": "Repository name for storing bookmarks",
    "help.configBranch": "Branch:",
    "help.configBranchDesc": "Default master, auto-fetches repository branch list",
    "help.configDir": "Bookmark Directory:",
    "help.configDirDesc": "Directory path for bookmark files",
    "help.configFile": "Bookmark File:",
    "help.configFileDesc": "Specific bookmark file, supports creating and deleting",
    "help.tipsTitle": "Tips",
    "help.tipAutoConfig": "Auto Config:",
    "help.tipAutoConfigDesc": "Auto-fetches branches and file list after entering Token, Owner, and Repo",
    "help.tipSmartSort": "Smart Sort:",
    "help.tipSmartSortDesc": "Prioritizes recently used and most frequently used bookmarks when searching",
    "help.tipFileManage": "File Management:",
    "help.tipFileManageDesc": "Supports creating and deleting bookmark files in the specified directory",
    "help.tipQuickAccess": "Quick Access:",
    "help.tipQuickAccessDesc": "One-click jump to Gitee repository to view bookmark files",
    "help.contactTitle": "Contact",
    "help.wechat": "WeChat Official Account:",
    "help.wechatName": "Frontend Can Be Fun Too",
    "help.github": "GitHub:",
    "help.gitee": "Gitee:",
    "help.projectLink": "Project Link",
    // === Bookmark Manager Page ===
    "manager.title": "My Bookmarks Manager",
    "manager.header": "Bookmarks Manager",
    "manager.config": "\u2699\uFE0F Config",
    "manager.addBookmark": "+ Add Bookmark",
    "manager.searchPlaceholder": "Search bookmarks...",
    "manager.filterAll": "Show All",
    "manager.filterVisible": "Visible Only",
    "manager.filterHidden": "Hidden Only",
    "manager.statBookmarks": "Bookmarks",
    "manager.statFolders": "Folders",
    "manager.statRecent": "Recently Added",
    "manager.loading": "Loading...",
    "manager.selectFolder": "Select Folder",
    "manager.selectFolderHint": "Select a folder",
    "manager.selectFolderDesc": "Select a folder from the left panel to view its bookmarks",
    "manager.giteeConfig": "Gitee Repository Config",
    "manager.giteeOwner": "Gitee Username:",
    "manager.giteeOwnerPlaceholder": "Enter your Gitee username",
    "manager.giteeRepo": "Repository:",
    "manager.giteeRepoPlaceholder": "Enter repository name",
    "manager.giteeToken": "Access Token:",
    "manager.giteeTokenPlaceholder": "Enter your Gitee access token",
    "manager.folderItems": "Folder ({0} items)",
    "manager.scriptBookmark": "Script Bookmark",
    "manager.addBookmarkNeedExtension": "Adding bookmarks requires the browser extension environment",
    "manager.addBookmarkFailed": "Failed to add bookmark",
    "manager.editTodo": "Edit feature coming soon",
    "manager.editBookmark": "Edit Bookmark",
    "manager.editFolder": "Edit Folder",
    "manager.editTitle": "Title:",
    "manager.editTitlePlaceholder": "Enter bookmark title",
    "manager.editUrl": "URL:",
    "manager.editUrlPlaceholder": "Enter bookmark URL",
    "manager.editSuccess": "Bookmark updated",
    "manager.editFailed": "Failed to edit bookmark",
    "manager.editNeedExtension": "Editing bookmarks requires the browser extension environment",
    "manager.editNotFound": "Bookmark not found",
    "manager.editTitleRequired": "Title cannot be empty",
    "manager.deleteBookmarkNeedExtension": "Deleting bookmarks requires the browser extension environment",
    "manager.deleteBookmarkFailed": "Failed to delete bookmark",
    "manager.giteeConfigIncomplete": "Gitee configuration is incomplete",
    "manager.cannotGetFileContent": "Unable to get file content",
    "manager.configIncomplete": "Please fill in the complete configuration",
    "manager.configSaved": "Configuration saved!",
    "manager.sampleFolder": "Sample Folder",
    "manager.scriptExecution": "Script Execution",
    "manager.scriptExecutionResult": "Script execution result: ",
    "manager.executionError": "Execution error: ",
    "manager.scriptExecutionFailed": "Script execution failed: ",
    "manager.folderNotExist": "Folder does not exist",
    "manager.folderMayBeDeleted": "This folder may have been deleted",
    "manager.folderEmpty": "Folder is empty",
    "manager.folderNoBookmarks": "No bookmarks in this folder",
    "manager.noMatchingBookmarks": "No matching bookmarks",
    "manager.noBookmarksInFilter": "No bookmarks under current filter",
    "manager.noSearchResults": "No matching bookmarks found",
    "manager.searchNoResult": 'No results found for "{0}"',
    "manager.searchResults": "Search Results",
    "manager.items": "items",
    "manager.noMatchInFolder": "No matching bookmarks in this folder",
    "manager.noSearchResultInFolder": 'No results found for "{1}" in folder "{0}"',
    "manager.importBookmarks": "Import Bookmarks",
    "manager.importOverwrite": "Overwrite - Replace current bookmarks with imported data",
    "manager.importMerge": "Merge - Merge imported data with current bookmarks",
    "manager.importConfirm": "Confirm Import",
    "manager.importSuccess": "Bookmarks imported successfully!",
    "manager.importFailed": "Failed to import bookmarks",
    "manager.importInvalidFormat": "Invalid file format, please select a valid bookmark JSON file",
    "manager.importFileEmpty": "Import file is empty",
    "manager.importSummary": "Bookmark data to import:",
    "manager.importTotalBookmarks": "Total bookmarks: {0}",
    "manager.importTotalFolders": "Total folders: {0}",
    "manager.importHiddenBookmarks": "Hidden bookmarks: {0}",
    "manager.importHiddenFolders": "Hidden folders: {0}",
    // === Duplicate Detection ===
    "manager.detectDuplicates": "\u{1F50D} Detect Duplicates",
    "manager.duplicateTitle": "Duplicate Bookmark Detection",
    "manager.duplicateUrlMode": "URL Exact Match",
    "manager.duplicateTitleMode": "Title Fuzzy Match",
    "manager.duplicateStripQuery": "Ignore query params",
    "manager.duplicateGroups": "Duplicate groups: {0}",
    "manager.duplicateTotal": "Total duplicates: {0}",
    "manager.duplicateNone": "No duplicates found \u{1F389}",
    "manager.duplicateNoneDesc": "No duplicate bookmarks were detected",
    "manager.duplicateSelectAll": "Select All",
    "manager.duplicateDeselectAll": "Deselect All",
    "manager.duplicateDeleteSelected": "Delete Selected ({0})",
    "manager.duplicateDeleting": "Deleting...",
    "manager.duplicateDeleteSuccess": "Successfully deleted {0} duplicate bookmarks",
    "manager.duplicateDeleteFailed": "Deletion failed",
    "manager.duplicatePath": "Location: {0}",
    "manager.duplicateKeepHint": "(keep)",
    "confirm.deleteDuplicates": "Are you sure you want to delete the selected {0} duplicate bookmarks?",
    // === Link Check ===
    "manager.linkCheck": "\u{1F517} Check Dead Links",
    "manager.linkCheckTitle": "Dead Link Detection",
    "manager.linkCheckStart": "Start Check",
    "manager.linkCheckStop": "Stop",
    "manager.linkCheckProgress": "Progress: {0} / {1}",
    "manager.linkCheckOk": "\u2705 Available",
    "manager.linkCheckWarning": "\u26A0\uFE0F May be broken",
    "manager.linkCheckError": "\u274C Broken",
    "manager.linkCheckNoBroken": "All links are working \u{1F389}",
    "manager.linkCheckNoBrokenDesc": "No broken links were detected in your bookmarks",
    "manager.linkCheckTotal": "Total: {0}",
    "manager.linkCheckOkCount": "Available: {0}",
    "manager.linkCheckWarningCount": "May be broken: {0}",
    "manager.linkCheckErrorCount": "Broken: {0}",
    "manager.linkCheckSelectAllBroken": "Select All Broken",
    "manager.linkCheckDeselectAll": "Deselect All",
    "manager.linkCheckDeleteSelected": "Delete Selected ({0})",
    "manager.linkCheckDeleting": "Deleting...",
    "manager.linkCheckDeleteSuccess": "Successfully deleted {0} broken bookmarks",
    "manager.linkCheckDeleteFailed": "Deletion failed",
    "manager.linkCheckFilterAll": "All",
    "manager.linkCheckFilterBroken": "Broken Only",
    "manager.linkCheckFilterWarning": "Warning Only",
    "manager.linkCheckFilterOk": "Available Only",
    "manager.linkCheckTimeout": "Timeout",
    "manager.linkCheckNetError": "Network error",
    "manager.linkCheckConcurrency": "Concurrency",
    "confirm.deleteBrokenLinks": "Are you sure you want to delete the selected {0} broken bookmarks? This cannot be undone.",
    // === Content Script ===
    "content.openManually": "Please open bookmark manually: {0}",
    "content.cannotOpen": "Cannot open this type of bookmark, please visit manually: {0}",
    // === Password Settings ===
    "password.title": "\u{1F512} Password Settings",
    "password.enable": "Enable password protection",
    "password.label": "Password",
    "password.placeholder": "Enter password",
    "password.confirmLabel": "Confirm Password",
    "password.confirmPlaceholder": "Enter password again",
    "password.save": "Save Password Settings",
    "password.msg.saved": "Password settings saved!",
    "password.msg.saveFailed": "Failed to save password settings",
    "password.msg.mismatch": "Passwords do not match",
    "password.msg.empty": "Password cannot be empty",
    "password.msg.configFirst": "Please configure Gitee info first (Token, Owner, Repo, Branch, Bookmark Dir)",
    "password.msg.disabled": "Password protection disabled",
    "password.msg.enabled": "Password protection enabled",
    "password.msg.noPassword": "No password set, password protection will be disabled",
    "password.lock.title": "Password Protected",
    "password.lock.desc": "This bookmark manager is password protected. Please enter the password to continue.",
    "password.lock.placeholder": "Enter password",
    "password.lock.submit": "Unlock",
    "password.lock.error": "Incorrect password, please try again",
    "password.lock.noConfig": "Gitee configuration is incomplete, cannot verify password",
    // === Tabs ===
    "tab.config": "\u2699\uFE0F Config",
    "tab.shortcut": "\u2328\uFE0F Shortcuts",
    "tab.password": "\u{1F512} Password",
    "tab.feedback": "\u{1F4AC} Feedback",
    // === Feedback ===
    "feedback.title": "\u{1F4AC} Feedback & Community",
    "feedback.desc": "If you encounter any issues or have feature suggestions, feel free to reach out:",
    "feedback.giteeIssue": "Gitee Issue",
    "feedback.giteeIssueDesc": "Submit issues or suggestions on Gitee",
    "feedback.githubIssue": "GitHub Issue",
    "feedback.githubIssueDesc": "Submit issues or suggestions on GitHub",
    "feedback.wechatOA": "WeChat Official Account",
    "feedback.wechatOADesc": "Follow for latest updates and tips",
    "feedback.wechatOAName": "\u524D\u7AEF\u4E5F\u80FD\u8FD9\u4E48\u6709\u8DA3",
    "feedback.wechatGroup": "WeChat Group",
    "feedback.wechatGroupDesc": "Scan the QR code below to join the WeChat group and discuss with other users",
    // === Theme Settings ===
    "theme.toggle": "Toggle Theme",
    "theme.system": "System",
    "theme.light": "Light",
    "theme.dark": "Dark",
    // === Language ===
    "lang.zh": "\u4E2D\u6587",
    "lang.en": "English",
    // === Config Export/Import ===
    "config.export": "\u{1F4E4} Export Config",
    "config.import": "\u{1F4E5} Import Config",
    "msg.exportConfigSuccess": "Config exported!",
    "msg.exportConfigFailed": "Failed to export config",
    "msg.importConfigSuccess": "Config imported successfully! Page will refresh.",
    "msg.importConfigFailed": "Failed to import config, please check file format",
    "msg.importConfigInvalid": "Invalid config file format, please select a valid config file",
    "confirm.importConfig": "Are you sure you want to import config? This will overwrite all current settings (Gitee config, shortcuts, theme, language).",
    // === Version Update ===
    "version.current": "Version: v{0}",
    "version.newAvailable": "\u{1F389} New version v{0} available",
    "version.download": "Download",
    "version.viewChanges": "Changes",
    "version.dismiss": "Dismiss",
    "version.checking": "Checking for updates...",
    "version.latest": "Up to date",
    "version.checkFailed": "Update check failed",
    "version.downloading": "Downloading...",
    "version.downloadSuccess": "Downloaded \u2713",
    "version.downloadFailed": "Download failed, retry"
  };

  // src/i18n/index.ts
  var allMessages = {
    "zh-CN": zh_CN_default,
    "en": en_default
  };
  var currentLocale = "zh-CN";
  var messages = zh_CN_default;
  async function initLocale() {
    const saved = await getStoredLocale();
    if (saved && allMessages[saved]) {
      currentLocale = saved;
    } else {
      const browserLang = typeof navigator !== "undefined" && navigator.language || "zh-CN";
      currentLocale = browserLang.startsWith("zh") ? "zh-CN" : "en";
    }
    messages = allMessages[currentLocale];
  }
  function t(key, ...args) {
    let text = messages[key] || allMessages["zh-CN"][key] || key;
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, arg);
    });
    return text;
  }
  function getLocale() {
    return currentLocale;
  }
  async function setLocale(locale) {
    currentLocale = locale;
    messages = allMessages[locale];
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ app_locale: locale }, () => resolve());
      });
    }
  }
  function translateDOM(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = t(key);
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.title = t(key);
    });
  }
  function getStoredLocale() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["app_locale"], (result) => {
          resolve(result.app_locale || null);
        });
      } else {
        resolve(null);
      }
    });
  }

  // src/theme.ts
  var STORAGE_KEY = "app_theme";
  function getEffectiveTheme(mode) {
    if (mode === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return mode;
  }
  function applyTheme(mode) {
    const effective = getEffectiveTheme(mode);
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.style.colorScheme = effective;
    updateThemeIcon(mode);
  }
  function updateThemeIcon(mode) {
    const iconEl = document.getElementById("themeIcon");
    if (!iconEl) return;
    const icons = {
      system: "\u{1F5A5}\uFE0F",
      light: "\u2600\uFE0F",
      dark: "\u{1F319}"
    };
    iconEl.textContent = icons[mode] || "\u{1F5A5}\uFE0F";
    const labelEl = document.getElementById("themeLabel");
    if (labelEl) {
      const labels = {
        system: labelEl.dataset.labelSystem || "\u8DDF\u968F\u7CFB\u7EDF",
        light: labelEl.dataset.labelLight || "\u6D45\u8272",
        dark: labelEl.dataset.labelDark || "\u6DF1\u8272"
      };
      labelEl.textContent = labels[mode];
    }
  }
  function cycleTheme(current) {
    const order = ["system", "light", "dark"];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  }
  function getStoredTheme() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          resolve(result[STORAGE_KEY] || "system");
        });
      } else {
        resolve("system");
      }
    });
  }
  function saveTheme(mode) {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: mode }, () => resolve());
      } else {
        resolve();
      }
    });
  }
  async function initTheme() {
    const mode = await getStoredTheme();
    applyTheme(mode);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", () => {
      getStoredTheme().then((currentMode) => {
        if (currentMode === "system") {
          applyTheme("system");
        }
      });
    });
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[STORAGE_KEY]) {
          const newMode = changes[STORAGE_KEY].newValue;
          applyTheme(newMode);
        }
      });
    }
    return mode;
  }
  function setupThemeToggle() {
    const toggleBtn = document.getElementById("themeToggle");
    if (!toggleBtn) return;
    let currentMode = "system";
    getStoredTheme().then((mode) => {
      currentMode = mode;
      updateThemeIcon(mode);
    });
    toggleBtn.addEventListener("click", async () => {
      currentMode = cycleTheme(currentMode);
      applyTheme(currentMode);
      await saveTheme(currentMode);
    });
  }

  // src/bookmark-manager.js
  var t2 = (key, ...args) => t(key, ...args);
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
              title: t2("manager.sampleFolder"),
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
    // 执行脚本书签（符合 MV3 CSP，使用 chrome.scripting API 替代 eval/document.write）
    executeScript(scriptUrl) {
      if (scriptUrl.startsWith("javascript:")) {
        const script = scriptUrl.substring(11);
        try {
          chrome.tabs.query({ currentWindow: true }, (tabs) => {
            const targetTab = tabs.find(
              (tab) => tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
            );
            if (targetTab && targetTab.id) {
              chrome.scripting.executeScript({
                target: { tabId: targetTab.id },
                world: "MAIN",
                func: (code) => {
                  const s = document.createElement("script");
                  s.textContent = decodeURIComponent(code);
                  (document.head || document.documentElement).appendChild(s);
                  s.remove();
                },
                args: [script]
              }).then(() => {
                chrome.tabs.update(targetTab.id, { active: true });
              }).catch((error) => {
                alert(t2("manager.scriptExecutionFailed") + error.message);
              });
            } else {
              alert(t2("manager.noWebPageTab") || "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u7F51\u9875\u6807\u7B7E\u9875\uFF0C\u518D\u6267\u884C\u811A\u672C\u4E66\u7B7E");
            }
          });
        } catch (error) {
          alert(t2("manager.scriptExecutionFailed") + error.message);
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
          <h3>${t2("manager.selectFolderHint")}</h3>
          <p>${t2("manager.selectFolderDesc")}</p>
        </div>
      `;
        return;
      }
      const parentFolder = this.findParentFolder(this.bookmarks, this.currentFolder.id);
      if (parentFolder) {
        this.backButton.style.display = "flex";
        this.backButton.setAttribute("data-parent-id", parentFolder.id);
        this.backButton.querySelector(".back-text").textContent = `${t2("btn.back")} ${parentFolder.title}`;
      } else {
        this.backButton.style.display = "none";
      }
      const folder = this.findFolderById(this.bookmarks, this.currentFolder.id);
      if (!folder) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t2("manager.folderNotExist")}</h3>
          <p>${t2("manager.folderMayBeDeleted")}</p>
        </div>
      `;
        return;
      }
      this.currentFolder = folder;
      const bookmarks = this.currentFolder.children || [];
      if (bookmarks.length === 0) {
        this.bookmarkTree.innerHTML = `
        <div class="empty-state">
          <h3>${t2("manager.folderEmpty")}</h3>
          <p>${t2("manager.folderNoBookmarks")}</p>
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
          <h3>${t2("manager.noMatchingBookmarks")}</h3>
          <p>${t2("manager.noBookmarksInFilter")}</p>
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
          <h3>${t2("manager.noSearchResults")}</h3>
          <p>${t2("manager.searchNoResult", searchTerm)}</p>
        </div>
      `;
        document.querySelectorAll(".folder-item").forEach((item) => {
          item.classList.remove("active");
        });
        this.panelTitle.textContent = t2("manager.searchResults");
        return;
      }
      this.bookmarkTree.innerHTML = this.renderSearchResultsList(searchResults, searchTerm);
      this.panelTitle.textContent = `${t2("manager.searchResults")} (${searchResults.length} ${t2("manager.items")})`;
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
            displayUrl = t2("manager.scriptBookmark");
            clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
          } else {
            faviconUrl = this.getFaviconUrl(bookmark.url);
            displayUrl = bookmark.url;
            clickHandler = `href="${bookmark.url}" target="_blank"`;
          }
          html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">\u22EE\u22EE</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t2("manager.statBookmarks")}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${this.highlightSearchTerm(bookmark.title, searchTerm)} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t2("btn.edit")}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t2("btn.show") : t2("btn.hide")}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t2("btn.delete")}</button>
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
          <h3>${t2("manager.noMatchInFolder")}</h3>
          <p>${t2("manager.noSearchResultInFolder", folder.title, searchTerm)}</p>
        </div>
      `;
        this.panelTitle.textContent = `${folder.title} - ${t2("manager.searchResults")} (0 ${t2("manager.items")})`;
        return;
      }
      this.bookmarkTree.innerHTML = this.renderSearchResultsList(searchResults, searchTerm);
      this.panelTitle.textContent = `${folder.title} - ${t2("manager.searchResults")} (${searchResults.length} ${t2("manager.items")})`;
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
            displayUrl = t2("manager.scriptBookmark");
            clickHandler = `data-script-url="${encodeURIComponent(bookmark.url)}" class="script-bookmark"`;
          } else {
            faviconUrl = this.getFaviconUrl(bookmark.url);
            displayUrl = bookmark.url;
            clickHandler = `href="${bookmark.url}" target="_blank"`;
          }
          html += `
          <div class="bookmark-item${hiddenClass}" data-bookmark-id="${bookmark.id}" draggable="true">
            <div class="drag-handle">\u22EE\u22EE</div>
            <img class="bookmark-icon" src="${faviconUrl}" alt="${t2("manager.statBookmarks")}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkgxNFYxNEgyVjJaIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0yIDZIMTRWNkg2VjJaIiBmaWxsPSIjNjY2Ii8+Cjwvc3ZnPgo='">
            <div class="bookmark-content">
              <a ${clickHandler} class="bookmark-title">${bookmark.title} ${hiddenIcon}</a>
              <div class="bookmark-url">${displayUrl}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t2("btn.edit")}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t2("btn.show") : t2("btn.hide")}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t2("btn.delete")}</button>
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
              <div class="bookmark-url">${t2("manager.folderItems", String(bookmark.children.length))}</div>
              <div class="bookmark-actions">
                <button class="action-btn action-btn-edit" data-bookmark-id="${bookmark.id}">${t2("btn.edit")}</button>
                <button class="action-btn action-btn-hide" data-bookmark-id="${bookmark.id}">${isHidden ? t2("btn.show") : t2("btn.hide")}</button>
                <button class="action-btn action-btn-delete" data-bookmark-id="${bookmark.id}">${t2("btn.delete")}</button>
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
        alert(t2("manager.editNotFound"));
        return;
      }
      const isFolder = !!bookmark.children;
      const modalTitle = document.getElementById("editModalTitle");
      modalTitle.textContent = isFolder ? t2("manager.editFolder") : t2("manager.editBookmark");
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
        alert(t2("manager.editTitleRequired"));
        return;
      }
      const bookmark = this.findBookmarkById(id);
      if (!bookmark) {
        alert(t2("manager.editNotFound"));
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
        alert(t2("manager.editFailed"));
      }
    }
    deleteBookmark(id) {
      if (confirm(t2("confirm.deleteBookmark"))) {
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
            alert(t2("manager.deleteBookmarkNeedExtension"));
          }
        } catch (error) {
          alert(t2("manager.deleteBookmarkFailed"));
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
            alert(t2("manager.importInvalidFormat"));
            return;
          }
          if (!this.validateImportData(data)) {
            alert(t2("manager.importInvalidFormat"));
            return;
          }
          const stats = this.analyzeImportData(data);
          this.pendingImportData = data;
          this.showImportModal(stats);
        } catch (error) {
          alert(t2("manager.importInvalidFormat"));
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
      let html = `<div style="margin-bottom: 8px; font-weight: 500;">${t2("manager.importSummary")}</div>`;
      html += `<div class="import-stat">\u{1F4D1} ${t2("manager.importTotalBookmarks", stats.totalBookmarks)}</div>`;
      html += `<div class="import-stat">\u{1F4C1} ${t2("manager.importTotalFolders", stats.totalFolders)}</div>`;
      if (stats.hiddenBookmarks > 0 || stats.hiddenFolders > 0) {
        html += `<div class="import-stat"><span class="hidden-tag">\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F ${t2("manager.importHiddenBookmarks", stats.hiddenBookmarks)}</span></div>`;
        html += `<div class="import-stat"><span class="hidden-tag">\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F ${t2("manager.importHiddenFolders", stats.hiddenFolders)}</span></div>`;
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
        alert(t2("manager.importSuccess"));
      } catch (error) {
        alert(t2("manager.importFailed"));
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
          reject(new Error(t2("manager.giteeConfigIncomplete")));
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
            reject(new Error(t2("manager.cannotGetFileContent")));
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
        alert(t2("manager.configIncomplete"));
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
      alert(t2("manager.configSaved"));
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
          <div style="font-size: 16px; margin-bottom: 8px;">${t2("manager.duplicateNone")}</div>
          <div style="font-size: 13px;">${t2("manager.duplicateNoneDesc")}</div>
        </div>
      `;
        deleteBtn.style.display = "none";
        return;
      }
      const totalDuplicates = groups.reduce((sum, g) => sum + g.items.length - 1, 0);
      statsEl.style.display = "flex";
      statsEl.innerHTML = `
      <span>${t2("manager.duplicateGroups", String(groups.length))}</span>
      <span>${t2("manager.duplicateTotal", String(totalDuplicates))}</span>
    `;
      controlsEl.style.display = "";
      deleteBtn.style.display = "";
      let html = "";
      groups.forEach((group, groupIdx) => {
        html += `<div class="duplicate-group">`;
        html += `<div class="duplicate-group-header">`;
        html += `<span style="white-space: nowrap;">\u{1F4D1} ${group.items.length} ${t2("manager.items")}</span>`;
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
                ${isFirst ? `<span class="duplicate-keep-badge">${t2("manager.duplicateKeepHint")}</span>` : ""}
              </div>
              ${item.url ? `<div class="duplicate-item-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(item.url)}</div>` : ""}
              <div class="duplicate-item-path">${t2("manager.duplicatePath", this.escapeHtml(item.path))}</div>
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
      deleteBtn.textContent = t2("manager.duplicateDeleteSelected", String(count));
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
      if (!confirm(t2("confirm.deleteDuplicates", String(ids.length)))) {
        return;
      }
      const deleteBtn = document.getElementById("deleteDuplicatesBtn");
      deleteBtn.textContent = t2("manager.duplicateDeleting");
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
        alert(t2("manager.duplicateDeleteSuccess", String(ids.length)));
      } catch (error) {
        console.error("Delete duplicates failed:", error);
        alert(t2("manager.duplicateDeleteFailed"));
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
     * no-cors 模式下无法读取真实状态码，仅可判断网络是否可达
     */
    async checkLinkFallback(url) {
      if (!/^https?:\/\//i.test(url)) {
        return { status: "ok", statusCode: 0, url, message: "Skipped" };
      }
      const doFetch = async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2e4);
        try {
          const response = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
            mode: "no-cors"
          });
          return response;
        } finally {
          clearTimeout(timer);
        }
      };
      try {
        const response = await doFetch();
        return { status: "ok", statusCode: response.status || 0, url };
      } catch (err) {
        if (err.name === "AbortError") {
          return { status: "warning", statusCode: 0, url, message: "Timeout" };
        }
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const response = await doFetch();
          return { status: "ok", statusCode: response.status || 0, url };
        } catch (retryErr) {
          if (retryErr.name === "AbortError") {
            return { status: "warning", statusCode: 0, url, message: "Timeout" };
          }
          return { status: "error", statusCode: 0, url, message: retryErr.message || "Network error" };
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
        document.getElementById("linkCheckProgressText").textContent = t2("manager.linkCheckProgress", String(completed), String(total));
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
      <span>${t2("manager.linkCheckTotal", String(results.length))}</span>
      <span class="linkcheck-stat-ok">${t2("manager.linkCheckOkCount", String(okCount))}</span>
      <span class="linkcheck-stat-warning">${t2("manager.linkCheckWarningCount", String(warningCount))}</span>
      <span class="linkcheck-stat-error">${t2("manager.linkCheckErrorCount", String(errorCount))}</span>
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
          <div style="font-size:16px;margin-bottom:8px;">${t2("manager.linkCheckNoBroken")}</div>
          <div style="font-size:13px;">${t2("manager.linkCheckNoBrokenDesc")}</div>
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
        const statusLabel = item.checkStatus === "ok" ? t2("manager.linkCheckOk") : item.checkStatus === "warning" ? t2("manager.linkCheckWarning") : t2("manager.linkCheckError");
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
            <div class="linkcheck-item-path">${t2("manager.duplicatePath", this.escapeHtml(item.path))}</div>
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
      deleteBtn.textContent = t2("manager.linkCheckDeleteSelected", String(count));
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
      if (!confirm(t2("confirm.deleteBrokenLinks", String(ids.length)))) {
        return;
      }
      const deleteBtn = document.getElementById("deleteBrokenLinksBtn");
      deleteBtn.textContent = t2("manager.linkCheckDeleting");
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
        alert(t2("manager.linkCheckDeleteSuccess", String(ids.length)));
      } catch (error) {
        console.error("Delete broken links failed:", error);
        alert(t2("manager.linkCheckDeleteFailed"));
      }
    }
  };
  document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await initLocale();
    translateDOM();
    setupThemeToggle();
    window.__i18n = { t, translateDOM, getLocale, setLocale, initLocale };
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
      const rawConfig = await getConfig(["giteeToken", "giteeOwner", "giteeRepo", "giteeBranch", "giteeFilePath"]);
      const pToken = await decryptSafe(rawConfig.giteeToken || "");
      const pOwner = await decryptSafe(rawConfig.giteeOwner || "");
      const pRepo = await decryptSafe(rawConfig.giteeRepo || "");
      const pBranch = await decryptSafe(rawConfig.giteeBranch || "") || "master";
      const pFilePath = await decryptSafe(rawConfig.giteeFilePath || "");
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
                  lockError.textContent = t2("password.msg.empty");
                  return;
                }
                if (inputVal === pwdConfig.password) {
                  unlocked = true;
                  protectObserver.disconnect();
                  lockOverlay.style.display = "none";
                  initManager();
                } else {
                  lockError.textContent = t2("password.lock.error");
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
