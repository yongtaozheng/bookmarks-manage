declare const chrome: any;

// 检查chrome API是否可用
function isChromeExtensionContext(): boolean {
  return typeof chrome !== 'undefined' &&
         chrome.runtime &&
         chrome.runtime.onMessage &&
         chrome.bookmarks;
}

// ========== 失效链接检测 ==========

/** 模拟真实浏览器的请求头，避免被服务器拒绝 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * HEAD 请求返回这些状态码时，降级为 GET 重试。
 * 涵盖反爬/人机验证、不支持 HEAD、限流等场景。
 * 注意：对于非标准状态码（如 468），也会匹配 ≥400 的通用判断。
 */
const HEAD_FALLBACK_CODES_MIN = 400; // HEAD 返回 >= 400 时均尝试 GET 降级

/**
 * 检测单个链接的可用性
 * 优先使用 HEAD 请求，若服务器不支持或返回异常则降级为 GET
 * 失败时自动重试一次
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

  // 跳过 Chrome 内部受限域名，这些域名会触发 CORS 限制，无法从扩展中正常访问
  const RESTRICTED_DOMAINS = [
    'chrome.google.com',
    'chromewebstore.google.com',
    'accounts.google.com',
    'clients2.google.com',
  ];
  try {
    const hostname = new URL(url).hostname;
    if (RESTRICTED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
      return { status: 'ok', statusCode: 0, url, message: 'Skipped (restricted domain)' };
    }
  } catch {
    // URL 解析失败，继续正常检测
  }

  const TIMEOUT_MS = 20000;

  /** 发起一次带超时的 fetch 请求 */
  async function doFetch(method: 'HEAD' | 'GET'): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      return resp;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * HTTP 标准 4xx 状态码集合（RFC 9110 等）
   * 不在此集合中的 4xx 码（如 468）为非标准码，通常是反爬/WAF 机制，链接实际可用
   */
  const STANDARD_4XX = new Set([
    400, 401, 402, 403, 404, 405, 406, 407, 408, 409,
    410, 411, 412, 413, 414, 415, 416, 417, 418,
    421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
  ]);

  /** 根据 HTTP 状态码判定链接状态 */
  function classify(code: number): { status: 'ok' | 'warning' | 'error'; statusCode: number; url: string } {
    // 2xx / 3xx → 可用
    if (code >= 200 && code < 400) {
      return { status: 'ok', statusCode: code, url };
    }
    // 404 / 410 → 已失效（明确的"资源不存在"语义）
    if (code === 404 || code === 410) {
      return { status: 'error', statusCode: code, url };
    }
    // 非标准 4xx（如 468 反爬虫、WAF 拦截等）→ 视为可用
    // 这些码不属于 HTTP 规范，通常由 CDN/防火墙返回，链接在浏览器中可以正常打开
    if (code >= 400 && code < 500 && !STANDARD_4XX.has(code)) {
      return { status: 'ok', statusCode: code, url };
    }
    // 标准 4xx（401/403 等）→ 可能失效（拒绝访问但链接存在）
    if (code >= 400 && code < 500) {
      return { status: 'warning', statusCode: code, url };
    }
    // 5xx → 可能失效（服务器临时问题）
    if (code >= 500) {
      return { status: 'warning', statusCode: code, url };
    }
    // 其他未知状态码 → 可能失效
    return { status: 'warning', statusCode: code, url };
  }

  /** 执行一次完整的链接检测（HEAD → 可能降级 GET） */
  async function checkOnce(): Promise<{
    status: 'ok' | 'warning' | 'error';
    statusCode: number;
    url: string;
    message?: string;
  }> {
    let response: Response;

    // 第 1 步：尝试 HEAD 请求
    try {
      response = await doFetch('HEAD');
    } catch (headErr: any) {
      if (headErr.name === 'AbortError') {
        return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
      }
      // HEAD 网络错误，降级为 GET
      try {
        response = await doFetch('GET');
      } catch (getErr: any) {
        if (getErr.name === 'AbortError') {
          return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
        }
        return { status: 'error', statusCode: 0, url, message: getErr.message || 'Network error' };
      }
      return classify(response.status);
    }

    // 第 2 步：如果 HEAD 返回非成功状态码，降级为 GET 验证
    // 很多网站对 HEAD 和 GET 返回不同的状态码（如反爬虫仅拦截 HEAD）
    if (response.status >= HEAD_FALLBACK_CODES_MIN) {
      try {
        response = await doFetch('GET');
      } catch (getErr: any) {
        if (getErr.name === 'AbortError') {
          return { status: 'warning', statusCode: 0, url, message: 'Timeout' };
        }
        // GET 也失败了，使用原始 HEAD 结果判定
        return classify(response.status);
      }
    }

    return classify(response.status);
  }

  // 执行检测，失败时重试一次
  try {
    const firstResult = await checkOnce();
    // 如果首次判定为 error，重试一次确认
    if (firstResult.status === 'error') {
      // 短暂等待后重试，避免因瞬时问题误判
      await new Promise(resolve => setTimeout(resolve, 1500));
      const retryResult = await checkOnce();
      return retryResult;
    }
    return firstResult;
  } catch (err: any) {
    return { status: 'error', statusCode: 0, url, message: err.message || 'Unknown error' };
  }
}

// ========== 右键菜单：打开书签管理器 ==========

if (typeof chrome !== 'undefined' && chrome.contextMenus) {
  // Service Worker 启动时创建右键菜单
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'openBookmarkManager',
      title: '打开我的书签管理器',
      contexts: ['page', 'frame', 'selection', 'link', 'image', 'video', 'audio'],
    });
  });

  // 监听语言变更，动态更新菜单标题
  chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
    if (areaName === 'local' && changes.app_locale) {
      const locale = changes.app_locale.newValue;
      const title = locale === 'en' ? 'Open My Bookmark Manager' : '打开我的书签管理器';
      chrome.contextMenus.update('openBookmarkManager', { title });
    }
  });

  // 初始化时根据当前语言设置菜单标题
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['app_locale'], (result: any) => {
      if (result.app_locale === 'en') {
        chrome.contextMenus.update('openBookmarkManager', { title: 'Open My Bookmark Manager' });
      }
    });
  }

  // 右键菜单点击处理（不设置 bmAuthTimestamp，需要密码校验）
  chrome.contextMenus.onClicked.addListener((info: any) => {
    if (info.menuItemId === 'openBookmarkManager') {
      chrome.tabs.create({ url: chrome.runtime.getURL('bookmark-manager.html') });
    }
  });
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

    // 执行 javascript: 书签脚本（替代 eval，符合 MV3 CSP 要求）
    if (message && message.type === 'executeBookmarklet') {
      const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
      if (tabId && message.code) {
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (code: string) => {
            const script = document.createElement('script');
            script.textContent = decodeURIComponent(code);
            (document.head || document.documentElement).appendChild(script);
            script.remove();
          },
          args: [message.code]
        }).catch(() => {
          // 静默处理：某些页面（如 chrome:// 页面）不允许注入脚本
        });
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