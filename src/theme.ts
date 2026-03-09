/**
 * 主题切换模块
 * 支持三档切换：跟随系统 / 亮色 / 暗色
 * 配置存储在 chrome.storage.local 中，key: app_theme
 */

declare const chrome: any;

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'app_theme';

/** 根据存储的偏好计算实际生效的主题 */
function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

/** 将主题应用到 document */
function applyTheme(mode: ThemeMode): void {
  const effective = getEffectiveTheme(mode);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.style.colorScheme = effective;
  updateThemeIcon(mode);
}

/** 更新切换按钮的图标 */
function updateThemeIcon(mode: ThemeMode): void {
  const iconEl = document.getElementById('themeIcon');
  if (!iconEl) return;
  const icons: Record<ThemeMode, string> = {
    system: '🖥️',
    light: '☀️',
    dark: '🌙',
  };
  iconEl.textContent = icons[mode] || '🖥️';

  const labelEl = document.getElementById('themeLabel');
  if (labelEl) {
    const labels: Record<ThemeMode, string> = {
      system: labelEl.dataset.labelSystem || '跟随系统',
      light: labelEl.dataset.labelLight || '浅色',
      dark: labelEl.dataset.labelDark || '深色',
    };
    labelEl.textContent = labels[mode];
  }
}

/** 循环切换: system → light → dark → system */
function cycleTheme(current: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ['system', 'light', 'dark'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

/** 读取已存储的主题偏好 */
function getStoredTheme(): Promise<ThemeMode> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (result: any) => {
        resolve((result[STORAGE_KEY] as ThemeMode) || 'system');
      });
    } else {
      resolve('system');
    }
  });
}

/** 保存主题偏好 */
function saveTheme(mode: ThemeMode): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: mode }, () => resolve());
    } else {
      resolve();
    }
  });
}

/** 初始化主题系统 */
export async function initTheme(): Promise<ThemeMode> {
  const mode = await getStoredTheme();
  applyTheme(mode);

  // 监听系统主题变化（跟随系统模式下实时响应）
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    getStoredTheme().then((currentMode) => {
      if (currentMode === 'system') {
        applyTheme('system');
      }
    });
  });

  // 监听 storage 变化，跨页面同步主题
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newMode = changes[STORAGE_KEY].newValue as ThemeMode;
        applyTheme(newMode);
      }
    });
  }

  return mode;
}

/** 绑定切换按钮事件 */
export function setupThemeToggle(): void {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  let currentMode: ThemeMode = 'system';
  getStoredTheme().then((mode) => {
    currentMode = mode;
    updateThemeIcon(mode);
  });

  toggleBtn.addEventListener('click', async () => {
    currentMode = cycleTheme(currentMode);
    applyTheme(currentMode);
    await saveTheme(currentMode);
  });
}
