import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog, querySchema, validDate } from '../lib/catalog';
import { filterProfiles, priceOrder } from '../lib/filter';
import { computeResult, type Services } from '../lib/recommend';
import { cosine, evidenceIsDistinct, evidenceIsUseful, fallbackEvidence, validateExplanations } from '../lib/ai';
import type { Query } from '../lib/types';
const { profiles, metadata } = getCatalog();
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
  assert.ok(a.cards.every(card => !/приветствую|связь со мной|по телефону|интересен любой публике/i.test(card.evidence)));
});
test('fallback gives similar live bands distinct, specific reasons', async () => {
  const bandQuery = { ...query, category: 'Лайв-бэнд', budget: 2000000 };
  const result = await computeResult(bandQuery, profiles, offline);
  const again = await computeResult(bandQuery, profiles, offline);
  assert.deepEqual(result, again);
  assert.equal(result.explanationMode, 'facts');
  const first = result.cards.find(card => card.id === 'HK-23752')!;
  const second = result.cards.find(card => card.id === 'HK-83709')!;
  assert.notEqual(first.explanation, second.explanation);
  assert.match(first.evidence, /состав|вокалист|саксофон/i);
  assert.match(second.evidence, /состав|вокалист|квартет/i);
  for (const card of result.cards) {
    assert.ok(profiles.find(p => p.id === card.id)!.description.includes(card.evidence));
    assert.doesNotMatch(card.evidence, /^(?:приветствую|меня зовут|мы\s*[—–-])/i);
  }
});
test('duplicate AI evidence is rejected and explained fallback is used', async () => {
  const bandQuery = { ...query, category: 'Лайв-бэнд', budget: 2000000 };
  const result = await computeResult(bandQuery, profiles, {
    scores: fail,
    explanations: async selected => selected.map(p => ({ id: p.id, aspect: 'service' as const,
      evidence: p.id === 'HK-25279' ? p.description.slice(p.description.indexOf('И да')) : p.description.split('.')[0] + '.' })),
  });
  assert.equal(result.explanationMode, 'facts');
  assert.ok(result.warnings.some(w => w.includes('не прошли проверку')));
  assert.equal(new Set(result.cards.map(card => card.explanation)).size, result.cards.length);
});
test('fallback evidence stays useful and distinct across the catalog calendar', () => {
  let checked = 0;
  for (const city of metadata.cities) for (const category of metadata.categories) for (const format of metadata.formats) {
    const base = profiles.filter(p => p.city === city && p.categories.includes(category) && p.event_formats.includes(format));
    for (const budget of new Set(base.map(p => p.price_from_kzt))) for (let day = 0; day < 100; day++) {
      const date = new Date(Date.UTC(2026, 8, 23 + day)).toISOString().slice(0, 10);
      const selected = filterProfiles(profiles, { city, category, format, date, budget, wishes: '' }).eligible.sort(priceOrder).slice(0, 3);
      if (!selected.length) continue;
      checked++;
      const evidence = fallbackEvidence(selected);
      for (const profile of selected) {
        const quote = evidence[profile.id];
        if (quote) {
          assert.ok(profile.description.includes(quote));
          assert.ok(evidenceIsUseful(quote), `${profile.id} ${date}`);
        }
      }
      for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
        assert.ok(!evidence[selected[i].id] || !evidence[selected[j].id] || evidenceIsDistinct(evidence[selected[i].id], evidence[selected[j].id]), `${selected[i].id} ${selected[j].id} ${date}`);
      }
    }
  }
  assert.ok(checked > 1000);
});
test('semantic scores determine order, ties resolve by price and id; explanation failure cannot reorder', async () => {
  const eligible = filterProfiles(profiles, query).eligible;
  const top = [...eligible].sort(priceOrder).at(-1)!;
  const result = await computeResult(query, profiles, { scores: async () => Object.fromEntries(eligible.map(p => [p.id, p.id === top.id ? 1 : 0])), explanations: fail });
  assert.equal(result.cards[0].id, top.id); assert.equal(result.ranking, 'semantic');
});
test('unverified, duplicate or invented explanation evidence rejected', () => {
  const p = profiles.find(p => p.id === 'HK-90011')!;
  const valid = { id: p.id, evidence: 'Панорамные окна, вместимость зала до 200 гостей, свой кейтеринг и парковка для гостей мероприятия.', aspect: 'service' as const };
  assert.equal(validateExplanations({ cards: [valid] }, [p]).length, 1);
  assert.throws(() => validateExplanations({ cards: [{ ...valid, evidence: 'Выдуманные сведения о подрядчике' }] }, [p]));
  assert.throws(() => validateExplanations({ cards: [valid, valid] }, [p]));
  assert.throws(() => validateExplanations({ cards: [{ ...valid, evidence: 'x'.repeat(261) }] }, [p]));
});
test('cosine similarity handles vector geometry and rejects corrupt vectors', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1); assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.throws(() => cosine([0], [0])); assert.throws(() => cosine([1], [1, 0]));
});

