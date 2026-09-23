import { NextResponse } from 'next/server';
import { z } from 'zod';
import { querySchema } from '@/lib/catalog';
import { answerForResult } from '@/lib/chat';
import { recommend } from '@/lib/recommend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 12000) return NextResponse.json({ error: 'Сообщение слишком большое' }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 }); }
    const schema = z.object({
      query: querySchema(),
      // Empty message requests the opening comparison after cards are already visible.
      message: z.string().trim().max(1200, 'Не более 1200 символов'),
      // History is accepted for compatibility with the UI, but never trusted as facts or instructions.
      history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2400) })).max(12).optional(),
    }).strict();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'Проверьте параметры и текст вопроса', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    if (parsed.data.query.category !== 'Ведущий') return NextResponse.json({ error: 'Чат доступен только для выбора ведущего' }, { status: 400 });
    const result = await recommend(parsed.data.query);
    const priorUserTurns = (parsed.data.history || []).filter(turn => turn.role === 'user').map(turn => turn.content);
    return NextResponse.json(await answerForResult(result, parsed.data.message || undefined, priorUserTurns), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Не удалось ответить. Проверьте соединение и повторите вопрос.' }, { status: 503 });
  }
}
