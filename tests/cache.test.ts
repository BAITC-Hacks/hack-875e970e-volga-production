import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once, readCache, writeCache } from '../lib/cache';
test('concurrent requests share work, persisted response survives a fresh process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sobrano-test-'));
  const previous = process.env.CACHE_DIR;
  process.env.CACHE_DIR = directory;
  try {
    let calls = 0;
    const job = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { ids: ['b', 'a'], mode: 'facts' }; };
    const results = await Promise.all(Array.from({ length: 8 }, () => once('same-request', job)));
    assert.equal(calls, 1); results.forEach(result => assert.deepEqual(result, results[0]));
    await writeCache('persisted', results[0]);
    assert.deepEqual(await readCache('persisted'), results[0]);
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', 'import { readCache } from "./lib/cache.ts"; console.log(JSON.stringify(await readCache("persisted")))'], { env: process.env, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), results[0]);
    assert.equal(await readCache('missing'), null);
  } finally {
    if (previous === undefined) delete process.env.CACHE_DIR; else process.env.CACHE_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
