(() => {
  // src/background.ts
  function isChromeExtensionContext() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && chrome.bookmarks;
  }
  async function checkLink(url) {
    if (!/^https?:\/\//i.test(url)) {
      return { status: "ok", statusCode: 0, url, message: "Skipped (non-http)" };
    }
    const TIMEOUT_MS = 15e3;
    try {
      const controller1 = new AbortController();
      const timer1 = setTimeout(() => controller1.abort(), TIMEOUT_MS);
      let response;
      try {
        response = await fetch(url, {
          method: "HEAD",
          signal: controller1.signal,
          redirect: "follow"
        });
        clearTimeout(timer1);
      } catch (headErr) {
        clearTimeout(timer1);
        if (headErr.name !== "AbortError") {
          const controller2 = new AbortController();
          const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
          try {
            response = await fetch(url, {
              method: "GET",
              signal: controller2.signal,
              redirect: "follow"
            });
            clearTimeout(timer2);
          } catch (getErr) {
            clearTimeout(timer2);
            if (getErr.name === "AbortError") {
              return { status: "warning", statusCode: 0, url, message: "Timeout" };
            }
            return { status: "error", statusCode: 0, url, message: getErr.message || "Network error" };
          }
        } else {
          return { status: "warning", statusCode: 0, url, message: "Timeout" };
        }
      }
      if (response.status === 405 || response.status === 501) {
        const controller3 = new AbortController();
        const timer3 = setTimeout(() => controller3.abort(), TIMEOUT_MS);
        try {
          response = await fetch(url, {
            method: "GET",
            signal: controller3.signal,
            redirect: "follow"
          });
          clearTimeout(timer3);
        } catch (getErr) {
          clearTimeout(timer3);
          if (getErr.name === "AbortError") {
            return { status: "warning", statusCode: 0, url, message: "Timeout" };
          }
          return { status: "error", statusCode: 0, url, message: getErr.message || "Network error" };
        }
      }
      const code = response.status;
      if (code >= 200 && code < 400) {
        return { status: "ok", statusCode: code, url };
      }
      if (code === 404 || code === 410) {
        return { status: "error", statusCode: code, url };
      }
      if (code === 429 || code >= 500) {
        return { status: "warning", statusCode: code, url };
      }
      return { status: "error", statusCode: code, url };
    } catch (err) {
      return { status: "error", statusCode: 0, url, message: err.message || "Unknown error" };
    }
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
      if (message && message.type === "checkLink") {
        checkLink(message.url).then((result) => {
          sendResponse(result);
        }).catch(() => {
          sendResponse({ status: "error", statusCode: 0, url: message.url, message: "Check failed" });
        });
        return true;
      }
      sendResponse({ success: true });
    });
  }
})();
