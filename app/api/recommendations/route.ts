import { NextResponse } from 'next/server';
import { querySchema } from '@/lib/catalog';
import { recommend } from '@/lib/recommend';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 8000) return NextResponse.json({ error: 'Запрос слишком большой' }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(text); } catch { return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 }); }
    const parsed = querySchema().safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'Проверьте параметры мероприятия', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const result = await recommend(parsed.data);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Не удалось выполнить подбор. Проверьте доступность каталога и хранилища кеша, затем повторите.' }, { status: 503 });
  }
}
