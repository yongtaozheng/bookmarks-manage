(() => {
  // src/background.ts
  function isChromeExtensionContext() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && chrome.bookmarks;
  }
  if (isChromeExtensionContext()) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === "getAllBookmarks") {
        chrome.bookmarks.getTree((tree) => {
          sendResponse({ tree });
        });
        return true;
      }
      if (message && message.type === "getBookmarkManagerData") {
        chrome.storage.local.get(["bookmarkManagerData"], (result) => {
          sendResponse({ bookmarks: result.bookmarkManagerData || [] });
        });
        return true;
      }
      if (message && message.type === "closeCurrentTab") {
        if (sender && sender.tab && sender.tab.id) {
          chrome.tabs.remove(sender.tab.id);
        }
      }
      if (message.type === "updateToken" && message.token) {
        chrome.storage.local.set({ "latestToken": message.token }, () => {
        });
      }
      sendResponse({ success: true });
    });
  }
})();
