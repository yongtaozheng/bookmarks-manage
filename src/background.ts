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
    
    // 转发token更新消息给popup
    if (message.type === 'updateToken' && message.token) {
      console.log('Background转发token更新消息');
      // 存储token到storage，popup可以从storage中读取
      chrome.storage.local.set({ 'latestToken': message.token }, () => {
        console.log('Token已存储到storage');
      });
    }
    
    sendResponse({ success: true });
  });
} 