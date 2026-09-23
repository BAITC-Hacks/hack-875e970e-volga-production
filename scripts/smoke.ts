import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.APP_URL || 'http://localhost:3000';
const normal = { city: 'Алматы', date: '2026-10-15', category: 'Ведущий', format: 'корпоратив', budget: 1000000, wishes: '' };
const cases = [
  ['autumn', normal],
  ['next-date', { ...normal, date: '2026-10-16' }],
  ['rare', { ...normal, category: 'Флорист', format: 'свадьба', budget: 500000 }],
  ['no-match', { ...normal, budget: 100000 }],
  ['absent', { ...normal, city: 'Астана', category: 'Декоратор' }],
  ['wishes', { ...normal, wishes: 'Спокойная интеллигентная подача для делового вечера, общение на английском', language: 'английский', hours: 5 }],
] as const;
const report: unknown[] = [];
for (const [name, query] of cases) {
  const start = Date.now();
  const response = await fetch(base + '/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  const ms = Date.now() - start;
  const repeated = await fetch(base + '/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) }).then(r => r.json());
  assert.deepEqual(repeated, result);
  assert.ok(result.cards.length <= 3);
  assert.equal('answer' in result, false, 'Card response must not wait for chat text');
  if (name === 'rare') assert.equal(result.cards.length, 2);
  if (name === 'no-match') assert.equal(result.status, 'no_match');
  if (name === 'absent') assert.equal(result.status, 'category_absent');
  let chat: { ms: number; answerMode: string; answer: string } | undefined;
  if (result.status === 'matched' && query.category === 'Ведущий') {
    const chatStart = Date.now();
    const chatResponse = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, message: '', history: [] }) });
    assert.equal(chatResponse.status, 200);
    const reply = await chatResponse.json();
    chat = { ms: Date.now() - chatStart, answerMode: reply.answerMode, answer: reply.answer };
    assert.ok(chat.answer);
  }
  console.log(JSON.stringify({ name, ms, status: result.status, ranking: result.ranking, mode: result.explanationMode, ids: result.cards.map((c: { id: string }) => c.id), chatMs: chat?.ms, chatMode: chat?.answerMode }));
  report.push({ name, ms, query, result, chat });
}
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/smoke.json', JSON.stringify({ capturedAt: new Date().toISOString(), base, runs: report }, null, 2));
console.log('Saved actual responses: docs/evidence/smoke.json');
