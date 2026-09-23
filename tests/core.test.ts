import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog, querySchema, validDate } from '../lib/catalog';
import { filterProfiles, priceOrder } from '../lib/filter';
import { computeResult, type Services } from '../lib/recommend';
import { cosine, validateExplanations } from '../lib/ai';
import type { Query } from '../lib/types';
const { profiles } = getCatalog();
const query: Query = { city: 'Алматы', date: '2026-10-15', category: 'Ведущий', format: 'корпоратив', budget: 1000000, wishes: '' };
const fail = async () => { throw new Error('Simulated service unavailable'); };
const offline: Services = { scores: fail, explanations: fail };
test('catalog has 66 unique valid profiles and provenance', () => {
  assert.equal(profiles.length, 66); assert.equal(new Set(profiles.map(p => p.id)).size, 66);
  assert.equal(profiles.filter(p => p.synthetic).length, 13);
  assert.equal(profiles.filter(p => p.price_imputed).length, 18);
});
test('real autumn demo has six candidates, changed calendar has four', () => {
  const a = filterProfiles(profiles, query), b = filterProfiles(profiles, { ...query, date: '2026-10-16' });
  assert.equal(a.base.length, 10); assert.equal(a.eligible.length, 6); assert.equal(b.eligible.length, 4);
  assert.notDeepEqual(a.eligible.map(p => p.id), b.eligible.map(p => p.id));
  for (const p of a.eligible) assert.ok(!p.busy_dates.includes(query.date));
});
test('price equality passes, above budget fails', () => {
  const p = profiles.find(p => p.id === 'HK-44733')!;
  assert.equal(filterProfiles([p], query).eligible.length, 1);
  assert.equal(filterProfiles([p], { ...query, budget: 999999 }).excluded.budget, 1);
});
test('all strict constraints are honored and overlapping reasons counted', () => {
  const p = { ...profiles[0], city: query.city, categories: [query.category], price_from_kzt: 2e6,
    busy_dates: [query.date], event_formats: ['свадьба'], languages: ['казахский'], max_hours: 2 };
  const result = filterProfiles([p], { ...query, language: 'английский', hours: 5 });
  assert.equal(result.eligible.length, 0);
  assert.deepEqual(result.excluded, { busy: 1, budget: 1, format: 1, language: 1, hours: 1 });
});
test('rare category returns two; null presence hours does not exclude florists', () => {
  const q = { ...query, category: 'Флорист', format: 'свадьба', budget: 500000, hours: 24 };
  assert.equal(filterProfiles(profiles, q).eligible.length, 2);
});
test('category membership works for multi-category venues', () => {
  const p = profiles.find(p => p.categories.includes('Отель'))!;
  const date = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`).find(d => !p.busy_dates.includes(d))!;
  assert.equal(filterProfiles([p], { ...query, city: p.city, category: 'Отель', date, budget: 1e8, format: p.event_formats[0] }).eligible.length, 1);
});
test('validation rejects unknown values, invalid dates, nonnumeric and negative inputs', () => {
  const schema = querySchema();
  for (const patch of [{ budget: -1 }, { budget: '100' }, { date: '2027-01-01' }, { date: '2026-11-31' }, { date: '2026-10-99' }, { language: 'неизвестный' }, { city: 'Москва' }, { hours: 25 }, { wishes: 'x'.repeat(601) }]) {
    assert.equal(schema.safeParse({ ...query, ...patch }).success, false, JSON.stringify(patch));
  }
  assert.ok(validDate('2026-09-23')); assert.ok(validDate('2026-12-31')); assert.ok(!validDate('2026-09-22'));
});
test('three outcomes and at most three cards, no busy contractors', async () => {
  const [matched, absent, noMatch] = await Promise.all([
    computeResult(query, profiles, offline),
    computeResult({ ...query, city: 'Астана', category: 'Декоратор' }, profiles, offline),
    computeResult({ ...query, budget: 100000 }, profiles, offline),
  ]);
  assert.equal(matched.status, 'matched'); assert.equal(matched.cards.length, 3);
  assert.equal(absent.status, 'category_absent'); assert.equal(noMatch.status, 'no_match');
  assert.ok(absent.message); assert.ok(noMatch.message); assert.equal(noMatch.cards.length, 0);
  assert.ok(matched.cards.every(c => !('busy_dates' in c)));
});
test('AI failure is explicit, deterministic, and uses profile evidence', async () => {
  const a = await computeResult(query, profiles, offline), b = await computeResult(query, profiles, offline);
  assert.deepEqual(a, b); assert.equal(a.ranking, 'price'); assert.equal(a.explanationMode, 'facts'); assert.equal(a.warnings.length, 2);
  assert.equal(new Set(a.cards.map(c => c.evidence)).size, a.cards.length);
});
test('semantic scores determine order, ties resolve by price and id; explanation failure cannot reorder', async () => {
  const eligible = filterProfiles(profiles, query).eligible;
  const top = [...eligible].sort(priceOrder).at(-1)!;
  const result = await computeResult(query, profiles, { scores: async () => Object.fromEntries(eligible.map(p => [p.id, p.id === top.id ? 1 : 0])), explanations: fail });
  assert.equal(result.cards[0].id, top.id); assert.equal(result.ranking, 'semantic');
});
test('unverified, duplicate or invented explanation evidence rejected', () => {
  const p = profiles[0];
  const valid = { id: p.id, evidence: p.description.slice(0, 80), aspect: 'service' as const };
  assert.equal(validateExplanations({ cards: [valid] }, [p]).length, 1);
  assert.throws(() => validateExplanations({ cards: [{ ...valid, evidence: 'Выдуманные сведения о подрядчике' }] }, [p]));
  assert.throws(() => validateExplanations({ cards: [valid, valid] }, [p]));
  assert.throws(() => validateExplanations({ cards: [{ ...valid, evidence: 'x'.repeat(261) }] }, [p]));
});
test('cosine similarity handles vector geometry and rejects corrupt vectors', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1); assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.throws(() => cosine([0], [0])); assert.throws(() => cosine([1], [1, 0]));
});
