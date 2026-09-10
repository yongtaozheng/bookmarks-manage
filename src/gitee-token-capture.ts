declare const chrome: any;

let lastDetectedToken = '';

function extractToken() {
  const tokenElement = document.querySelector('input[name="access_token"].ivu-input') as HTMLInputElement | null;
  const token = tokenElement?.value || tokenElement?.textContent || '';
  if (token.length <= 20 || token === lastDetectedToken) return;
  lastDetectedToken = token;
  chrome.runtime.sendMessage({ type: 'updateToken', token });
}

extractToken();

const observer = new MutationObserver(() => extractToken());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
window.setTimeout(extractToken, 1000);
