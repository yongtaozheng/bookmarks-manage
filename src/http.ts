export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Unknown error';
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.clone().json();
    return body?.message || body?.error_description || body?.error || '';
  } catch {
    try {
      return (await response.clone().text()).trim();
    } catch {
      return '';
    }
  }
}

export async function assertResponseOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;
  const detail = await readErrorDetail(response);
  const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  throw new HttpError(detail ? `${status}: ${detail}` : `${fallbackMessage} (${status})`, response.status);
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number; fallbackMessage?: string } = {},
): Promise<T> {
  const response = await fetchWithTimeout(input, init, options.timeoutMs);
  await assertResponseOk(response, options.fallbackMessage || 'Request failed');
  return response.json() as Promise<T>;
}
