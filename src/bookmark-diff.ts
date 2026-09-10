export type BookmarkDifferenceType = 'local-only' | 'remote-only' | 'moved' | 'url-changed';
export type BookmarkSource = 'local' | 'remote';
export type DifferenceStrategy = BookmarkSource | 'merge';

export interface BookmarkVersion {
  node: any;
  path: string[];
  pathLabel: string;
  order: number;
}

export interface BookmarkDifference {
  id: string;
  type: BookmarkDifferenceType;
  local?: BookmarkVersion;
  remote?: BookmarkVersion;
}

export interface BookmarkDifferenceAnalysis {
  localBookmarks: any[];
  remoteBookmarks: any[];
  shared: Array<{ local: BookmarkVersion; remote: BookmarkVersion }>;
  differences: BookmarkDifference[];
  counts: {
    localOnly: number;
    remoteOnly: number;
    moved: number;
    urlChanged: number;
    shared: number;
  };
}

interface IndexedVersion extends BookmarkVersion {
  matched: boolean;
  exactKey: string;
  locationKey: string;
  identityKey: string;
}

function pathKey(path: string[]): string {
  return JSON.stringify(path);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function flattenBookmarks(nodes: any[], path: string[] = [], result: IndexedVersion[] = [], order = { value: 0 }): IndexedVersion[] {
  if (!Array.isArray(nodes)) return result;
  nodes.forEach(node => {
    if (!node || typeof node !== 'object') return;
    const title = String(node.title || '');
    if (node.url) {
      const url = String(node.url);
      const version: IndexedVersion = {
        node: clone(node),
        path: [...path],
        pathLabel: path.join(' / '),
        order: order.value++,
        matched: false,
        exactKey: JSON.stringify([path, title, url]),
        locationKey: JSON.stringify([path, title]),
        identityKey: JSON.stringify([title, url]),
      };
      delete version.node.children;
      result.push(version);
      return;
    }
    flattenBookmarks(node.children || [], [...path, title], result, order);
  });
  return result;
}

function pairByKey(
  local: IndexedVersion[],
  remote: IndexedVersion[],
  key: keyof Pick<IndexedVersion, 'exactKey' | 'locationKey' | 'identityKey'>,
): Array<[IndexedVersion, IndexedVersion]> {
  const remoteQueues = new Map<string, IndexedVersion[]>();
  remote.filter(item => !item.matched).forEach(item => {
    const queue = remoteQueues.get(item[key]) || [];
    queue.push(item);
    remoteQueues.set(item[key], queue);
  });

  const pairs: Array<[IndexedVersion, IndexedVersion]> = [];
  local.filter(item => !item.matched).forEach(localItem => {
    const remoteItem = remoteQueues.get(localItem[key])?.find(item => !item.matched);
    if (!remoteItem) return;
    localItem.matched = true;
    remoteItem.matched = true;
    pairs.push([localItem, remoteItem]);
  });
  return pairs;
}

function publicVersion(version: IndexedVersion): BookmarkVersion {
  return {
    node: clone(version.node),
    path: [...version.path],
    pathLabel: version.pathLabel,
    order: version.order,
  };
}

export function analyzeBookmarkDifferences(localBookmarks: any[], remoteBookmarks: any[]): BookmarkDifferenceAnalysis {
  const local = flattenBookmarks(localBookmarks);
  const remote = flattenBookmarks(remoteBookmarks);
  const sharedPairs = pairByKey(local, remote, 'exactKey');
  const urlChangedPairs = pairByKey(local, remote, 'locationKey');
  const movedPairs = pairByKey(local, remote, 'identityKey');
  const differences: BookmarkDifference[] = [];
  let differenceIndex = 0;

  urlChangedPairs.forEach(([localVersion, remoteVersion]) => {
    differences.push({
      id: `url-changed-${differenceIndex++}`,
      type: 'url-changed',
      local: publicVersion(localVersion),
      remote: publicVersion(remoteVersion),
    });
  });
  movedPairs.forEach(([localVersion, remoteVersion]) => {
    differences.push({
      id: `moved-${differenceIndex++}`,
      type: 'moved',
      local: publicVersion(localVersion),
      remote: publicVersion(remoteVersion),
    });
  });
  local.filter(item => !item.matched).forEach(version => {
    differences.push({ id: `local-only-${differenceIndex++}`, type: 'local-only', local: publicVersion(version) });
  });
  remote.filter(item => !item.matched).forEach(version => {
    differences.push({ id: `remote-only-${differenceIndex++}`, type: 'remote-only', remote: publicVersion(version) });
  });

  return {
    localBookmarks: clone(localBookmarks),
    remoteBookmarks: clone(remoteBookmarks),
    shared: sharedPairs.map(([localVersion, remoteVersion]) => ({
      local: publicVersion(localVersion),
      remote: publicVersion(remoteVersion),
    })),
    differences,
    counts: {
      localOnly: differences.filter(item => item.type === 'local-only').length,
      remoteOnly: differences.filter(item => item.type === 'remote-only').length,
      moved: differences.filter(item => item.type === 'moved').length,
      urlChanged: differences.filter(item => item.type === 'url-changed').length,
      shared: sharedPairs.length,
    },
  };
}

export function getDefaultDifferenceSelections(
  analysis: BookmarkDifferenceAnalysis,
  strategy: DifferenceStrategy,
): Record<string, BookmarkSource> {
  return Object.fromEntries(analysis.differences.map(difference => {
    if (strategy === 'local' || strategy === 'remote') return [difference.id, strategy];
    if (difference.type === 'remote-only') return [difference.id, 'remote'];
    return [difference.id, 'local'];
  }));
}

interface FolderDescriptor {
  node: any;
  path: string[];
  order: number;
  source: BookmarkSource;
}

function collectFolders(nodes: any[], source: BookmarkSource, path: string[] = [], result: FolderDescriptor[] = [], order = { value: 0 }): FolderDescriptor[] {
  if (!Array.isArray(nodes)) return result;
  nodes.forEach(node => {
    if (!node || node.url) return;
    const folderPath = [...path, String(node.title || '')];
    const folder = clone(node);
    delete folder.children;
    result.push({ node: folder, path: folderPath, order: order.value++, source });
    collectFolders(node.children || [], source, folderPath, result, order);
  });
  return result;
}

export function resolveBookmarkDifferences(
  analysis: BookmarkDifferenceAnalysis,
  selections: Record<string, BookmarkSource>,
  folderStrategy: DifferenceStrategy,
): any[] {
  const sharedSource: BookmarkSource = folderStrategy === 'remote' ? 'remote' : 'local';
  const selected: Array<BookmarkVersion & { source: BookmarkSource }> = analysis.shared.map(pair => ({
    ...clone(pair[sharedSource]),
    source: sharedSource,
  }));

  analysis.differences.forEach(difference => {
    const source = selections[difference.id] || 'local';
    const version = difference[source];
    if (version) selected.push({ ...clone(version), source });
  });

  const localFolders = collectFolders(analysis.localBookmarks, 'local');
  const remoteFolders = collectFolders(analysis.remoteBookmarks, 'remote');
  const allFolders = [...localFolders, ...remoteFolders];
  const allowedPaths = new Set<string>();
  const preferredSources: BookmarkSource[] = folderStrategy === 'merge'
    ? ['local', 'remote']
    : [folderStrategy];

  allFolders.forEach(folder => {
    if (preferredSources.includes(folder.source)) allowedPaths.add(pathKey(folder.path));
  });
  selected.forEach(bookmark => {
    for (let depth = 1; depth <= bookmark.path.length; depth += 1) {
      allowedPaths.add(pathKey(bookmark.path.slice(0, depth)));
    }
  });

  const descriptorByPath = new Map<string, FolderDescriptor>();
  const sourceRank = (source: BookmarkSource) => preferredSources.indexOf(source) === -1 ? 2 : preferredSources.indexOf(source);
  allFolders
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source) || a.order - b.order)
    .forEach(folder => {
      const key = pathKey(folder.path);
      if (allowedPaths.has(key) && !descriptorByPath.has(key)) descriptorByPath.set(key, folder);
    });

  const result: any[] = [];
  const childrenByPath = new Map<string, any[]>();
  childrenByPath.set(pathKey([]), result);
  [...allowedPaths]
    .map(key => JSON.parse(key) as string[])
    .sort((a, b) => a.length - b.length)
    .forEach(path => {
      const key = pathKey(path);
      if (childrenByPath.has(key)) return;
      const parentPath = path.slice(0, -1);
      const parentChildren = childrenByPath.get(pathKey(parentPath));
      if (!parentChildren) return;
      const descriptor = descriptorByPath.get(key);
      const folderNode = descriptor ? clone(descriptor.node) : { title: path[path.length - 1] };
      folderNode.children = [];
      parentChildren.push(folderNode);
      childrenByPath.set(key, folderNode.children);
    });

  selected
    .sort((a, b) => a.order - b.order || (a.source === 'local' ? -1 : 1))
    .forEach(bookmark => {
      const parent = childrenByPath.get(pathKey(bookmark.path)) || result;
      parent.push(clone(bookmark.node));
    });
  return result;
}
