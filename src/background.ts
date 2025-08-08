declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && 
         chrome.runtime && 
         chrome.runtime.onMessage &&
         chrome.bookmarks;
}

console.log('background loaded', chrome.bookmarks);

if (isChromeExtensionContext()) {
  chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (message && message.type === 'getAllBookmarks') {
      console.log('getAllBookmarks called', chrome.bookmarks);
      chrome.bookmarks.getTree((tree: any[]) => {
        sendResponse({ tree });
      });
      return true; // 异步响应
    }
    if (message && message.type === 'closeCurrentTab') {
      if (sender && sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
      }
    }
  });
} 