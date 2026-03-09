declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' &&
         chrome.runtime &&
         chrome.runtime.onMessage &&
         chrome.bookmarks;
}

// ========== 失效链接检测 ==========

/**
 * 检测单个链接的可用性
 * 优先使用 HEAD 请求，若服务器不支持则降级为 GET
 * 返回 status: 'ok' | 'warning' | 'error'
 */
async function checkLink(url: string): Promise<{
  status: 'ok' | 'warning' | 'error';
  statusCode: number;
  url: string;
  message?: string;
}> {
  // 跳过非 http(s) 协议的链接
  if (!/^https?:\/\//i.test(url)) {
    return { status: 'ok', statusCode: 0, url, message: 'Skipped (non-http)' };
  }

  const TIMEOUT_MS = 15000;

  try {
    // 第 1 步：尝试 HEAD 请求
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller1.signal,
        redirect: 'follow',
      });
      clearTimeout(timer1);
    } catch (headErr: any) {
      clearTimeout(timer1);
      // HEAD 被拒绝（非超时），降级为 GET
      if (headErr.name !== 'AbortError') {
        const controller2 = new AbortController();
        const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
        try {
          response = await fetch(url, {
            method: 'GET',
            signal: controller2.signal,
            redirect: 'follow',
          });
          clearTimeout(timer2);
        } catch (getErr: any) {
          clearTimeout(timer2);
          if (getErr.name === 'AbortError') {
            return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
          }
          return { status: 'error', statusCode: 0, url, message: getErr.message || 'Network error' };
        }
      } else {
        // HEAD 超时
        return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
      }
    }

    // 如果 HEAD 返回 405/501，降级为 GET
    if (response!.status === 405 || response!.status === 501) {
      const controller3 = new AbortController();
      const timer3 = setTimeout(() => controller3.abort(), TIMEOUT_MS);
      try {
        response = await fetch(url, {
          method: 'GET',
          signal: controller3.signal,
          redirect: 'follow',
        });
        clearTimeout(timer3);
      } catch (getErr: any) {
        clearTimeout(timer3);
        if (getErr.name === 'AbortError') {
          return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
        }
        return { status: 'error', statusCode: 0, url, message: getErr.message || 'Network error' };
      }
    }

    const code = response!.status;

    // 2xx / 3xx → 可用
    if (code >= 200 && code < 400) {
      return { status: 'ok', statusCode: code, url };
    }
    // 404 / 410 → 已失效
    if (code === 404 || code === 410) {
      return { status: 'error', statusCode: code, url };
    }
    // 429 / 5xx → 可能失效（服务器临时问题）
    if (code === 429 || code >= 500) {
      return { status: 'warning', statusCode: code, url };
    }
    // 其他 4xx → 已失效
    return { status: 'error', statusCode: code, url };

  } catch (err: any) {
    return { status: 'error', statusCode: 0, url, message: err.message || 'Unknown error' };
  }
}

// ========== 消息监听 ==========

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

    // 失效链接检测：检测单个链接
    if (message && message.type === 'checkLink') {
      checkLink(message.url).then((result) => {
        sendResponse(result);
      }).catch(() => {
        sendResponse({ status: 'error', statusCode: 0, url: message.url, message: 'Check failed' });
      });
      return true; // 异步响应
    }

    sendResponse({ success: true });
  });
} 