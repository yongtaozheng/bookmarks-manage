declare const chrome: any;

console.log('background loaded', chrome.bookmarks);

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  if (message && message.type === 'getAllBookmarks') {
    console.log('getAllBookmarks called', chrome.bookmarks);
    chrome.bookmarks.getTree((tree: any[]) => {
      sendResponse({ tree });
    });
    return true; // 异步响应
  }
}); 