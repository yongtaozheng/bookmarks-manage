/**
 * 轻量级 i18n 国际化模块
 * - 支持中文（zh-CN）和英文（en）
 * - 默认跟随浏览器语言，可由用户手动切换
 * - 语言偏好持久化到 chrome.storage.local
 * - 通过 chrome.storage.onChanged 实现跨页面实时同步
 */

declare const chrome: any;

import zhCN from './zh-CN';
import en from './en';

export type Locale = 'zh-CN' | 'en';

const allMessages: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en': en,
};

let currentLocale: Locale = 'zh-CN';
let messages: Record<string, string> = zhCN;

/**
 * 初始化语言：
 * 1. 优先读取用户手动设置的语言（chrome.storage.local）
 * 2. 无手动设置时跟随浏览器语言
 * 3. 最终 fallback 为中文
 */
export async function initLocale(): Promise<void> {
  const saved = await getStoredLocale();
  if (saved && allMessages[saved]) {
    currentLocale = saved;
  } else {
    // 跟随浏览器语言
    const browserLang = (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN';
    currentLocale = browserLang.startsWith('zh') ? 'zh-CN' : 'en';
  }
  messages = allMessages[currentLocale];
}

/**
 * 翻译函数
 * @param key - 翻译 key
 * @param args - 替换 {0}, {1}, ... 占位符
 * @returns 翻译后的文本，找不到 key 时返回 key 本身
 */
export function t(key: string, ...args: string[]): string {
  let text = messages[key] || allMessages['zh-CN'][key] || key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, arg);
  });
  return text;
}

/** 获取当前语言 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * 切换语言并持久化
 * @param locale - 目标语言
 */
export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  messages = allMessages[locale];
  // 持久化到 chrome.storage.local
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ app_locale: locale }, () => resolve());
    });
  }
}

/**
 * DOM 批量翻译：扫描所有标记了 data-i18n* 属性的元素并替换文本
 * 支持的属性：
 * - data-i18n="key"              → textContent
 * - data-i18n-placeholder="key"  → placeholder
 * - data-i18n-title="key"        → title 属性
 */
export function translateDOM(root: Element | Document = document): void {
  // textContent
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')!;
    el.textContent = t(key);
  });
  // placeholder
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')!;
    (el as HTMLInputElement).placeholder = t(key);
  });
  // title 属性
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title')!;
    (el as HTMLElement).title = t(key);
  });
}

/** 从 chrome.storage.local 读取用户语言偏好 */
function getStoredLocale(): Promise<Locale | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['app_locale'], (result: any) => {
        resolve(result.app_locale || null);
      });
    } else {
      resolve(null);
    }
  });
}
