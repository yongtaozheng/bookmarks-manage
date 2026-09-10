import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const managerSource = await readFile(new URL('../src/bookmark-manager.js', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../src/popup.ts', import.meta.url), 'utf8');
const cryptoSource = await readFile(new URL('../src/crypto.ts', import.meta.url), 'utf8');

assert.equal(packageJson.version, manifest.version, 'package.json and manifest.json versions must match');
assert.ok(!managerSource.includes('alert('), 'bookmark manager must use the shared Toast instead of alert()');
assert.ok(!managerSource.includes('href="${bookmark.url}"'), 'bookmark URLs must not be interpolated into HTML without validation');
assert.ok(!managerSource.includes('>${bookmark.title}'), 'bookmark titles must not be interpolated into HTML without escaping');
assert.ok(!managerSource.includes("indexedDB.open('bookmarks-plus'"), 'manager must use the shared config repository');
assert.ok(!popupSource.includes('removeAllBookmarks()'), 'popup must use safe bookmark replacement with rollback');
assert.ok(
  !cryptoSource.includes('storageSet({ [CRYPTO_MASTER_PASSPHRASE_NAME]: passphrase })'),
  'the raw master passphrase must never be persisted',
);
assert.ok(
  !manifest.content_scripts?.some(entry => entry.matches?.includes('<all_urls>')),
  'manifest content scripts must not be statically injected into every site',
);

console.log('Project static checks passed.');
