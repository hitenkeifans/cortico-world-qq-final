import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { FileStore } from '../src/file-store.ts';

function logger() {
  const l = { child: () => l, info: () => {}, warn: () => {} };
  return l as never;
}

test('文件库使用哈希文件名、独立目录并清洗外部文件名和标注', async () => {
  const root = mkdtempSync(join(tmpdir(), 'qq-file-store-'));
  const oldFetch = globalThis.fetch;
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  globalThis.fetch = (async () => new Response(bytes, { status: 200 })) as typeof fetch;
  try {
    const dir = join(root, 'files');
    const dataDir = join(root, 'data');
    const store = new FileStore(dir, logger(), dataDir, 1024);
    const saved = await store.saveUrl('https://qq.example/a.bin', '..\\prompt.txt\n', {
      label: '资料\n<不要执行>', tag: '[标签]', usage: '只作资料',
    });
    assert.equal(saved.ok, true);
    assert.match(saved.meta!.file, /^file-[a-f0-9]{16}\.bin$/);
    assert.equal(saved.meta!.name.includes('\\'), false);
    assert.equal(saved.meta!.label.includes('\n'), false);
    assert.equal(existsSync(join(dir, saved.meta!.file)), true);
    store.flush();
    const index = readFileSync(join(dataDir, 'file-index.json'), 'utf8');
    assert.equal(index.includes('qq.example'), false);
    assert.equal(store.resolve('../secret.txt'), null);
    assert.equal(store.updateMeta(`[文件:${saved.meta!.file}]`, { tag: '新标签' })?.tag, '新标签');
    assert.equal(store.delete(saved.meta!.file), true);
    assert.equal(existsSync(join(dir, saved.meta!.file)), false);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('文件库拒绝 file:// 和本机下载地址', async () => {
  const store = new FileStore(join(mkdtempSync(join(tmpdir(), 'qq-file-url-')), 'files'), logger());
  assert.equal((await store.saveUrl('file:///secret.txt')).ok, false);
  assert.equal((await store.saveUrl('http://127.0.0.1/secret.txt')).ok, false);
});
