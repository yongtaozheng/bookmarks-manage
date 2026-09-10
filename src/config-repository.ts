import { decryptSafe, encrypt } from './crypto';

const DB_NAME = 'bookmarks-plus';
const STORE_NAME = 'gitee-config';

function openConfigDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open config database'));
  });
}

export async function getRawConfig(fields: string[]): Promise<Record<string, string>> {
  if (fields.length === 0) return {};
  const db = await openConfigDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const result: Record<string, string> = {};
    let remaining = fields.length;

    fields.forEach(field => {
      const request = store.get(field);
      request.onsuccess = () => {
        result[field] = request.result || '';
        remaining -= 1;
        if (remaining === 0) resolve(result);
      };
      request.onerror = () => reject(request.error || new Error(`Failed to read config field: ${field}`));
    });
    transaction.onabort = () => reject(transaction.error || new Error('Config read transaction aborted'));
  });
}

export async function getConfig(fields: string[]): Promise<Record<string, string>> {
  const rawConfig = await getRawConfig(fields);
  const config: Record<string, string> = {};
  for (const field of fields) config[field] = await decryptSafe(rawConfig[field] || '');
  return config;
}

export async function setConfig(config: Record<string, string>): Promise<void> {
  const encryptedConfig: Record<string, string> = {};
  for (const [field, value] of Object.entries(config)) {
    encryptedConfig[field] = value ? await encrypt(value) : value;
  }

  const db = await openConfigDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  Object.entries(encryptedConfig).forEach(([field, value]) => store.put(value, field));

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Config write transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Config write transaction aborted'));
  });
}
