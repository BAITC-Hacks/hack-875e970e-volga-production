'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Button, NumberInput, Select, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import type { Metadata, Query, Result } from '@/lib/types';
dayjs.locale('ru');
const initial: Query = { city: 'Алматы', date: '2026-10-15', format: 'корпоратив', category: 'Ведущий', budget: 1000000, wishes: '' };
const demos = [
  { title: 'Корпоратив', note: 'Плотная категория', query: initial },
  { title: 'Другая дата', note: 'Те же условия · 16 октября', query: { ...initial, date: '2026-10-16' } },
  { title: 'Флористы', note: 'Редкая категория', query: { ...initial, category: 'Флорист', format: 'свадьба', budget: 500000 } },
  { title: 'Малый бюджет', note: 'Нет подходящих', query: { ...initial, budget: 100000 } },
  { title: 'Нет категории', note: 'Декоратор в Астане', query: { ...initial, city: 'Астана', category: 'Декоратор' } },
];
const reasonLabels = { busy: 'Заняты на дату', budget: 'Цена выше бюджета', format: 'Не берут формат', language: 'Нет нужного языка', hours: 'Не хватает часов' };
const money = (v: number) => new Intl.NumberFormat('ru-RU').format(v);
function Arrow({ diagonal = false }: { diagonal?: boolean }) { return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>; }
function Flower({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">{[0, 45, 90, 135].map(deg => <ellipse key={deg} cx="50" cy="50" rx="16" ry="46" transform={`rotate(${deg} 50 50)`} stroke="currentColor" strokeWidth="1.5" />)}<circle cx="50" cy="50" r="8" fill="currentColor" /></svg>;
}
export default function Finder({ metadata }: { metadata: Metadata }) {
  const [query, setQuery] = useState<Query>(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const resultRef = useRef<HTMLElement>(null);
  const currentRequest = useRef(false);
  const set = <K extends keyof Query>(key: K, value: Query[K]) => { setQuery(q => ({ ...q, [key]: value })); setFields(f => ({ ...f, [key]: [] })); };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (currentRequest.current) return;
    currentRequest.current = true; setLoading(true); setError(''); setFields({}); setResult(null);
    try {
      const response = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) { setFields(data.fields || {}); throw new Error(data.error || 'Не удалось выполнить подбор'); }
      setResult(data);
      requestAnimationFrame(() => { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); });
    } catch (e) { setError(e instanceof Error && e.name === 'TimeoutError' ? 'Сервис не ответил вовремя. Повторите запрос.' : e instanceof Error ? e.message : 'Проверьте соединение и повторите запрос.'); }
    finally { setLoading(false); currentRequest.current = false; }
  }
  const fieldError = (name: string) => fields[name]?.join('. ') || undefined;
  const select = (name: 'city' | 'category' | 'format', label: string, choices: string[]) => <Select
    className="form-control" label={label} data={choices} value={query[name]}
    onChange={value => { if (value !== null) set(name, value); }}
    error={fieldError(name)} required allowDeselect={false} disabled={loading}
    comboboxProps={{ withinPortal: true }}
  />;
  return <>
    <header className="header shell"><a className="wordmark" href="/" aria-label="Собрано — главная"><Flower />собрано<span className="brand-dot">.</span></a><span className="header-note">ЛЮДИ, КОТОРЫЕ СОЗДАЮТ СОБЫТИЯ</span><a className="about-link" href="#how">Как это работает <Arrow diagonal /></a></header>
    <main className="shell">
      <section className="hero">
        <div><div className="eyebrow"><span className="status-dot" /> УМНЫЙ ПОДБОР · КАЗАХСТАН</div><h1>Ваше событие.<br /><em>Ваши люди.</em></h1><p className="hero-copy">Расскажите, что задумали. Мы предложим до трёх подрядчиков из каталога и объясним, почему они вам подходят.</p></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><Flower className="hero-flower" /><div className="art-caption">МЕНЬШЕ ПОИСКА<br /><span>больше совпадений</span></div><span className="art-number">01 — 03</span></div>
      </section>
      <div className="section-bar"><span><span className="step">01</span> Соберём ваш запрос</span><span className="catalog-count">{metadata.total} профилей в исходном каталоге</span></div>
      <div className="workspace">
        <aside className="form-panel">
          <form onSubmit={submit}>
            <fieldset disabled={loading}><legend className="sr-only">Параметры мероприятия</legend>
              <div className="form-title"><h2>Что планируете?</h2><span>Все цены в ₸</span></div>
              <div className="form-grid">{select('city', 'Город', metadata.cities)}<DatePickerInput
                className="form-control" label="Дата мероприятия" value={query.date || null}
                onChange={value => set('date', value || '')} valueFormat="DD.MM.YYYY" locale="ru"
                minDate="2026-09-23" maxDate="2026-12-31" dropdownType="modal"
                error={fieldError('date')} required disabled={loading} clearable={false}
              /></div>
              <p className="input-note">Календарь: 23 сентября — 31 декабря 2026</p>
              {select('format', 'Формат мероприятия', metadata.formats)}
              {select('category', 'Кого ищем', metadata.categories)}
              <NumberInput className="form-control" label="Бюджет на подрядчика"
                value={Number.isNaN(query.budget) ? '' : query.budget}
                onChange={value => set('budget', value === '' ? NaN : Number(value))}
                min={1} max={1000000000} step={1} allowDecimal={false} allowNegative={false}
                thousandSeparator=" " suffix=" ₸" hideControls required disabled={loading}
                error={fieldError('budget')}
              />
              <p className="input-note">Сравниваем с ценой «от». Итоговую стоимость нужно уточнить.</p>
              <details className="optional"><summary>Язык и длительность <span>необязательно</span></summary><div className="form-grid">
                <Select className="form-control" label="Язык" placeholder="Любой" data={metadata.languages}
                  value={query.language || null} onChange={value => set('language', value || undefined)}
                  clearable disabled={loading} error={fieldError('language')} comboboxProps={{ withinPortal: true }} />
                <NumberInput className="form-control" label="Длительность, ч" placeholder="Любая"
                  value={query.hours ?? ''} onChange={value => set('hours', value === '' ? undefined : Number(value))}
                  min={0.5} max={24} step={0.5} decimalScale={1} hideControls disabled={loading}
                  error={fieldError('hours')} />
              </div></details>
              <Textarea className="form-control" label="Что для вас важно?"
                description="Необязательно · учитываем по смыслу анкеты" rows={3} maxLength={600}
                value={query.wishes} onChange={event => set('wishes', event.currentTarget.value)}
                placeholder="Например: спокойная подача, живое общение, без шумных конкурсов"
                disabled={loading} error={fieldError('wishes')} autosize minRows={3} maxRows={6} />
              <Button className="submit" type="submit" loading={loading} disabled={loading}
                rightSection={loading ? null : <Arrow />}>{loading ? 'Подбираем ваших людей…' : 'Найти совпадения'}</Button>
              <p className="form-footnote">Только рекомендации. Без заявок и бронирования.</p>
            </fieldset>
            {error && <div role="alert" className="error-box">{error}</div>}
          </form>
        </aside>
        <section className="results" ref={resultRef} tabIndex={-1} aria-label="Результаты подбора" aria-busy={loading}>
          {loading ? <div className="loading-state" role="status"><Flower /><h2>Ищем совпадения</h2><p>Проверяем условия и календари,<br />сопоставляем описания с вашим запросом.</p><div className="loading-line" /><span>Обычно до 10 секунд</span></div> : result ? <>
            <div className="results-header"><div className="eyebrow">ВАША ПОДБОРКА</div><h2>{result.status === 'matched' ? 'Есть совпадение.' : result.status === 'category_absent' ? 'Пока нет в каталоге.' : 'Условия не совпали.'}</h2><p>{result.message}</p><div className="request-summary">{result.query.city} · {result.query.category} · {result.query.date.split('-').reverse().join('.')} · {result.query.format} · до {money(result.query.budget)} ₸{result.query.language ? ` · ${result.query.language}` : ''}{result.query.hours ? ` · ${result.query.hours} ч` : ''}</div>{result.query.wishes && <p className="request-wishes">«{result.query.wishes}»</p>}</div>
            {result.warnings.map(w => <div key={w} className="warning" role="status">{w}</div>)}
            {result.cards.map((card, i) => <article className="contractor" key={card.id}>
              <div className="card-top"><span className="rank">0{i + 1}</span><span className="card-category">{result.query.category} · {card.city}</span><span className="availability"><span /> Свободен по календарю</span></div>
              <div className="card-heading"><h3>{card.anon_name}</h3><div className="price"><span>от </span>{money(card.price_from_kzt)} <span>₸</span></div></div>
              <div className="explanation"><span className="explanation-label">ПОЧЕМУ В ПОДБОРКЕ</span><p>{card.explanation}</p></div>
              <ul className="checks">{card.checks.slice(2).map(c => <li key={c}><span aria-hidden="true">✓</span> {c}</li>)}</ul>
              <div className="provenance"><span className={card.synthetic ? 'tag synthetic' : 'tag'}>{card.synthetic ? 'Синтетический профиль организаторов' : 'Анонимизированный профиль'}</span>{card.price_imputed && <span className="data-note">Цена проставлена в датасете</span>}{card.city_imputed && <span className="data-note">Город проставлен в датасете</span>}</div>
              <details className="source"><summary>На чём основано объяснение <span>+</span></summary>{card.evidenceStatus === 'insufficient' ? <p className="input-note">Конкретная отличительная особенность не выделена. Ниже — полная анкета для самостоятельной проверки.</p> : <blockquote>{card.evidence}</blockquote>}<p className="input-note">Сведения из анкеты подрядчика, не независимая проверка.</p><p>{card.description}</p><div className="input-note">{card.id} · Языки: {card.languages.join(', ')} · {card.max_hours === null ? 'Длительность присутствия не применима' : `До ${card.max_hours} ч на площадке`}</div></details>
            </article>)}
            {result.total > 0 && <div className="exclusions"><h3>Что повлияло на выбор</h3><p>В городе и категории: {result.total}. Проходят все условия: {result.eligible}.</p><div className="reason-list">{Object.entries(result.excluded).filter(([, n]) => n > 0).map(([key, n]) => <div key={key}><span>{reasonLabels[key as keyof typeof reasonLabels]}</span><strong>{n}</strong></div>)}</div>{Object.values(result.excluded).some(n => n > 0) && <p className="input-note">Один подрядчик может не пройти несколько условий.</p>}{result.status === 'no_match' && <p>Измените ограничения в форме и повторите подбор. Занятых подрядчиков мы не подставляем.</p>}</div>}
            {result.cards.length > 0 && <p className="result-footnote">{result.ranking === 'semantic' ? 'Порядок — по смысловой близости, затем по цене и ID.' : 'Порядок — по начальной цене, затем по ID.'} {result.explanationMode === 'ai' ? 'AI использован для выбора конкретных цитат; нехватка сведений отмечена в карточках.' : 'Объяснения составлены из условий и анкет без AI.'} Повторный запрос сохраняет порядок.</p>}
          </> : <div className="empty-state"><div className="empty-illustration"><span className="mini-card back-card" /><span className="mini-card front-card"><Flower /><i /><i /><span>ВАШЕ СОВПАДЕНИЕ</span></span><span className="mini-star">✳</span></div><div className="eyebrow">ОТ КАТАЛОГА — К ВЫБОРУ</div><h2>Не десятки вариантов.<br /><em>Несколько подходящих.</em></h2><p>Здесь появятся до трёх карточек.<br />У каждой — свои причины оказаться в вашей подборке.</p><div className="empty-points"><span>01 Проверим дату</span><span>02 Учтём условия</span><span>03 Объясним выбор</span></div></div>}
        </section>
      </div>
      <section className="demo-section"><div><div className="eyebrow">ПОПРОБУЙТЕ НА ПРИМЕРЕ</div><h2>Разные задачи. Честные результаты.</h2><p>Примеры заполняют форму. Нажмите «Найти совпадения», чтобы выполнить реальный запрос.</p></div><div className="demo-grid">{demos.map(d => <button key={d.title} disabled={loading} onClick={() => { setQuery(d.query); setResult(null); setError(''); setFields({}); document.querySelector('form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><span>{d.title}<Arrow diagonal /></span><small>{d.note}</small></button>)}</div></section>
      <section id="how" className="how"><div className="eyebrow">ПРОЗРАЧНЫЙ ПОДХОД</div><h2>У каждого выбора есть причина.</h2><div className="how-grid"><div><span>01 / УСЛОВИЯ</span><h3>Сначала — соответствие</h3><p>Исключаем занятых и тех, кто не подходит по городу, категории, формату и бюджету.</p></div><div><span>02 / СМЫСЛ</span><h3>Затем — ваши пожелания</h3><p>Сопоставляем запрос с описаниями. AI помогает увидеть релевантные особенности анкет.</p></div><div><span>03 / ОБОСНОВАНИЕ</span><h3>Всегда — объяснение</h3><p>Показываем конкретные причины и источники. Если совпадений нет, объясняем ограничения.</p></div></div></section>
    </main>
    <footer className="shell footer"><span className="footer-brand">собрано.</span><p>Прототип для AI-хакатона · Volga Production<br />66 профилей, включая 13 синтетических от организаторов. Имена вымышлены.</p><span>Казахстан · 2026</span></footer>
  </>;
}
