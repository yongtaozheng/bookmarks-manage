/**
 * IndexedDB 数据加密工具
 * 使用 AES-256-GCM 对存储在 IndexedDB 中的敏感配置（如 Gitee Token）进行加密
 * 加密密钥自动生成并安全存储在 chrome.storage.local 中
 */

declare const chrome: any;

/** chrome.storage.local 中存储加密密钥的键名 */
const CRYPTO_KEY_NAME = '_bm_encryption_key';

/** 缓存的加密密钥，避免重复读取 storage */
let cachedKey: CryptoKey | null = null;

/**
 * 获取或创建 AES-GCM 加密密钥
 * - 首次调用时生成随机 256 位密钥并存入 chrome.storage.local
 * - 后续调用从缓存或 storage 中读取
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CRYPTO_KEY_NAME], async (result: any) => {
      try {
        if (result[CRYPTO_KEY_NAME]) {
          // 从 storage 导入已有密钥
          const key = await crypto.subtle.importKey(
            'jwk',
            result[CRYPTO_KEY_NAME],
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
          );
          cachedKey = key;
          resolve(key);
        } else {
          // 首次使用，生成新的随机密钥
          const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          const jwk = await crypto.subtle.exportKey('jwk', key);
          chrome.storage.local.set({ [CRYPTO_KEY_NAME]: jwk }, () => {
            cachedKey = key;
            resolve(key);
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * 加密字符串
 * @param plaintext 待加密的明文
 * @returns Base64 编码的密文字符串（格式：IV(12字节) + 密文）
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;

  const key = await getEncryptionKey();
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

  const key = await getEncryptionKey();
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
    // 解密失败说明是未加密的旧数据，直接返回原值
    return value;
  }
}
