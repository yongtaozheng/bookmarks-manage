/**
 * IndexedDB 数据加密工具
 * 使用 AES-256-GCM 对存储在 IndexedDB 中的敏感配置（如 Gitee Token）进行加密
 * 默认使用本地随机密钥；可切换为“主密码派生密钥”实现跨设备一致
 */

declare const chrome: any;

/** chrome.storage.local 中存储加密密钥的键名 */
const CRYPTO_KEY_NAME = '_bm_encryption_key';
/** 主密码（用于派生跨设备一致密钥） */
const CRYPTO_MASTER_PASSPHRASE_NAME = '_bm_encryption_master_passphrase';
/** 主密码派生出的密钥。仅用于兼容自动解密，不保存用户原始主密码。 */
const CRYPTO_MASTER_KEY_NAME = '_bm_encryption_master_key';
/** 主密码派生参数 */
const MASTER_KEY_SALT = 'bookmarks-manage-master-key-v1';
const PBKDF2_ITERATIONS = 250000;

type KeyMode = 'master' | 'legacy';
type KeyContext = {
  key: CryptoKey;
  mode: KeyMode;
};

/** 缓存的加密上下文，避免重复读取 storage 和重复派生 */
let cachedKeyContext: KeyContext | null = null;

function storageGet(keys: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result: any) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result || {});
    });
  });
}

function storageSet(values: Record<string, any>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function storageRemove(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

async function deriveKeyFromPassphrase(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(MASTER_KEY_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * 获取或创建旧版本地随机密钥（兼容历史数据）
 */
async function getLegacyKey(generateIfMissing: boolean): Promise<CryptoKey> {
  const result = await storageGet([CRYPTO_KEY_NAME]);
  const existing = result[CRYPTO_KEY_NAME];
  if (existing) {
    return crypto.subtle.importKey(
      'jwk',
      existing,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }
  if (!generateIfMissing) {
    throw new Error('LEGACY_KEY_NOT_FOUND');
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await storageSet({ [CRYPTO_KEY_NAME]: jwk });
  return key;
}

async function getKeyContext(): Promise<KeyContext> {
  if (cachedKeyContext) return cachedKeyContext;

  const result = await storageGet([CRYPTO_MASTER_KEY_NAME, CRYPTO_MASTER_PASSPHRASE_NAME]);
  const storedMasterKey = result[CRYPTO_MASTER_KEY_NAME];
  if (storedMasterKey) {
    const key = await crypto.subtle.importKey('jwk', storedMasterKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    cachedKeyContext = { key, mode: 'master' };
    return cachedKeyContext;
  }

  // 一次性迁移旧版本中明文保存的主密码，迁移后立即删除明文。
  const passphrase = result[CRYPTO_MASTER_PASSPHRASE_NAME];
  if (passphrase && typeof passphrase === 'string') {
    const key = await deriveKeyFromPassphrase(passphrase);
    const jwk = await crypto.subtle.exportKey('jwk', key);
    await storageSet({ [CRYPTO_MASTER_KEY_NAME]: jwk });
    await storageRemove([CRYPTO_MASTER_PASSPHRASE_NAME]);
    cachedKeyContext = { key, mode: 'master' };
    return cachedKeyContext;
  }

  const key = await getLegacyKey(true);
  cachedKeyContext = { key, mode: 'legacy' };
  return cachedKeyContext;
}

async function decryptWithKey(encryptedBase64: string, key: CryptoKey): Promise<string> {
  const binaryStr = atob(encryptedBase64);
  const combined = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    combined[i] = binaryStr.charCodeAt(i);
  }

  // 前 12 字节为 IV，其余为密文
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * 配置跨设备主密码（派生固定密钥）
 */
export async function setMasterPassphrase(passphrase: string): Promise<void> {
  if (!passphrase) throw new Error('EMPTY_MASTER_PASSPHRASE');
  if (passphrase.length > 1024) throw new Error('MASTER_PASSPHRASE_TOO_LONG');
  const key = await deriveKeyFromPassphrase(passphrase);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await storageSet({ [CRYPTO_MASTER_KEY_NAME]: jwk });
  await storageRemove([CRYPTO_MASTER_PASSPHRASE_NAME]);
  cachedKeyContext = { key, mode: 'master' };
}

/**
 * 清除跨设备主密码，回退到本地随机密钥模式
 */
export async function clearMasterPassphrase(): Promise<void> {
  await storageRemove([CRYPTO_MASTER_KEY_NAME, CRYPTO_MASTER_PASSPHRASE_NAME]);
  cachedKeyContext = null;
}

export async function hasMasterPassphrase(): Promise<boolean> {
  const result = await storageGet([CRYPTO_MASTER_KEY_NAME, CRYPTO_MASTER_PASSPHRASE_NAME]);
  return Boolean(result[CRYPTO_MASTER_KEY_NAME] || result[CRYPTO_MASTER_PASSPHRASE_NAME]);
}

/**
 * 加密字符串
 * @param plaintext 待加密的明文
 * @returns Base64 编码的密文字符串（格式：IV(12字节) + 密文）
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;

  const { key } = await getKeyContext();
  // 随机生成 12 字节 IV（AES-GCM 推荐长度）
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // 将 IV 和密文拼接后进行 Base64 编码
  const ciphertextArray = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.length + ciphertextArray.length);
  combined.set(iv);
  combined.set(ciphertextArray, iv.length);

  let binary = '';
  for (const byte of combined) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * 解密 Base64 编码的密文
 * @param encryptedBase64 Base64 编码的密文（格式：IV(12字节) + 密文）
 * @returns 解密后的明文字符串
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) return encryptedBase64;

  const { key } = await getKeyContext();
  return decryptWithKey(encryptedBase64, key);
}

/**
 * 安全解密：兼容未加密的旧数据
 * - 如果值能成功解密，返回解密结果
 * - 如果解密失败（说明是未加密的明文），直接返回原始值
 * 用于从明文存储平滑迁移到加密存储
 */
export async function decryptSafe(value: string): Promise<string> {
  if (!value) return value;
  try {
    return await decrypt(value);
  } catch {
    // 主密码模式下，尝试兼容解密旧版本地随机密钥数据
    try {
      const { mode } = await getKeyContext();
      if (mode === 'master') {
        const legacyKey = await getLegacyKey(false);
        return await decryptWithKey(value, legacyKey);
      }
    } catch {
      // ignore fallback failure
    }

    // 解密失败说明是未加密明文或非当前密钥生成的数据，直接返回原值
    return value;
  }
}
