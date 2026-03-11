(() => {
  // src/background.ts
  function isChromeExtensionContext() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && chrome.bookmarks;
  }
  var BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  };
  var HEAD_FALLBACK_CODES_MIN = 400;
  async function checkLink(url) {
    if (!/^https?:\/\//i.test(url)) {
      return { status: "ok", statusCode: 0, url, message: "Skipped (non-http)" };
    }
    const RESTRICTED_DOMAINS = [
      "chrome.google.com",
      "chromewebstore.google.com",
      "accounts.google.com",
      "clients2.google.com"
    ];
    try {
      const hostname = new URL(url).hostname;
      if (RESTRICTED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith("." + domain))) {
        return { status: "ok", statusCode: 0, url, message: "Skipped (restricted domain)" };
      }
    } catch {
    }
    const TIMEOUT_MS = 2e4;
    async function doFetch(method) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const resp = await fetch(url, {
          method,
          signal: controller.signal,
          redirect: "follow",
          headers: BROWSER_HEADERS
        });
        return resp;
      } finally {
        clearTimeout(timer);
      }
    }
    const STANDARD_4XX = /* @__PURE__ */ new Set([
      400,
      401,
      402,
      403,
      404,
      405,
      406,
      407,
      408,
      409,
      410,
      411,
      412,
      413,
      414,
      415,
      416,
      417,
      418,
      421,
      422,
      423,
      424,
      425,
      426,
      428,
      429,
      431,
      451
    ]);
    function classify(code) {
      if (code >= 200 && code < 400) {
        return { status: "ok", statusCode: code, url };
      }
      if (code === 404 || code === 410) {
        return { status: "error", statusCode: code, url };
      }
      if (code >= 400 && code < 500 && !STANDARD_4XX.has(code)) {
        return { status: "ok", statusCode: code, url };
      }
      if (code >= 400 && code < 500) {
        return { status: "warning", statusCode: code, url };
      }
      if (code >= 500) {
        return { status: "warning", statusCode: code, url };
      }
      return { status: "warning", statusCode: code, url };
    }
    async function checkOnce() {
      let response;
      try {
        response = await doFetch("HEAD");
      } catch (headErr) {
        if (headErr.name === "AbortError") {
          return { status: "warning", statusCode: 0, url, message: "Timeout" };
        }
        try {
          response = await doFetch("GET");
        } catch (getErr) {
          if (getErr.name === "AbortError") {
            return { status: "warning", statusCode: 0, url, message: "Timeout" };
          }
          return { status: "error", statusCode: 0, url, message: getErr.message || "Network error" };
        }
        return classify(response.status);
      }
      if (response.status >= HEAD_FALLBACK_CODES_MIN) {
        try {
          response = await doFetch("GET");
        } catch (getErr) {
          if (getErr.name === "AbortError") {
            return { status: "warning", statusCode: 0, url, message: "Timeout" };
          }
          return classify(response.status);
        }
      }
      return classify(response.status);
    }
    try {
      const firstResult = await checkOnce();
      if (firstResult.status === "error") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const retryResult = await checkOnce();
        return retryResult;
      }
      return firstResult;
    } catch (err) {
      return { status: "error", statusCode: 0, url, message: err.message || "Unknown error" };
    }
  }
  if (typeof chrome !== "undefined" && chrome.contextMenus) {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: "openBookmarkManager",
        title: "\u6253\u5F00\u6211\u7684\u4E66\u7B7E\u7BA1\u7406\u5668",
        contexts: ["page", "frame", "selection", "link", "image", "video", "audio"]
      });
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.app_locale) {
        const locale = changes.app_locale.newValue;
        const title = locale === "en" ? "Open My Bookmark Manager" : "\u6253\u5F00\u6211\u7684\u4E66\u7B7E\u7BA1\u7406\u5668";
        chrome.contextMenus.update("openBookmarkManager", { title });
      }
    });
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["app_locale"], (result) => {
        if (result.app_locale === "en") {
          chrome.contextMenus.update("openBookmarkManager", { title: "Open My Bookmark Manager" });
        }
      });
    }
    chrome.contextMenus.onClicked.addListener((info) => {
      if (info.menuItemId === "openBookmarkManager") {
        chrome.tabs.create({ url: chrome.runtime.getURL("bookmark-manager.html") });
      }
    });
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
      if (message && message.type === "executeBookmarklet") {
        const tabId = message.tabId || sender && sender.tab && sender.tab.id;
        if (tabId && message.code) {
          chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: (code) => {
              const script = document.createElement("script");
              script.textContent = decodeURIComponent(code);
              (document.head || document.documentElement).appendChild(script);
              script.remove();
            },
            args: [message.code]
          }).catch(() => {
          });
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
