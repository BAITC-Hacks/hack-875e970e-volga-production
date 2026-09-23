import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.APP_URL || 'http://localhost:3000';
const report = JSON.parse(await readFile('docs/evidence/smoke.json', 'utf8'));
let compared = 0;
for (const run of report.runs) {
  const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(base + '/api/recommendations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run.query),
  }).then(async response => { assert.equal(response.status, 200); return response.json(); })));
  for (const response of responses) { assert.deepEqual(response, run.result); compared++; }
}
const health = await fetch(base + '/api/health').then(r => r.json());
assert.deepEqual(health, { status: 'ok', profiles: 66 });
assert.equal((await fetch(base + '/presentation.html')).status, 404);
const result = { checkedAt: new Date().toISOString(), compared, health, sameAsSavedResponses: true };
await writeFile('docs/evidence/runtime.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
