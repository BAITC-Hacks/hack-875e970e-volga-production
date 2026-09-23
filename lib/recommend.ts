import { getCatalog } from './catalog';
import { hash, once, readCache, writeCache } from './cache';
import { checks, dateLabel, filterProfiles, money, priceOrder } from './filter';
import { embeddingModel, explain, fallbackEvidence, semanticScores, textModel, validateExplanations } from './ai';
import type { Profile, Query, Result } from './types';
const ALGORITHM = 'sobrano-v4-distinct-evidence';
export type Services = {
  scores: typeof semanticScores; explanations: typeof explain;
};
const defaultServices: Services = { scores: semanticScores, explanations: explain };
export async function computeResult(q: Query, profiles: Profile[], services: Services = defaultServices): Promise<Result> {
  const { base, eligible, excluded } = filterProfiles(profiles, q);
  const result: Result = { status: 'matched', cards: [], query: q, total: base.length, eligible: eligible.length,
    excluded, message: '', ranking: 'none', explanationMode: 'none', warnings: [] };
  if (!base.length) {
    result.status = 'category_absent'; result.message = `В каталоге города «${q.city}» нет категории «${q.category}». Попробуйте другой город или категорию.`;
    return result;
  }
  if (!eligible.length) {
    result.status = 'no_match'; result.message = 'Подрядчики есть, но ни один не проходит все условия. Посмотрите причины ниже и измените дату или ограничения.';
    return result;
  }
  // One deadline covers BOTH external stages, with no hidden SDK retries.
  const signal = AbortSignal.timeout(8000);
  let sorted = [...eligible].sort(priceOrder);
  try {
    const scores = await services.scores(eligible, q, signal);
    if (eligible.some(p => !Number.isFinite(scores[p.id]))) throw new Error('Incomplete scores');
    sorted.sort((a, b) => scores[b.id] - scores[a.id] || priceOrder(a, b));
    result.ranking = 'semantic';
  } catch {
    result.ranking = 'price';
    result.warnings.push('Смысловой подбор недоступен: порядок по начальной цене. Пожелания не учтены при ранжировании.');
  }
  const selected = sorted.slice(0, 3);
  let explanations: Awaited<ReturnType<typeof explain>> = [];
  try {
    if (signal.aborted) throw new Error('Deadline');
    explanations = validateExplanations({ cards: await services.explanations(selected, q, signal) }, selected);
    result.explanationMode = 'ai';
  } catch {
    result.explanationMode = 'facts';
    result.warnings.push('AI-объяснения недоступны или не прошли проверку: показываем проверенные условия и разные цитаты из анкет.');
  }
  const fallback = fallbackEvidence(selected);
  result.cards = selected.map(p => {
    const { busy_dates: _calendar, ...profile } = p;
    void _calendar;
    const explanation = explanations.find(e => e.id === p.id);
    const evidence = explanation?.evidence || fallback[p.id];
    const aspectLabels = { style: 'Стиль работы', experience: 'Релевантный опыт', service: 'Особенность услуги', setting: 'Особенность площадки', language: 'Языки работы' };
    const detail = explanation ? `${aspectLabels[explanation.aspect]} по анкете: «${evidence}»` : `В анкете: «${evidence}»`;
    const first = `По календарю свободен на ${dateLabel(q.date)}, берёт формат «${q.format}», цена от ${money(p.price_from_kzt)} при бюджете ${money(q.budget)}.`;
    return { ...profile, checks: checks(p, q), evidence,
      explanation: `${first} ${detail}` };
  });
  if (q.wishes) result.warnings.push('Пожелания учитываются по смысловой близости, но не гарантируются анкетой. Детали нужно уточнить у подрядчика.');
  result.message = eligible.length < 3
    ? `Подходят ${eligible.length} из ${base.length}: показываем всех, кто проходит условия, без замены неподходящими.`
    : `Выбрали 3 из ${eligible.length} подходящих подрядчиков${result.ranking === 'semantic' ? ' по смысловой близости анкет к вашему запросу' : ' по начальной цене'}.`;
  return result;
}
export async function recommend(q: Query) {
  const { profiles, version } = getCatalog();
  const normalized = { city: q.city, date: q.date, format: q.format, category: q.category, budget: q.budget,
    hours: q.hours, language: q.language, wishes: q.wishes.trim().replace(/\s+/g, ' ') };
  const key = 'result-' + hash([ALGORITHM, version, embeddingModel(), textModel(), normalized]);
  return once(key, async () => {
    const cached = await readCache<Result>(key);
    if (cached) return cached;
    const result = await computeResult(normalized, profiles);
    // Persist degraded results too: never silently reorder the same request on retry.
    await writeCache(key, result);
    return result;
  });
}
