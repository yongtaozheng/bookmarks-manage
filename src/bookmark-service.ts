declare const chrome: any;

export interface BookmarkInput {
  title: string;
  url?: string;
  children?: BookmarkInput[];
  hidden?: boolean;
}

export interface BookmarkRestorePoint {
  id: string;
  createdAt: number;
  reason: string;
  nodes: BookmarkInput[];
}

const RESTORE_DB_NAME = 'bookmark-restore-history';
const RESTORE_DB_VERSION = 1;
const RESTORE_STORE_NAME = 'restore-points';
const LEGACY_RESTORE_POINT_KEY = 'bookmark_replace_restore_point';
const FALLBACK_HISTORY_KEY = 'bookmark_restore_history';
const BOOKMARK_MANAGER_DATA_KEY = 'bookmarkManagerData';
const MAX_RESTORE_POINTS = 10;
const MAX_BOOKMARK_NODES = 50000;
const MAX_BOOKMARK_DEPTH = 64;

function chromeError(fallback: string): Error {
  return new Error(chrome?.runtime?.lastError?.message || fallback);
}

function createRestorePointId(createdAt = Date.now()): string {
  const suffix = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${createdAt}-${suffix}`;
}

export function prepareBookmarkNodes(nodes: unknown, depth = 0, counter = { value: 0 }): BookmarkInput[] {
  if (!Array.isArray(nodes)) throw new Error('Bookmark data must be an array');
  if (depth > MAX_BOOKMARK_DEPTH) throw new Error(`Bookmark tree exceeds ${MAX_BOOKMARK_DEPTH} levels`);

  return nodes.map((node, index) => {
    if (!node || typeof node !== 'object') throw new Error(`Invalid bookmark at index ${index}`);
    counter.value += 1;
    if (counter.value > MAX_BOOKMARK_NODES) throw new Error(`Bookmark data exceeds ${MAX_BOOKMARK_NODES} items`);

    const item = node as Record<string, unknown>;
    if (typeof item.title !== 'string') throw new Error(`Bookmark title at index ${index} must be a string`);
    if (item.title.length > 10000) throw new Error(`Bookmark title at index ${index} is too long`);
    const hidden = item.hidden === true;

    if (item.url !== undefined) {
      if (typeof item.url !== 'string' || item.url.length === 0) throw new Error(`Bookmark URL at index ${index} is invalid`);
      if (item.url.length > 100000) throw new Error(`Bookmark URL at index ${index} is too long`);
      return { title: item.title, url: item.url, ...(hidden ? { hidden: true } : {}) };
    }

    return {
      title: item.title,
      children: prepareBookmarkNodes(item.children || [], depth + 1, counter),
      ...(hidden ? { hidden: true } : {}),
    };
  });
}

function nodeMatchKey(node: any): string {
  return JSON.stringify([node?.url ? 'bookmark' : 'folder', String(node?.title || ''), String(node?.url || '')]);
}

function containsHiddenNode(node: any): boolean {
  return node?.hidden === true || (Array.isArray(node?.children) && node.children.some(containsHiddenNode));
}

function retainHiddenSubtree(node: any): any | null {
  if (node?.hidden === true) return structuredClone(node);
  if (!Array.isArray(node?.children)) return null;
  const children = node.children.map(retainHiddenSubtree).filter(Boolean);
  return children.length > 0 ? { ...node, children } : null;
}

/**
 * 将应用侧 hidden 元数据合并到 Chrome 当前树中。
 * 每层按“父文件夹路径 + 标题 + URL”匹配；同名重复项按原顺序逐个匹配。
 * Chrome 中不存在的隐藏节点也会从应用快照中补回，避免重建后永久丢失。
 */
export function mergeBookmarkHiddenState(chromeNodes: any[], storedNodes: any[]): any[] {
  if (!Array.isArray(chromeNodes)) return [];
  if (!Array.isArray(storedNodes) || storedNodes.length === 0) return structuredClone(chromeNodes);

  const reconcileLevel = (currentItems: any[], savedItems: any[]): any[] => {
    const currentQueues = new Map<string, any[]>();
    currentItems.forEach(item => {
      const key = nodeMatchKey(item);
      const queue = currentQueues.get(key) || [];
      queue.push(item);
      currentQueues.set(key, queue);
    });

    const result: any[] = [];
    const consumed = new Set<any>();
    savedItems.forEach(saved => {
      const queue = currentQueues.get(nodeMatchKey(saved));
      const current = queue?.shift();
      if (current) {
        consumed.add(current);
        const merged = { ...current };
        if (saved.hidden === true) merged.hidden = true;
        else delete merged.hidden;
        if (Array.isArray(current.children)) {
          merged.children = reconcileLevel(current.children, Array.isArray(saved.children) ? saved.children : []);
        }
        result.push(merged);
        return;
      }

      if (containsHiddenNode(saved)) {
        const retained = retainHiddenSubtree(saved);
        if (retained) result.push(retained);
      }
    });

    currentItems.forEach(item => {
      if (!consumed.has(item)) result.push(structuredClone(item));
    });
    return result;
  };

  return reconcileLevel(chromeNodes, storedNodes);
}

export function filterVisibleBookmarkNodes(nodes: BookmarkInput[]): BookmarkInput[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.reduce<BookmarkInput[]>((result, node) => {
    if (node.hidden === true) return result;
    if (node.url) {
      result.push({ title: node.title, url: node.url });
      return result;
    }
    const children = filterVisibleBookmarkNodes(node.children || []);
    if (children.length > 0) result.push({ title: node.title, children });
    return result;
  }, []);
}

export function getChromeBookmarksTree(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree: any[]) => {
      if (chrome.runtime.lastError) reject(chromeError('Failed to read local bookmarks'));
      else resolve(tree || []);
    });
  });
}

function storageGet(keys: string[]): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local?.get) return resolve({});
    chrome.storage.local.get(keys, (result: any) => {
      if (chrome.runtime.lastError) reject(chromeError('Failed to read local bookmark state'));
      else resolve(result || {});
    });
  });
}

function storageSet(value: Record<string, any>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local?.set) return resolve();
    chrome.storage.local.set(value, () => {
      if (chrome.runtime.lastError) reject(chromeError('Failed to save local bookmark state'));
      else resolve();
    });
  });
}

function removeTree(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(id, () => {
      if (chrome.runtime.lastError) reject(chromeError('Failed to remove bookmark tree'));
      else resolve();
    });
  });
}

function createBookmark(node: BookmarkInput, parentId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const details = node.url
      ? { parentId, title: node.title, url: node.url }
      : { parentId, title: node.title };
    chrome.bookmarks.create(details, (created: any) => {
      if (chrome.runtime.lastError || !created?.id) reject(chromeError('Failed to create bookmark'));
      else resolve(created);
    });
  });
}

async function createBookmarkNodes(nodes: BookmarkInput[], parentId: string): Promise<any[]> {
  const createdNodes: any[] = [];
  for (const node of nodes) {
    const created = await createBookmark(node, parentId);
    const createdNode = { ...created };
    if (!node.url) createdNode.children = await createBookmarkNodes(node.children || [], created.id);
    createdNodes.push(createdNode);
  }
  return createdNodes;
}

async function clearBookmarkBar(bookmarkBar: any): Promise<void> {
  const children = Array.isArray(bookmarkBar?.children) ? bookmarkBar.children : [];
  for (const child of children) await removeTree(child.id);
}

function openRestoreDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RESTORE_DB_NAME, RESTORE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESTORE_STORE_NAME)) {
        const store = db.createObjectStore(RESTORE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open bookmark restore database'));
  });
}

function normalizeRestorePoint(value: any): BookmarkRestorePoint | null {
  if (!value || !Array.isArray(value.nodes) || typeof value.createdAt !== 'number') return null;
  return {
    id: typeof value.id === 'string' ? value.id : createRestorePointId(value.createdAt),
    createdAt: value.createdAt,
    reason: typeof value.reason === 'string' ? value.reason : 'manual-change',
    nodes: prepareBookmarkNodes(value.nodes),
  };
}

async function saveRestorePointRecord(point: BookmarkRestorePoint): Promise<void> {
  const db = await openRestoreDB();
  if (!db) {
    const stored = await storageGet([FALLBACK_HISTORY_KEY]);
    const history = (Array.isArray(stored[FALLBACK_HISTORY_KEY]) ? stored[FALLBACK_HISTORY_KEY] : [])
      .map(normalizeRestorePoint)
      .filter(Boolean) as BookmarkRestorePoint[];
    const next = [point, ...history.filter(item => item.id !== point.id)]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_RESTORE_POINTS);
    await storageSet({ [FALLBACK_HISTORY_KEY]: next, [LEGACY_RESTORE_POINT_KEY]: point });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RESTORE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESTORE_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const existing = (request.result || []) as BookmarkRestorePoint[];
      store.put(point);
      [point, ...existing.filter(item => item.id !== point.id)]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(MAX_RESTORE_POINTS)
        .forEach(item => store.delete(item.id));
    };
    request.onerror = () => reject(request.error || new Error('Failed to read bookmark restore history'));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Failed to save bookmark restore history'));
    transaction.onabort = () => reject(transaction.error || new Error('Bookmark restore history transaction aborted'));
  });
  db.close();
}

async function readRestoreHistoryRecords(): Promise<BookmarkRestorePoint[]> {
  const db = await openRestoreDB();
  if (!db) {
    const stored = await storageGet([FALLBACK_HISTORY_KEY, LEGACY_RESTORE_POINT_KEY]);
    const values = Array.isArray(stored[FALLBACK_HISTORY_KEY])
      ? stored[FALLBACK_HISTORY_KEY]
      : (stored[LEGACY_RESTORE_POINT_KEY] ? [stored[LEGACY_RESTORE_POINT_KEY]] : []);
    return values.map(normalizeRestorePoint).filter(Boolean).sort((a, b) => b!.createdAt - a!.createdAt) as BookmarkRestorePoint[];
  }

  const records = await new Promise<any[]>((resolve, reject) => {
    const transaction = db.transaction(RESTORE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(RESTORE_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Failed to read bookmark restore history'));
  });
  db.close();
  const history = records.map(normalizeRestorePoint).filter(Boolean) as BookmarkRestorePoint[];
  if (history.length > 0) return history.sort((a, b) => b.createdAt - a.createdAt);

  const legacy = normalizeRestorePoint((await storageGet([LEGACY_RESTORE_POINT_KEY]))[LEGACY_RESTORE_POINT_KEY]);
  if (!legacy) return [];
  await saveRestorePointRecord(legacy);
  await storageSet({ [LEGACY_RESTORE_POINT_KEY]: null });
  return [legacy];
}

export async function getBookmarkRestoreHistory(): Promise<BookmarkRestorePoint[]> {
  return readRestoreHistoryRecords();
}

export async function getBookmarkRestorePoint(id?: string): Promise<BookmarkRestorePoint | null> {
  const history = await readRestoreHistoryRecords();
  return (id ? history.find(point => point.id === id) : history[0]) || null;
}

export async function deleteBookmarkRestorePoint(id: string): Promise<void> {
  const db = await openRestoreDB();
  if (!db) {
    const history = await readRestoreHistoryRecords();
    const next = history.filter(point => point.id !== id);
    await storageSet({
      [FALLBACK_HISTORY_KEY]: next,
      [LEGACY_RESTORE_POINT_KEY]: next[0] || null,
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RESTORE_STORE_NAME, 'readwrite');
    transaction.objectStore(RESTORE_STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Failed to delete bookmark restore point'));
    transaction.onabort = () => reject(transaction.error || new Error('Bookmark restore delete transaction aborted'));
  });
  db.close();
}

function findBookmarkBar(tree: any[]): any {
  const rootChildren = tree?.[0]?.children || [];
  return rootChildren.find((item: any) => item.id === '1') || rootChildren[0];
}

export async function getBookmarkBarState(): Promise<BookmarkInput[]> {
  const tree = await getChromeBookmarksTree();
  const rootChildren = tree?.[0]?.children || [];
  const storedData = (await storageGet([BOOKMARK_MANAGER_DATA_KEY]))[BOOKMARK_MANAGER_DATA_KEY];
  const reconciledRoots = mergeBookmarkHiddenState(rootChildren, storedData);
  const bookmarkBar = findBookmarkBar([{ children: reconciledRoots }]);
  if (!bookmarkBar) throw new Error('Bookmark bar was not found');
  return prepareBookmarkNodes(bookmarkBar.children || []);
}

async function persistBookmarkBarState(logicalNodes: BookmarkInput[], createdVisibleNodes: any[]): Promise<void> {
  const tree = await getChromeBookmarksTree();
  const rootChildren = tree?.[0]?.children || [];
  const previousStored = (await storageGet([BOOKMARK_MANAGER_DATA_KEY]))[BOOKMARK_MANAGER_DATA_KEY];
  const reconciledRoots = mergeBookmarkHiddenState(rootChildren, previousStored);
  const bookmarkBar = findBookmarkBar([{ children: reconciledRoots }]);
  if (!bookmarkBar) return;
  bookmarkBar.children = mergeBookmarkHiddenState(createdVisibleNodes, logicalNodes);
  await storageSet({ [BOOKMARK_MANAGER_DATA_KEY]: reconciledRoots });
}

export async function captureBookmarkBarRestorePoint(reason = 'manual-change'): Promise<BookmarkRestorePoint> {
  const point: BookmarkRestorePoint = {
    id: createRestorePointId(),
    createdAt: Date.now(),
    reason,
    nodes: await getBookmarkBarState(),
  };
  await saveRestorePointRecord(point);
  return point;
}

export async function restoreBookmarkBarFromPoint(id?: string): Promise<BookmarkRestorePoint> {
  const point = await getBookmarkRestorePoint(id);
  if (!point?.nodes) throw new Error('No bookmark restore point is available');
  await replaceBookmarkBarSafely(point.nodes, 'restore');
  return point;
}

export async function replaceBookmarkBarSafely(nodes: unknown, reason = 'replace', createRestorePoint = true): Promise<void> {
  const prepared = prepareBookmarkNodes(nodes);
  const visiblePrepared = filterVisibleBookmarkNodes(prepared);
  const tree = await getChromeBookmarksTree();
  const bookmarkBar = findBookmarkBar(tree);
  if (!bookmarkBar?.id) throw new Error('Bookmark bar was not found');

  const backup = await getBookmarkBarState();
  if (createRestorePoint) {
    try {
      await saveRestorePointRecord({ id: createRestorePointId(), createdAt: Date.now(), reason, nodes: backup });
    } catch (error) {
      console.warn('Could not persist bookmark restore point; in-memory rollback remains available.', error);
    }
  }

  try {
    await clearBookmarkBar(bookmarkBar);
    const createdVisibleNodes = await createBookmarkNodes(visiblePrepared, bookmarkBar.id);
    await persistBookmarkBarState(prepared, createdVisibleNodes);
  } catch (replaceError) {
    try {
      const currentTree = await getChromeBookmarksTree();
      const currentBar = findBookmarkBar(currentTree);
      if (currentBar?.id) {
        await clearBookmarkBar(currentBar);
        const restoredVisibleNodes = await createBookmarkNodes(filterVisibleBookmarkNodes(backup), currentBar.id);
        await persistBookmarkBarState(backup, restoredVisibleNodes);
      }
    } catch (rollbackError) {
      throw new Error(`Bookmark replacement failed (${String(replaceError)}) and rollback failed: ${String(rollbackError)}`);
    }
    throw replaceError;
  }
}
