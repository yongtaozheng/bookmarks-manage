export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function safeExternalUrl(value: unknown): string {
  const raw = String(value ?? '');
  try {
    const url = new URL(raw);
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'file:', 'chrome:', 'edge:', 'about:', 'mailto:', 'tel:'];
    return allowedProtocols.includes(url.protocol) ? raw : '';
  } catch {
    return '';
  }
}
