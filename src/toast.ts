import { t } from './i18n/index';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

let toastTimer: number | undefined;
let toastRemainingMs = 0;
let toastTimerStartedAt = 0;

function createToastElement(): HTMLElement {
  const style = document.createElement('style');
  style.id = 'appToastStyles';
  style.textContent = `
    .toast{position:fixed;top:18px;left:50%;z-index:20000;display:flex;align-items:center;gap:.55em;width:max-content;max-width:calc(100vw - 32px);padding:.65em .7em .65em .9em;border:1px solid rgba(255,255,255,.24);border-radius:8px;box-sizing:border-box;color:#fff;font:500 14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;text-align:left;overflow-wrap:anywhere;box-shadow:0 8px 24px rgba(0,0,0,.24);opacity:0;visibility:hidden;pointer-events:none;transform:translate(-50%,-10px) scale(.98);transition:opacity .18s ease,transform .18s ease,visibility .18s ease}
    .toast-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:1.25em;height:1.25em;border-radius:50%;background:rgba(255,255,255,.2);font-weight:700}
    .toast-message{min-width:0}.toast-success{background:#16805a}.toast-error{background:#c43d3d}.toast-warning{background:#a45b0a}.toast-info{background:#1769aa}
    .toast-close{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:1.5em;height:1.5em;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;font-size:1.1em;line-height:1;cursor:pointer;opacity:.72}
    .toast-close:hover,.toast-close:focus-visible{background:rgba(255,255,255,.16);opacity:1;outline:none}.toast-visible{opacity:1;visibility:visible;pointer-events:auto;transform:translate(-50%,0) scale(1)}
    @media(prefers-reduced-motion:reduce){.toast{transition:none}}
  `;
  document.head.appendChild(style);

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');

  const icon = document.createElement('span');
  icon.id = 'toastIcon';
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  const message = document.createElement('span');
  message.id = 'toastMessage';
  message.className = 'toast-message';
  const closeButton = document.createElement('button');
  closeButton.id = 'toastClose';
  closeButton.className = 'toast-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';

  toast.append(icon, message, closeButton);
  document.body.appendChild(toast);
  return toast;
}

function getToast(): HTMLElement {
  return document.getElementById('toast') || createToastElement();
}

function clearToastTimer() {
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
    toastTimer = undefined;
  }
}

export function hideToast() {
  clearToastTimer();
  toastRemainingMs = 0;
  document.getElementById('toast')?.classList.remove('toast-visible');
}

function startToastTimer(duration: number) {
  clearToastTimer();
  toastRemainingMs = duration;
  toastTimerStartedAt = Date.now();
  toastTimer = window.setTimeout(hideToast, duration);
}

function pauseToastTimer() {
  if (toastTimer === undefined) return;
  toastRemainingMs = Math.max(0, toastRemainingMs - (Date.now() - toastTimerStartedAt));
  clearToastTimer();
}

function resumeToastTimer() {
  const toast = document.getElementById('toast');
  if (!toast?.classList.contains('toast-visible') || toastTimer !== undefined || toastRemainingMs <= 0) return;
  startToastTimer(toastRemainingMs);
}

export function showToast(text: string, type: ToastType = 'success') {
  if (!text) return;
  const toast = getToast();
  const message = toast.querySelector('.toast-message') as HTMLElement;
  const icon = toast.querySelector('.toast-icon') as HTMLElement;
  const closeButton = toast.querySelector('.toast-close') as HTMLButtonElement;

  clearToastTimer();
  toast.classList.remove('toast-visible', 'toast-success', 'toast-error', 'toast-warning', 'toast-info');
  toast.classList.add(`toast-${type}`);
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  message.textContent = text;
  icon.textContent = type === 'success' ? '✓' : type === 'info' ? 'i' : '!';
  closeButton.setAttribute('aria-label', t('toast.close'));
  closeButton.title = t('toast.close');
  closeButton.onclick = hideToast;
  toast.onmouseenter = pauseToastTimer;
  toast.onmouseleave = resumeToastTimer;

  void toast.offsetWidth;
  toast.classList.add('toast-visible');

  const minimumDuration: Record<ToastType, number> = {
    success: 2600,
    info: 3200,
    warning: 4600,
    error: 5600,
  };
  const readingDuration = Math.min(9000, 1400 + Array.from(text).length * 70);
  startToastTimer(Math.max(minimumDuration[type], readingDuration));
}
