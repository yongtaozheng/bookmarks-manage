(() => {
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

  // src/content-search.ts
  initLocale();
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.app_locale) {
        initLocale();
      }
    });
  }
  function isChromeExtensionContext() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;
  }
  var DEFAULT_SHORTCUT_CONFIG = {
    search: {
      triggerKey: "any_modifier",
      pressCount: 3,
      timeWindow: 800,
      enabled: true
    },
    closeTab: {
      enabled: true,
      modifier: "Alt",
      key: "w"
    }
  };
  var shortcutConfig = { ...DEFAULT_SHORTCUT_CONFIG, search: { ...DEFAULT_SHORTCUT_CONFIG.search }, closeTab: { ...DEFAULT_SHORTCUT_CONFIG.closeTab } };
  function mergeShortcutConfig(saved) {
    return {
      search: { ...DEFAULT_SHORTCUT_CONFIG.search, ...saved.search || {} },
      closeTab: { ...DEFAULT_SHORTCUT_CONFIG.closeTab, ...saved.closeTab || {} }
    };
  }
  function loadShortcutConfig() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["shortcut_config"], (result) => {
          if (result.shortcut_config) {
            try {
              resolve(mergeShortcutConfig(JSON.parse(result.shortcut_config)));
            } catch {
              resolve({ ...DEFAULT_SHORTCUT_CONFIG, search: { ...DEFAULT_SHORTCUT_CONFIG.search }, closeTab: { ...DEFAULT_SHORTCUT_CONFIG.closeTab } });
            }
          } else {
            resolve({ ...DEFAULT_SHORTCUT_CONFIG, search: { ...DEFAULT_SHORTCUT_CONFIG.search }, closeTab: { ...DEFAULT_SHORTCUT_CONFIG.closeTab } });
          }
        });
      } else {
        resolve({ ...DEFAULT_SHORTCUT_CONFIG, search: { ...DEFAULT_SHORTCUT_CONFIG.search }, closeTab: { ...DEFAULT_SHORTCUT_CONFIG.closeTab } });
      }
    });
  }
  loadShortcutConfig().then((config) => {
    shortcutConfig = config;
  });
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.shortcut_config) {
        try {
          shortcutConfig = mergeShortcutConfig(JSON.parse(changes.shortcut_config.newValue));
        } catch {
        }
      }
    });
  }
  var cmdCount = 0;
  var lastCmdTime = 0;
  var searchBox = null;
  var inputEl = null;
  var resultList = null;
  var results = [];
  var selectedIdx = -1;
  var allBookmarks = [];
  var isComposing = false;
  var keyboardPriority = false;
  var heldModifierKeys = /* @__PURE__ */ new Set();
  var modifierUsedInCombo = false;
  async function fetchAllBookmarks() {
    if (!isChromeExtensionContext()) {
      return [];
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "getAllBookmarks" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve([]);
            return;
          }
          resolve(res?.tree || []);
        });
      } catch (error) {
        resolve([]);
      }
    });
  }
  window.addEventListener("keydown", (e) => {
    try {
      const isModifierKey = e.key === "Meta" || e.key === "OS" || e.key === "Control" || e.key === "Alt";
      if (isModifierKey && !e.repeat) {
        heldModifierKeys.add(e.key);
        if (heldModifierKeys.size === 1) {
          modifierUsedInCombo = false;
        } else {
          modifierUsedInCombo = true;
        }
      } else if (!isModifierKey && heldModifierKeys.size > 0) {
        modifierUsedInCombo = true;
      }
    } catch {
    }
  }, true);
  window.addEventListener("blur", () => {
    heldModifierKeys.clear();
    modifierUsedInCombo = false;
  }, true);
  window.addEventListener("keyup", (e) => {
    try {
      const isModifierKey = e.key === "Meta" || e.key === "OS" || e.key === "Control" || e.key === "Alt";
      if (isModifierKey) {
        heldModifierKeys.delete(e.key);
      }
      if (isModifierKey && shortcutConfig.search.enabled) {
        let matchesTrigger = false;
        if (shortcutConfig.search.triggerKey === "any_modifier") {
          matchesTrigger = true;
        } else {
          const normalizedKey = e.key === "OS" ? "Meta" : e.key;
          matchesTrigger = normalizedKey === shortcutConfig.search.triggerKey;
        }
        if (matchesTrigger && !modifierUsedInCombo && heldModifierKeys.size === 0) {
          const now = Date.now();
          if (now - lastCmdTime < shortcutConfig.search.timeWindow) {
            cmdCount++;
          } else {
            cmdCount = 1;
          }
          lastCmdTime = now;
          if (cmdCount === shortcutConfig.search.pressCount) {
            e.preventDefault();
            showSearchBox();
            cmdCount = 0;
          }
        } else if (modifierUsedInCombo) {
          cmdCount = 0;
          lastCmdTime = 0;
        }
      } else if (e.key === "Escape" && searchBox) {
        removeSearchBox();
      } else if (shortcutConfig.closeTab.enabled) {
        const modifierPressed = shortcutConfig.closeTab.modifier === "Alt" && e.altKey || shortcutConfig.closeTab.modifier === "Control" && e.ctrlKey || shortcutConfig.closeTab.modifier === "Meta" && e.metaKey;
        const keyMatches = e.key.toLowerCase() === shortcutConfig.closeTab.key.toLowerCase();
        if (modifierPressed && keyMatches && isChromeExtensionContext()) {
          e.preventDefault();
          try {
            chrome.runtime.sendMessage({ type: "closeCurrentTab" });
          } catch {
          }
        }
      }
    } catch (error) {
    }
  }, true);
  if (window.location.href.includes("gitee.com/api/v5/swagger")) {
    let extractToken = function() {
      const tokenElement = document.querySelector('input[name="access_token"].ivu-input');
      if (!tokenElement) return;
      const token = tokenElement.textContent || tokenElement.value;
      if (token && token.length > 20 && token !== lastDetectedToken) {
        lastDetectedToken = token;
        try {
          if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              type: "updateToken",
              token
            });
          }
        } catch (error) {
        }
      }
    };
    let lastDetectedToken = "";
    extractToken();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          extractToken();
        }
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    setTimeout(extractToken, 1e3);
  }
  function getContentThemeColors() {
    let isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.get(["app_theme"], (result) => {
          if (result.app_theme === "dark") contentIsDark = true;
          else if (result.app_theme === "light") contentIsDark = false;
          else contentIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        });
      } catch {
      }
    }
    if (contentIsDark !== void 0) isDark = contentIsDark;
    return isDark ? {
      isDark: true,
      bg: "#1e1e2e",
      border: "#89b4fa",
      text: "#cdd6f4",
      textMuted: "#a6adc8",
      selectedBg: "#1a3a6e",
      selectedText: "#89b4fa",
      shadow: "rgba(0,0,0,0.5)"
    } : {
      isDark: false,
      bg: "#fff",
      border: "#42b983",
      text: "#333",
      textMuted: "#666",
      selectedBg: "#e3eefa",
      selectedText: "#1976d2",
      shadow: "rgba(60,60,60,0.18)"
    };
  }
  var contentIsDark = void 0;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.app_theme) {
        const mode = changes.app_theme.newValue;
        if (mode === "dark") contentIsDark = true;
        else if (mode === "light") contentIsDark = false;
        else contentIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    });
  }
  function showSearchBox() {
    if (searchBox) return;
    const themeColors = getContentThemeColors();
    searchBox = document.createElement("div");
    searchBox.style.position = "fixed";
    searchBox.style.top = "0";
    searchBox.style.left = "50%";
    searchBox.style.transform = "translateX(-50%)";
    searchBox.style.zIndex = "999999";
    searchBox.style.background = "transparent";
    searchBox.style.width = "100vw";
    searchBox.style.display = "flex";
    searchBox.style.flexDirection = "column";
    searchBox.style.alignItems = "center";
    searchBox.style.pointerEvents = "none";
    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = t("search.placeholder");
    inputEl.style.fontSize = "1.4em";
    inputEl.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', '\u5FAE\u8F6F\u96C5\u9ED1', sans-serif";
    inputEl.style.padding = "0.5em 1em";
    inputEl.style.border = `1.5px solid ${themeColors.border}`;
    inputEl.style.borderRadius = "6px";
    inputEl.style.outline = "none";
    inputEl.style.marginTop = "1.5em";
    inputEl.style.background = themeColors.bg;
    inputEl.style.color = themeColors.text;
    inputEl.style.width = "50%";
    inputEl.style.maxWidth = "90vw";
    inputEl.style.height = "3em";
    inputEl.style.lineHeight = "3em";
    inputEl.style.boxShadow = `0 2px 16px 0 ${themeColors.shadow}`;
    inputEl.style.pointerEvents = "auto";
    resultList = document.createElement("ul");
    resultList.style.position = "absolute";
    resultList.style.top = "6em";
    resultList.style.left = "50%";
    resultList.style.transform = "translateX(-50%)";
    resultList.style.listStyle = "none";
    resultList.style.margin = "0";
    resultList.style.padding = "0";
    resultList.style.width = "50%";
    resultList.style.maxWidth = "90vw";
    resultList.style.maxHeight = "260px";
    resultList.style.overflowY = "auto";
    resultList.style.overflowX = "hidden";
    resultList.style.background = themeColors.bg;
    resultList.style.borderRadius = "6px";
    resultList.style.boxShadow = `0 1px 8px 0 ${themeColors.shadow}`;
    resultList.style.pointerEvents = "auto";
    searchBox.appendChild(inputEl);
    searchBox.appendChild(resultList);
    document.body.appendChild(searchBox);
    keyboardPriority = true;
    searchBox.addEventListener("mousemove", () => {
      keyboardPriority = false;
    });
    inputEl.focus();
    inputEl.addEventListener("compositionstart", () => {
      isComposing = true;
    });
    inputEl.addEventListener("compositionend", () => {
      isComposing = false;
    });
    inputEl.addEventListener("input", () => {
      window.onInputAsync && window.onInputAsync();
    });
    inputEl.addEventListener("keydown", onInputKeydown);
    document.addEventListener("mousedown", onDocClick, true);
    if (!allBookmarks.length) {
      fetchAllBookmarks().then((tree) => {
        allBookmarks = [];
        function flat(nodes, parent) {
          nodes.forEach((n) => {
            if (n.url) {
              allBookmarks.push({ ...n, type: "bookmark", parent });
            } else if (n.children) {
              allBookmarks.push({ ...n, type: "folder", parent });
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
      keyboardPriority = false;
      document.removeEventListener("mousedown", onDocClick, true);
    }
  }
  function getBookmarkUsageKey(bookmark) {
    return bookmark.url || bookmark.id;
  }
  async function getUsageData() {
    return new Promise((resolve) => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["bookmark_usage"], (result) => {
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
  async function setUsageData(data) {
    return new Promise((resolve) => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ bookmark_usage: JSON.stringify(data) }, () => resolve());
      } else {
        resolve();
      }
    });
  }
  async function recordBookmarkUsage(bookmark) {
    const key = getBookmarkUsageKey(bookmark);
    const usage = await getUsageData();
    if (!usage[key]) usage[key] = { count: 0, last: 0 };
    usage[key].count += 1;
    usage[key].last = Date.now();
    await setUsageData(usage);
  }
  async function onInput() {
    const val = inputEl.value.trim().toLowerCase();
    if (!val) {
      renderResults([]);
      return;
    }
    const folderMatches = allBookmarks.filter((b) => b.type === "folder" && b.title && b.title.toLowerCase().includes(val));
    if (folderMatches.length > 0) {
      let collectBookmarks = function(nodes) {
        nodes.forEach((n) => {
          if (n.url) folderBookmarks.push(n);
          if (n.children) collectBookmarks(n.children);
        });
      };
      const folderBookmarks = [];
      folderMatches.forEach((folder) => collectBookmarks(folder.children || []));
      results = folderBookmarks;
      selectedIdx = results.length ? 0 : -1;
      renderResults(results);
      return;
    }
    const usage = await getUsageData();
    const scored = allBookmarks.filter((b) => b.type === "bookmark").map((b) => {
      const score = fuzzyScore(val, b.title || "", b.url || "");
      const key = getBookmarkUsageKey(b);
      const u = usage[key] || { count: 0, last: 0 };
      return { ...b, score, usageCount: u.count, lastUsed: u.last };
    }).filter((b) => b.score > 0).sort((a, b) => {
      if (b.lastUsed !== a.lastUsed) return b.lastUsed - a.lastUsed;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.score - a.score;
    }).slice(0, 5);
    results = scored;
    selectedIdx = results.length ? 0 : -1;
    renderResults(results);
  }
  function fuzzyScore(q, title, url) {
    title = title.toLowerCase();
    url = url.toLowerCase();
    if (title.includes(q)) return 100 + (100 - title.indexOf(q));
    if (url.includes(q)) return 80 + (100 - url.indexOf(q));
    if (title.replace(/\s/g, "").startsWith(q.replace(/\s/g, ""))) return 60;
    let t2 = 0, i = 0;
    for (let c of q) {
      i = title.indexOf(c, i);
      if (i === -1) return 0;
      t2++;
      i++;
    }
    return t2 > 0 ? 30 + t2 : 0;
  }
  function renderResults(list, folderTitle) {
    if (!resultList) return;
    const colors = getContentThemeColors();
    resultList.innerHTML = "";
    list.forEach((item, idx) => {
      const li = document.createElement("li");
      li.textContent = item.title + (item.url ? ` (${item.url})` : "");
      li.style.padding = "0.4em 0.8em";
      li.style.cursor = "pointer";
      li.style.background = idx === selectedIdx ? colors.selectedBg : colors.bg;
      li.style.color = idx === selectedIdx ? colors.selectedText : colors.text;
      li.style.fontSize = "1.1em";
      li.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', '\u5FAE\u8F6F\u96C5\u9ED1', sans-serif";
      li.style.overflow = "hidden";
      li.style.textOverflow = "ellipsis";
      li.style.display = "-webkit-box";
      li.style.webkitBoxOrient = "vertical";
      li.style.webkitLineClamp = "5";
      li.style.maxHeight = "7em";
      li.style.wordBreak = "break-all";
      li.onmouseenter = () => {
        if (keyboardPriority) return;
        selectedIdx = idx;
        renderResults(list, folderTitle);
      };
      li.onmousedown = (e) => {
        e.preventDefault();
        jumpTo(idx);
      };
      resultList.appendChild(li);
    });
    if (selectedIdx >= 0 && resultList.children[selectedIdx + (folderTitle ? 1 : 0)]) {
      const el = resultList.children[selectedIdx + (folderTitle ? 1 : 0)];
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  function onInputKeydown(e) {
    if (isComposing) return;
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      keyboardPriority = true;
      selectedIdx = (selectedIdx + 1) % results.length;
      renderResults(results);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      keyboardPriority = true;
      selectedIdx = (selectedIdx - 1 + results.length) % results.length;
      renderResults(results);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx >= 0 && selectedIdx < results.length) {
        (async () => {
          await jumpTo(selectedIdx);
        })();
      }
    }
  }
  async function jumpTo(idx) {
    const bookmark = results[idx];
    const url = bookmark?.url;
    if (url) {
      await recordBookmarkUsage(bookmark);
      if (url.startsWith("javascript:")) {
        try {
          const script = url.substring(11);
          chrome.runtime.sendMessage({
            type: "executeBookmarklet",
            code: script
          });
        } catch (e) {
        }
      } else if (url.startsWith("data:")) {
        try {
          const newWindow = window.open(url, "_blank");
          if (!newWindow) {
            alert(t("content.openManually", url));
          }
        } catch (e) {
          alert(t("content.cannotOpen", url));
        }
      } else {
        window.open(url, "_blank");
      }
      removeSearchBox();
    }
  }
  function onDocClick(e) {
    if (searchBox && !searchBox.contains(e.target)) {
      removeSearchBox();
    }
  }
  if (typeof window !== "undefined") {
    window.onInputAsync = onInput;
  }
})();
