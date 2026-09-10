import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function loadTypeScriptModule(relativePath) {
  const result = await build({
    entryPoints: [new URL(`../${relativePath}`, import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  const source = Buffer.from(result.outputFiles[0].contents).toString('base64');
  return import(`data:text/javascript;base64,${source}`);
}

test('password policy stores only a salted verifier', async () => {
  const { createPasswordPolicy, verifyPassword } = await loadTypeScriptModule('src/password-service.ts');
  const policy = await createPasswordPolicy('correct horse battery staple');

  assert.equal(policy.version, 2);
  assert.equal(policy.algorithm, 'PBKDF2-SHA256');
  assert.ok(policy.salt);
  assert.ok(policy.verifier);
  assert.ok(!JSON.stringify(policy).includes('correct horse battery staple'));
  assert.equal(await verifyPassword('correct horse battery staple', policy), true);
  assert.equal(await verifyPassword('wrong password', policy), false);
});

test('HTML and regular expression helpers neutralize unsafe input', async () => {
  const { escapeHtml, escapeRegExp, safeExternalUrl } = await loadTypeScriptModule('src/sanitize.ts');

  assert.equal(escapeHtml('<img src=x onerror="boom">'), '&lt;img src=x onerror=&quot;boom&quot;&gt;');
  assert.equal(escapeRegExp('[a-z]+(test)?'), '\\[a-z\\]\\+\\(test\\)\\?');
  assert.equal(safeExternalUrl('https://example.com/a?q=1'), 'https://example.com/a?q=1');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
});

test('bookmark replacement restores the original bookmark bar after a creation failure', async () => {
  const originalNode = { id: 'old', title: 'Original', url: 'https://original.example' };
  const bookmarkBar = { id: '1', title: 'Bookmarks bar', children: [originalNode] };
  let nextId = 1;

  globalThis.chrome = {
    runtime: { lastError: null },
    storage: { local: { set: (_value, callback) => callback() } },
    bookmarks: {
      getTree: callback => callback([{ children: [bookmarkBar] }]),
      removeTree: (id, callback) => {
        bookmarkBar.children = bookmarkBar.children.filter(item => item.id !== id);
        callback();
      },
      create: (details, callback) => {
        if (details.title === 'Fail here') {
          globalThis.chrome.runtime.lastError = { message: 'Simulated create failure' };
          callback(undefined);
          globalThis.chrome.runtime.lastError = null;
          return;
        }
        const created = { ...details, id: `new-${nextId++}` };
        bookmarkBar.children.push(created);
        callback(created);
      },
    },
  };

  const { replaceBookmarkBarSafely } = await loadTypeScriptModule('src/bookmark-service.ts');
  await assert.rejects(
    replaceBookmarkBarSafely([
      { title: 'Temporary', url: 'https://temporary.example' },
      { title: 'Fail here', url: 'https://failure.example' },
    ]),
    /Simulated create failure/,
  );

  assert.deepEqual(
    bookmarkBar.children.map(({ title, url }) => ({ title, url })),
    [{ title: 'Original', url: 'https://original.example' }],
  );
});

test('bookmark restore point can undo a successful replacement', async () => {
  const storage = {};
  const bookmarkBar = { id: '1', title: 'Bookmarks bar', children: [{ id: 'old', title: 'Original', url: 'https://original.example' }] };
  let nextId = 1;
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        set: (value, callback) => { Object.assign(storage, value); callback(); },
        get: (keys, callback) => callback(Object.fromEntries(keys.map(key => [key, storage[key]]))),
      },
    },
    bookmarks: {
      getTree: callback => callback([{ children: [bookmarkBar] }]),
      removeTree: (id, callback) => { bookmarkBar.children = bookmarkBar.children.filter(item => item.id !== id); callback(); },
      create: (details, callback) => {
        const created = { ...details, id: `restored-${nextId++}` };
        bookmarkBar.children.push(created);
        callback(created);
      },
    },
  };

  const { replaceBookmarkBarSafely, restoreBookmarkBarFromPoint } = await loadTypeScriptModule('src/bookmark-service.ts');
  await replaceBookmarkBarSafely([{ title: 'Replacement', url: 'https://replacement.example' }], 'sync');
  assert.equal(bookmarkBar.children[0].title, 'Replacement');
  await restoreBookmarkBarFromPoint();
  assert.equal(bookmarkBar.children[0].title, 'Original');
});