test('marketing alone is rejected even when it mentions music or atmosphere', () => {
  const p = profiles.find(p => p.id === 'HK-25279')!;
  const marketing = 'И да, мы действительно сверкаем — звуком, энергией и атмосферой, которую создаём на сцене.';
  assert.ok(p.description.includes(marketing));
  assert.throws(() => validateExplanations({ cards: [{ id: p.id, evidence: marketing, aspect: 'style' }] }, [p]));
  for (const description of [marketing, 'Наша музыка создаёт незабываемую атмосферу на каждом событии.', 'Дарим яркие эмоции и превращаем праздник в волшебство.']) {
    assert.equal(fallbackEvidence([{ ...p, description }])[p.id], '');
  }
});

test('a sparse profile stays in AI-ranked results with an explicit information gap', async () => {
  const bandQuery = { ...query, category: 'Лайв-бэнд', budget: 2000000 };
  let sent: string[] = [];
  const services: Services = {
    scores: async selected => Object.fromEntries(selected.map(p => [p.id, p.id === 'HK-25279' ? 1 : 0])),
    explanations: async selected => {
      sent = selected.map(p => p.id);
      return selected.map(p => ({ id: p.id, aspect: 'service' as const, evidence: fallbackEvidence(selected)[p.id] }));
    },
  };
  const result = await computeResult(bandQuery, profiles, services);
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards[0].id, 'HK-25279');
  assert.equal(result.ranking, 'semantic');
  assert.equal(result.explanationMode, 'ai');
  assert.ok(!sent.includes('HK-25279'), 'Do not ask AI to invent a distinguishing feature');
  assert.equal(result.cards[0].evidenceStatus, 'insufficient');
  assert.equal(result.cards[0].evidence, '');
  assert.match(result.cards[0].explanation, /не удалось выделить конкретную отличительную особенность/);
  assert.doesNotMatch(result.cards[0].explanation, /сверкаем|энерги|атмосфер/);
  assert.ok(result.cards.slice(1).every(c => c.evidenceStatus === 'specific' && c.evidence));
  assert.deepEqual(await computeResult(bandQuery, profiles, services), result);
});

test('a single sparse profile is not hidden or mislabeled as an AI outage', async () => {
  const p = profiles.find(p => p.id === 'HK-25279')!;
  let calls = 0;
  const result = await computeResult({ ...query, category: 'Лайв-бэнд', budget: 2000000 }, [p], {
    scores: async () => ({ [p.id]: 1 }),
    explanations: async () => { calls++; throw new Error('Should not call'); },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, 'matched');
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].id, p.id);
  assert.equal(result.cards[0].evidenceStatus, 'insufficient');
  assert.equal(result.explanationMode, 'facts');
  assert.deepEqual(result.warnings, []);
  assert.match(result.message, /показываем всех/);
});

test('unavailable AI cannot promote marketing to evidence', async () => {
  const result = await computeResult({ ...query, category: 'Лайв-бэнд', budget: 2000000 }, profiles, offline);
  const card = result.cards.find(c => c.id === 'HK-25279')!;
  assert.equal(card.evidenceStatus, 'insufficient');
  assert.equal(card.evidence, '');
  assert.match(card.explanation, /уточните детали услуги/);
  assert.doesNotMatch(card.explanation, /сверкаем/);
});

test('concrete facts survive while a promotional alternative is rejected', async () => {
  const p = profiles.find(p => p.id === 'HK-90011')!;
  const quote = 'Панорамные окна, вместимость зала до 200 гостей, свой кейтеринг и парковка для гостей мероприятия.';
  const marketing = 'Наш зал создаёт незабываемую атмосферу для вашего праздника.';
  const enriched = { ...p, description: marketing + ' ' + quote };
  const result = await computeResult({ ...query, category: 'Отель', budget: 10000000 }, [enriched], {
    scores: async () => ({ [p.id]: 1 }),
    explanations: async () => [{ id: p.id, evidence: marketing, aspect: 'setting' }],
  });
  assert.equal(result.explanationMode, 'facts');
  assert.equal(result.cards[0].evidence, quote);
  assert.equal(result.cards[0].evidenceStatus, 'specific');
  assert.ok(result.warnings.some(w => w.includes('не прошли проверку')));
});

test('identical concrete quotes do not become different reasons for two profiles', () => {
  const quote = 'Панорамные окна, вместимость зала до 200 гостей, свой кейтеринг и парковка для гостей мероприятия.';
  const template = profiles.find(p => p.id === 'HK-90011')!;
  const pair = [{ ...template, id: 'test-a', description: quote }, { ...template, id: 'test-b', description: quote }];
  assert.throws(() => validateExplanations({ cards: pair.map(p => ({ id: p.id, evidence: quote, aspect: 'setting' })) }, pair));
  assert.deepEqual(fallbackEvidence(pair), { 'test-a': quote, 'test-b': '' });
});
