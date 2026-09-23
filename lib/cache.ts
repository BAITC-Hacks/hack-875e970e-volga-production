import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export const cacheDir = () => process.env.CACHE_DIR || '.cache/sobrano';
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function readCache<T>(key: string): Promise<T | null> {
  try { return JSON.parse(await readFile(join(cacheDir(), key + '.json'), 'utf8')) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT' || e instanceof SyntaxError) return null; throw e; }
}
export async function writeCache(key: string, value: unknown) {
  await mkdir(cacheDir(), { recursive: true });
  const target = join(cacheDir(), key + '.json');
  const tmp = target + '.' + randomUUID() + '.tmp';
  await writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
  await rename(tmp, target);
}
const inflight = new Map<string, Promise<unknown>>();
export async function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const work = fn().finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}
