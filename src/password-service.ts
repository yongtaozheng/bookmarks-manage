import { assertResponseOk, fetchWithTimeout } from './http';

declare const chrome: any;

export const PASSWORD_FILE_NAME = '密码.json';
const PASSWORD_POLICY_STORAGE_KEY = 'password_protection_policy_v2';
const PASSWORD_ITERATIONS = 600000;

export interface GiteePasswordLocation {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  bookmarkDir: string;
}

export interface PasswordPolicy {
  version: 2;
  enabled: boolean;
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  verifier: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function deriveVerifier(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function createPasswordPolicy(password: string, enabled = true): Promise<PasswordPolicy> {
  if (!enabled) {
    return { version: 2, enabled: false, algorithm: 'PBKDF2-SHA256', iterations: PASSWORD_ITERATIONS, salt: '', verifier: '' };
  }
  if (!password) throw new Error('Password cannot be empty');
  if (password.length > 1024) throw new Error('Password is too long');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveVerifier(password, salt, PASSWORD_ITERATIONS);
  return {
    version: 2,
    enabled: true,
    algorithm: 'PBKDF2-SHA256',
    iterations: PASSWORD_ITERATIONS,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifier),
  };
}

export async function verifyPassword(password: string, policy: PasswordPolicy): Promise<boolean> {
  if (!policy.enabled || !password || password.length > 1024 || !policy.salt || !policy.verifier) return false;
  const actual = await deriveVerifier(password, base64ToBytes(policy.salt), policy.iterations);
  const expected = base64ToBytes(policy.verifier);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

function isPasswordPolicy(value: any): value is PasswordPolicy {
  return value?.version === 2 &&
    typeof value.enabled === 'boolean' &&
    value.algorithm === 'PBKDF2-SHA256' &&
    Number.isInteger(value.iterations) &&
    typeof value.salt === 'string' &&
    typeof value.verifier === 'string';
}

async function normalizePasswordPolicy(value: any): Promise<PasswordPolicy> {
  if (isPasswordPolicy(value)) return value;
  if (value?.enabled && typeof value.password === 'string' && value.password) {
    return createPasswordPolicy(value.password);
  }
  return createPasswordPolicy('', false);
}

function storageGet(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result: any) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result?.[key]);
    });
  });
}

function storageSet(key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export async function getLocalPasswordPolicy(): Promise<PasswordPolicy | null> {
  const value = await storageGet(PASSWORD_POLICY_STORAGE_KEY);
  return isPasswordPolicy(value) ? value : null;
}

export function setLocalPasswordPolicy(policy: PasswordPolicy): Promise<void> {
  return storageSet(PASSWORD_POLICY_STORAGE_KEY, policy);
}

function passwordFileUrl(location: GiteePasswordLocation): string {
  const path = `${location.bookmarkDir ? `${location.bookmarkDir}/` : ''}${PASSWORD_FILE_NAME}`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://gitee.com/api/v5/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/contents/${encodedPath}`;
}

function encodePolicy(policy: PasswordPolicy): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(policy, null, 2)));
}

async function decodeRemotePolicy(content: string): Promise<{ policy: PasswordPolicy; legacy: boolean }> {
  const decoded = new TextDecoder().decode(base64ToBytes(content));
  const rawPolicy = JSON.parse(decoded);
  return {
    policy: await normalizePasswordPolicy(rawPolicy),
    legacy: !isPasswordPolicy(rawPolicy),
  };
}

export async function fetchRemotePasswordPolicy(location: GiteePasswordLocation): Promise<PasswordPolicy | null> {
  const response = await fetchWithTimeout(`${passwordFileUrl(location)}?ref=${encodeURIComponent(location.branch)}`, {
    headers: { Authorization: `token ${location.token}` },
  }, 5000);
  if (response.status === 404) return null;
  await assertResponseOk(response, 'Failed to load password policy');
  const file = await response.json();
  const { policy, legacy } = await decodeRemotePolicy(file.content || '');
  await setLocalPasswordPolicy(policy);
  if (legacy && file.sha) {
    const migrationResponse = await fetchWithTimeout(passwordFileUrl(location), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `token ${location.token}` },
      body: JSON.stringify({
        access_token: location.token,
        content: encodePolicy(policy),
        message: '迁移密码配置为安全校验格式',
        branch: location.branch,
        sha: file.sha,
      }),
    });
    await assertResponseOk(migrationResponse, 'Failed to migrate password policy');
  }
  return policy;
}

export async function resolvePasswordPolicy(location?: GiteePasswordLocation): Promise<PasswordPolicy | null> {
  const localPolicy = await getLocalPasswordPolicy();
  if (!location?.token || !location.owner || !location.repo || !location.branch) return localPolicy;

  try {
    const remotePolicy = await fetchRemotePasswordPolicy(location);
    const resolved = remotePolicy || await createPasswordPolicy('', false);
    await setLocalPasswordPolicy(resolved);
    return resolved;
  } catch (error) {
    // 已知启用保护时必须失败关闭：网络不可用仍使用本地校验策略。
    if (localPolicy) return localPolicy;
    throw error;
  }
}

export async function saveRemotePasswordPolicy(location: GiteePasswordLocation, policy: PasswordPolicy): Promise<void> {
  const apiUrl = passwordFileUrl(location);
  const getResponse = await fetchWithTimeout(`${apiUrl}?ref=${encodeURIComponent(location.branch)}`, {
    headers: { Authorization: `token ${location.token}` },
  });

  let sha = '';
  if (getResponse.ok) {
    const file = await getResponse.json();
    sha = file?.sha || '';
  } else if (getResponse.status !== 404) {
    await assertResponseOk(getResponse, 'Failed to inspect password policy');
  }

  const payload: Record<string, string> = {
    access_token: location.token,
    content: encodePolicy(policy),
    message: sha ? '更新密码配置' : '新增密码配置文件',
    branch: location.branch,
  };
  if (sha) payload.sha = sha;

  const response = await fetchWithTimeout(apiUrl, {
    method: sha ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `token ${location.token}` },
    body: JSON.stringify(payload),
  });
  await assertResponseOk(response, 'Failed to save password policy');
  await setLocalPasswordPolicy(policy);
}
