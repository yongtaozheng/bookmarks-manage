declare const chrome: any;

export interface BookmarkInput {
  title: string;
  url?: string;
  children?: BookmarkInput[];
}

const RESTORE_POINT_KEY = 'bookmark_replace_restore_point';
const MAX_BOOKMARK_NODES = 50000;
const MAX_BOOKMARK_DEPTH = 64;

function chromeError(fallback: string): Error {
  return new Error(chrome?.runtime?.lastError?.message || fallback);
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

    if (item.url !== undefined) {
      if (typeof item.url !== 'string' || item.url.length === 0) throw new Error(`Bookmark URL at index ${index} is invalid`);
      if (item.url.length > 100000) throw new Error(`Bookmark URL at index ${index} is too long`);
      return { title: item.title, url: item.url };
    }

    return {
      title: item.title,
      children: prepareBookmarkNodes(item.children || [], depth + 1, counter),
    };
  });
}

export function getChromeBookmarksTree(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree: any[]) => {
      if (chrome.runtime.lastError) reject(chromeError('Failed to read local bookmarks'));
      else resolve(tree || []);
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

async function createBookmarkNodes(nodes: BookmarkInput[], parentId: string): Promise<void> {
  for (const node of nodes) {
    const created = await createBookmark(node, parentId);
    if (!node.url && node.children?.length) await createBookmarkNodes(node.children, created.id);
  }
}

async function clearBookmarkBar(bookmarkBar: any): Promise<void> {
  const children = Array.isArray(bookmarkBar?.children) ? bookmarkBar.children : [];
  for (const child of children) await removeTree(child.id);
}

function saveRestorePoint(nodes: BookmarkInput[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({
      [RESTORE_POINT_KEY]: { createdAt: Date.now(), nodes },
    }, () => {
      if (chrome.runtime.lastError) reject(chromeError('Failed to save bookmark restore point'));
      else resolve();
    });
  });
}

function findBookmarkBar(tree: any[]): any {
  const rootChildren = tree?.[0]?.children || [];
  return rootChildren.find((item: any) => item.id === '1') || rootChildren[0];
}

export async function replaceBookmarkBarSafely(nodes: unknown): Promise<void> {
  const prepared = prepareBookmarkNodes(nodes);
  const tree = await getChromeBookmarksTree();
  const bookmarkBar = findBookmarkBar(tree);
  if (!bookmarkBar?.id) throw new Error('Bookmark bar was not found');

  const backup = prepareBookmarkNodes(bookmarkBar.children || []);
  try {
    await saveRestorePoint(backup);
  } catch (error) {
    console.warn('Could not persist bookmark restore point; in-memory rollback remains available.', error);
  }

  try {
    await clearBookmarkBar(bookmarkBar);
    await createBookmarkNodes(prepared, bookmarkBar.id);
  } catch (replaceError) {
    try {
      const currentTree = await getChromeBookmarksTree();
      const currentBar = findBookmarkBar(currentTree);
      if (currentBar?.id) {
        await clearBookmarkBar(currentBar);
        await createBookmarkNodes(backup, currentBar.id);
      }
    } catch (rollbackError) {
      throw new Error(`Bookmark replacement failed (${String(replaceError)}) and rollback failed: ${String(rollbackError)}`);
    }
    throw replaceError;
  }
}
