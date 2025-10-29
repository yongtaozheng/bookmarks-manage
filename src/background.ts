declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && 
         chrome.runtime && 
         chrome.runtime.onMessage &&
         chrome.bookmarks;
}


if (isChromeExtensionContext()) {
  chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (message && message.type === 'getAllBookmarks') {
      chrome.bookmarks.getTree((tree: any[]) => {
        sendResponse({ tree });
      });
      return true; // 异步响应
    }
    
    if (message && message.type === 'getBookmarkManagerData') {
      // 从storage中获取书签管理器的数据
      chrome.storage.local.get(['bookmarkManagerData'], (result: any) => {
        sendResponse({ bookmarks: result.bookmarkManagerData || [] });
      });
      return true; // 异步响应
    }
    
    if (message && message.type === 'closeCurrentTab') {
      if (sender && sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
      }
    }
    
    // 转发token更新消息给popup
    if (message.type === 'updateToken' && message.token) {
      // 存储token到storage，popup可以从storage中读取
      chrome.storage.local.set({ 'latestToken': message.token }, () => {
        // Token已存储
      });
    }
    
    sendResponse({ success: true });
  });
} 