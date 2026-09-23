'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, NumberInput, Select, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import type { ChatReply, Metadata, Query, Result } from '@/lib/types';
import { readFinderSession, saveFinderSession, type ChatTurn } from '@/lib/finder-session';
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
function AnswerText({ content }: { content: string }) {
  return <div className="answer-text">{content.trim().split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
}
export default function Finder({ metadata }: { metadata: Metadata }) {
  const [query, setQuery] = useState<Query>(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [initialReply, setInitialReply] = useState<ChatReply | null>(null);
  const [initialReplyLoading, setInitialReplyLoading] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const chatController = useRef<AbortController | null>(null);
  const initialReplyController = useRef<AbortController | null>(null);
  const chatGeneration = useRef(0);
  const chatRequestActive = useRef(false);
  const currentRequest = useRef(false);
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    const saved = readFinderSession();
    if (saved) {
      setQuery(saved.query);
      setResult(saved.result);
      setInitialReply(saved.initialReply);
      setChatTurns(saved.chatTurns);
      setChatDraft(saved.chatDraft);
    }
    setSessionReady(true);
    return () => {
      chatGeneration.current += 1;
      chatController.current?.abort();
      initialReplyController.current?.abort();
      initialReplyController.current = null;
    };
  }, []);
  useEffect(() => {
    if (sessionReady) saveFinderSession({ query, result, initialReply, chatTurns, chatDraft });
  }, [sessionReady, query, result, initialReply, chatTurns, chatDraft]);
  useEffect(() => {
    if (sessionReady && result?.query.category === 'Ведущий' && result.status === 'matched' && !initialReply && !initialReplyController.current) {
      void loadOpeningReply(result, chatGeneration.current);
    }
  }, [sessionReady, result, initialReply]);
  const resetConversation = () => {
    chatGeneration.current += 1;
    chatController.current?.abort();
    initialReplyController.current?.abort();
    initialReplyController.current = null;
    chatController.current = null;
    chatRequestActive.current = false;
    setChatLoading(false);
    setChatError('');
    setChatDraft('');
    setChatTurns([]);
    setInitialReply(null);
    setInitialReplyLoading(false);
    setResult(null);
  };
  async function loadOpeningReply(selected: Result, generation: number) {
    const controller = new AbortController();
    initialReplyController.current = controller;
    setInitialReplyLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: selected.query, message: '', history: [] }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok) throw new Error('Ответ по анкетам недоступен');
      const reply: ChatReply = await response.json();
      if (!reply.answer?.trim()) throw new Error('Пустой ответ');
      if (generation === chatGeneration.current) setInitialReply(reply);
    } catch {
      if (generation === chatGeneration.current) setInitialReply({ answer: 'Связный ответ сейчас недоступен. Сравните подтверждённые условия и выдержки из анкет в карточках, затем попробуйте задать вопрос ещё раз.', answerMode: 'fallback' });
    } finally {
      if (generation === chatGeneration.current) {
        initialReplyController.current = null;
        setInitialReplyLoading(false);
      }
    }
  }
  const set = <K extends keyof Query>(key: K, value: Query[K]) => {
    setQuery(q => ({ ...q, [key]: value }));
    setFields(f => ({ ...f, [key]: [] }));
    resetConversation();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (currentRequest.current) return;
    resetConversation();
    currentRequest.current = true; setLoading(true); setError(''); setFields({});
    try {
      const response = await fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) { setFields(data.fields || {}); throw new Error(data.error || 'Не удалось выполнить подбор'); }
      setResult(data);
      requestAnimationFrame(() => { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); });
    } catch (e) { setError(e instanceof Error && e.name === 'TimeoutError' ? 'Сервис не ответил вовремя. Повторите запрос.' : e instanceof TypeError ? 'Не удалось связаться с сервисом. Проверьте соединение и повторите запрос.' : e instanceof Error ? e.message : 'Проверьте соединение и повторите запрос.'); }
    finally { setLoading(false); currentRequest.current = false; }
  }
  async function sendFollowUp(e: FormEvent) {
    e.preventDefault();
    const message = chatDraft.trim();
    if (!result || result.query.category !== 'Ведущий' || !message || chatRequestActive.current) return;
    const generation = chatGeneration.current;
    const controller = new AbortController();
    chatController.current = controller;
    chatRequestActive.current = true;
    setChatLoading(true);
    setChatError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: result.query, message, history: [{ role: 'assistant', content: initialReply?.answer || result.message }, ...chatTurns.slice(-10).map(({ role, content }) => ({ role, content }))] }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось получить ответ');
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('Ответ оказался пустым. Повторите вопрос.');
      if (generation !== chatGeneration.current) return;
      setChatTurns(turns => [...turns, { role: 'user', content: message }, { role: 'assistant', content: data.answer, answerMode: data.answerMode }]);
      setChatDraft('');
      requestAnimationFrame(() => conversationEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }));
    } catch (error) {
      if (generation !== chatGeneration.current) return;
      setChatError(error instanceof Error && error.name === 'TimeoutError' ? 'Ответ занял слишком много времени.' : error instanceof TypeError ? 'Не удалось связаться с сервисом.' : error instanceof Error && error.name === 'AbortError' ? 'Запрос прерван.' : error instanceof Error ? error.message : 'Не удалось получить ответ.');
    } finally {
      if (generation === chatGeneration.current) {
        chatRequestActive.current = false;
        chatController.current = null;
        setChatLoading(false);
      }
    }
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
        <div><div className="eyebrow"><span className="status-dot" /> УМНЫЙ ПОДБОР · КАЗАХСТАН</div><h1>Ваше событие.<br /><em>Ваши люди.</em></h1><p className="hero-copy">Расскажите, что задумали. Мы подберём до трёх подрядчиков из каталога, объясним выбор и поможем обсудить ведущих подробнее.</p></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><Flower className="hero-flower" /><div className="art-caption">МЕНЬШЕ ПОИСКА<br /><span>больше совпадений</span></div><span className="art-number">01 — 03</span></div>
      </section>
      <div className="section-bar"><span><span className="step">01</span> Соберём ваш запрос</span><span className="catalog-count">{metadata.total} профилей в исходном каталоге</span></div>
      <div className="workspace">
        <aside className="form-panel">
          <form id="event-form" onSubmit={submit}>
            <fieldset disabled={loading || !sessionReady}><legend className="sr-only">Параметры мероприятия</legend>
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
              <Textarea className="form-control wishes-input" label="Что для вас важно?"
                description="Опишите событие своими словами. После подбора ведущего сможете уточнять ответ в чате." rows={3} maxLength={600}
                value={query.wishes} onChange={event => set('wishes', event.currentTarget.value)}
                placeholder="Например: камерный корпоратив для 40 гостей, спокойная подача и живое общение без шумных конкурсов"
                disabled={loading} error={fieldError('wishes')} autosize minRows={3} maxRows={6} />
              <Button className="submit" type="submit" loading={loading} disabled={loading}
                rightSection={loading ? null : <Arrow />}>{loading ? 'Подбираем ваших людей…' : 'Найти совпадения'}</Button>
              <p className="form-footnote">Только рекомендации. Без заявок и бронирования.</p>
            </fieldset>
            {error && <div role="alert" className="error-box">{error}</div>}
          </form>
        </aside>
        <section className="results" ref={resultRef} tabIndex={-1} aria-label="Результаты подбора" aria-busy={loading}>
          {loading ? <div className="loading-state" role="status"><Flower /><h2>Разбираем ваш запрос</h2><p>Проверяем условия и календари,<br />сопоставляем анкеты с вашими пожеланиями.</p><div className="loading-line" /><span>Ожидание подбора — до 10 секунд</span></div> : result ? <>
            <div className="results-header"><div className="eyebrow">ВАША ПОДБОРКА</div><h2>{result.status === 'matched' ? 'Есть совпадение.' : result.status === 'category_absent' ? 'Пока нет в каталоге.' : 'Условия не совпали.'}</h2><div className="request-context"><div><span className="context-label">УСЛОВИЯ ПОДБОРА</span><p>{result.query.city} · {result.query.category} · {result.query.date.split('-').reverse().join('.')} · {result.query.format} · до {money(result.query.budget)} ₸{result.query.language ? ` · ${result.query.language}` : ''}{result.query.hours ? ` · ${result.query.hours} ч` : ''}</p>{result.query.wishes && <p className="request-wishes">«{result.query.wishes}»</p>}</div><button type="button" className="edit-conditions" onClick={() => document.getElementById('event-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>Изменить условия <Arrow diagonal /></button></div><p className="selection-summary">{result.message}</p></div>
            {result.cards.map((card, i) => <article className={`contractor${i === 0 && result.cards.length > 1 ? ' contractor-lead' : ''}`} key={card.id}>
              <div className="card-top"><span className="rank">0{i + 1}</span><span className="card-category">{result.query.category} · {card.city}</span><span className="availability"><span /> Свободен по календарю</span></div>
              {i === 0 && result.cards.length > 1 && <div className="lead-label">{result.ranking === 'semantic' ? 'Первый по близости к запросу' : 'Первый по начальной цене'}</div>}
              <div className="card-heading"><h3>{card.anon_name}</h3><div className="price"><span>от </span>{money(card.price_from_kzt)} <span>₸</span></div></div>
              <div className="explanation"><span className="explanation-label">ПОЧЕМУ В ПОДБОРКЕ</span><p>{card.explanation}</p></div>
              <ul className="checks">{card.checks.slice(2).map(c => <li key={c}><span aria-hidden="true">✓</span> {c}</li>)}</ul>
              <div className="provenance"><span className={card.synthetic ? 'tag synthetic' : 'tag'}>{card.synthetic ? 'Синтетический профиль организаторов' : 'Анонимизированный профиль'}</span>{card.price_imputed && <span className="data-note">Цена проставлена в датасете</span>}{card.city_imputed && <span className="data-note">Город проставлен в датасете</span>}</div>
              <details className="source"><summary>На чём основано объяснение <span>+</span></summary><blockquote>{card.evidence}</blockquote><p className="input-note">Сведения из анкеты подрядчика, не независимая проверка.</p><p>{card.description}</p><div className="input-note">{card.id} · Языки: {card.languages.join(', ')} · {card.max_hours === null ? 'Длительность присутствия не применима' : `До ${card.max_hours} ч на площадке`}</div></details>
            </article>)}
            {result.query.category === 'Ведущий' && result.status === 'matched' && <div className="conversation" aria-label="Ответ по подборке">
              <div className="assistant-answer"><div className="answer-heading"><span className="answer-mark"><Flower /></span><span>{initialReplyLoading ? 'СОБРАНО · СРАВНИВАЕМ АНКЕТЫ' : initialReply?.answerMode === 'ai' ? 'СОБРАНО · AI-ОТВЕТ ПО АНКЕТАМ' : 'СОБРАНО · ОТВЕТ ПО КАТАЛОГУ'}</span></div>{initialReplyLoading ? <p className="answer-text" role="status">Карточки уже готовы. Готовим краткое сравнение ведущих…</p> : <AnswerText content={initialReply?.answer || 'Сравните ведущих по карточкам и задайте уточняющий вопрос.'} />}{result.cards.length > 0 && <p className="answer-provenance">Сведения из анкет не проверены независимо. Наличие, состав услуг и итоговую цену уточните у подрядчика.</p>}</div>
                <div className="chat-transcript" role="log" aria-label="Продолжение диалога" aria-live="polite" aria-relevant="additions text">{chatTurns.map((turn, index) => turn.role === 'user' ? <div className="chat-turn user-turn" key={index}><span>ВАШ ВОПРОС</span><p>{turn.content}</p></div> : <div className="chat-turn assistant-turn" key={index}><div className="answer-heading"><span className="answer-mark"><Flower /></span><span>{turn.answerMode === 'ai' ? 'СОБРАНО · AI-ОТВЕТ' : 'СОБРАНО · ОТВЕТ ПО КАТАЛОГУ'}</span></div><AnswerText content={turn.content} /></div>)}</div>
                {chatLoading && <div className="chat-working" role="status"><span className="working-dot" /> Сопоставляем вопрос с анкетами ведущих…</div>}
                <div ref={conversationEndRef} />
                <form className="chat-composer" onSubmit={sendFollowUp}><label htmlFor="chat-question">Спросите о выборе ведущего</label><div className="chat-compose-row"><textarea id="chat-question" value={chatDraft} onChange={event => { setChatDraft(event.currentTarget.value); if (chatError) setChatError(''); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Например: кто лучше подойдёт для спокойного корпоративного вечера?" maxLength={1000} rows={2} disabled={chatLoading} aria-describedby="chat-hint" /><button type="submit" disabled={chatLoading || !chatDraft.trim()}>{chatLoading ? 'Отвечаем…' : 'Спросить'} {!chatLoading && <Arrow />}</button></div><p id="chat-hint">Отвечаем только о выборе ведущего из этой подборки. Enter — отправить, Shift+Enter — новая строка.</p>{chatError && <p className="chat-error" role="alert">{chatError} Вопрос сохранён — попробуйте отправить ещё раз.</p>}</form>
            </div>}
            {result.warnings.map(w => <div key={w} className="warning" role="status">{w}</div>)}

            {result.total > 0 && <div className="exclusions"><h3>Что повлияло на выбор</h3><p>В городе и категории: {result.total}. Проходят все условия: {result.eligible}.</p><div className="reason-list">{Object.entries(result.excluded).filter(([, n]) => n > 0).map(([key, n]) => <div key={key}><span>{reasonLabels[key as keyof typeof reasonLabels]}</span><strong>{n}</strong></div>)}</div>{Object.values(result.excluded).some(n => n > 0) && <p className="input-note">Один подрядчик может не пройти несколько условий.</p>}{result.status === 'no_match' && <p>Измените ограничения в форме и повторите подбор. Занятых подрядчиков мы не подставляем.</p>}</div>}
            {result.cards.length > 0 && <p className="result-footnote">{result.ranking === 'semantic' ? 'Порядок — по смысловой близости, затем по цене и ID.' : 'Порядок — по начальной цене, затем по ID.'} {result.explanationMode === 'ai' ? 'Объяснения подготовлены с AI и привязаны к цитатам анкет.' : 'Объяснения составлены из условий и анкет без AI.'} Повторный запрос сохраняет порядок.</p>}
          </> : <div className="empty-state"><div className="empty-illustration"><span className="mini-card back-card" /><span className="mini-card front-card"><Flower /><i /><i /><span>ВАШЕ СОВПАДЕНИЕ</span></span><span className="mini-star">✳</span></div><div className="eyebrow">ОТ КАТАЛОГА — К ВЫБОРУ</div><h2>Ваш диалог<br /><em>начнётся здесь.</em></h2><p>Заполните условия и расскажите, что для вас важно. Получите объяснение выбора, а по ведущим сможете задать уточняющие вопросы.</p><div className="empty-points"><span>01 Проверим дату</span><span>02 Учтём пожелания</span><span>03 Объясним выбор</span></div></div>}
        </section>
      </div>
      <section className="demo-section"><div><div className="eyebrow">ПОПРОБУЙТЕ НА ПРИМЕРЕ</div><h2>Разные задачи. Честные результаты.</h2><p>Примеры заполняют форму. Нажмите «Найти совпадения», чтобы выполнить реальный запрос.</p></div><div className="demo-grid">{demos.map(d => <button key={d.title} disabled={loading} onClick={() => { setQuery(d.query); resetConversation(); setError(''); setFields({}); document.getElementById('event-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><span>{d.title}<Arrow diagonal /></span><small>{d.note}</small></button>)}</div></section>
      <section id="how" className="how"><div className="eyebrow">ПРОЗРАЧНЫЙ ПОДХОД</div><h2>У каждого выбора есть причина.</h2><div className="how-grid"><div><span>01 / УСЛОВИЯ</span><h3>Сначала — соответствие</h3><p>Исключаем занятых и тех, кто не подходит по городу, категории, формату и бюджету.</p></div><div><span>02 / СМЫСЛ</span><h3>Затем — ваши пожелания</h3><p>Сопоставляем запрос с описаниями. Для ведущих можно уточнить выбор в диалоге.</p></div><div><span>03 / ОБОСНОВАНИЕ</span><h3>Всегда — объяснение</h3><p>Показываем конкретные причины и источники. Если совпадений нет, объясняем ограничения.</p></div></div></section>
    </main>
    <footer className="shell footer"><span className="footer-brand">собрано.</span><p>Прототип для AI-хакатона · Volga Production<br />66 профилей, включая 13 синтетических от организаторов. Имена вымышлены.</p><span>Казахстан · 2026</span></footer>
  </>;
}
