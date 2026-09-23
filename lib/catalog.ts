import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { Profile, Metadata } from './types';

export const MIN_DATE = '2026-09-23';
export const MAX_DATE = '2026-12-31';
const file = 'data/hackathon_dataset_anonymized.csv';
const list = z.string().transform(s => s.split('|').map(v => v.trim()).filter(Boolean));
const flag = z.enum(['True', 'False']).transform(s => s === 'True');
const schema = z.object({
  id: z.string().min(1), anon_name: z.string().min(1), categories: list,
  city: z.string().min(1), city_imputed: flag, synthetic: flag,
  price_from_kzt: z.coerce.number().int().positive(), price_imputed: flag,
  event_formats: list, languages: list,
  max_hours: z.string().transform(s => s === '' ? null : Number(s)).pipe(z.number().positive().nullable()),
  busy_dates: list, description: z.string().min(1),
});
let catalog: { profiles: Profile[]; version: string; metadata: Metadata } | undefined;
export function getCatalog() {
  if (catalog) return catalog;
  const source = readFileSync(file, 'utf8');
  const profiles = z.array(schema).parse(parse(source, { columns: true, bom: true, skip_empty_lines: true }));
  const ids = new Set<string>();
  for (const p of profiles) {
    if (ids.has(p.id)) throw new Error('Duplicate profile id');
    ids.add(p.id);
    if (!p.categories.length || !p.event_formats.length || !p.languages.length) throw new Error('Empty profile attributes');
    if (new Set(p.busy_dates).size !== p.busy_dates.length || p.busy_dates.some(d => !validDate(d))) throw new Error('Invalid calendar');
  }
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'));
  catalog = { profiles, version: createHash('sha256').update(source).digest('hex'), metadata: {
    cities: unique(profiles.map(p => p.city)), categories: unique(profiles.flatMap(p => p.categories)),
    formats: unique(profiles.flatMap(p => p.event_formats)), languages: unique(profiles.flatMap(p => p.languages)), total: profiles.length,
  }};
  return catalog;
}
export function validDate(d: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < MIN_DATE || d > MAX_DATE) return false;
  const date = new Date(d + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === d;
}
export function querySchema() {
  const { metadata: m } = getCatalog();
  const choice = (values: string[]) => z.string().refine(v => values.includes(v), 'Выберите значение из списка');
  return z.object({
    city: choice(m.cities), date: z.string().refine(validDate, 'Дата должна быть с 23.09 по 31.12.2026'),
    format: choice(m.formats), category: choice(m.categories),
    budget: z.number().finite().positive().max(1_000_000_000, 'Слишком большой бюджет'),
    hours: z.number().finite().positive().max(24).optional(), language: choice(m.languages).optional(),
    wishes: z.string().trim().max(600, 'Не более 600 символов').default(''),
  });
}
