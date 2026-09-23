import type { Profile, Query, Reason } from './types';
export const reasonLabels: Record<Reason, string> = {
  busy: 'заняты на выбранную дату', budget: 'начальная цена выше бюджета',
  format: 'не берут этот формат', language: 'нет выбранного языка', hours: 'недостаточная длительность',
};
export function filterProfiles(profiles: Profile[], q: Query) {
  const base = profiles.filter(p => p.city === q.city && p.categories.includes(q.category));
  const excluded: Record<Reason, number> = { busy: 0, budget: 0, format: 0, language: 0, hours: 0 };
  const eligible = base.filter(p => {
    const reasons: Reason[] = [];
    if (p.busy_dates.includes(q.date)) reasons.push('busy');
    if (p.price_from_kzt > q.budget) reasons.push('budget');
    if (!p.event_formats.includes(q.format)) reasons.push('format');
    if (q.language && !p.languages.includes(q.language)) reasons.push('language');
    if (q.hours !== undefined && p.max_hours !== null && p.max_hours < q.hours) reasons.push('hours');
    for (const reason of reasons) excluded[reason]++;
    return !reasons.length;
  });
  return { base, eligible, excluded };
}
export const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' ₸';
export const dateLabel = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
export function checks(p: Profile, q: Query) {
  return [
    `Свободен по календарю на ${dateLabel(q.date)}`,
    `Цена от ${money(p.price_from_kzt)} при бюджете ${money(q.budget)}`,
    `Формат: ${q.format}`,
    ...(q.language ? [`Язык: ${q.language}`] : []),
    ...(q.hours ? [p.max_hours === null ? 'Длительность присутствия не применима' : `До ${p.max_hours} ч · требуется ${q.hours} ч`] : []),
  ];
}
export function priceOrder(a: Profile, b: Profile) {
  return a.price_from_kzt - b.price_from_kzt || a.id.localeCompare(b.id, 'en');
}
