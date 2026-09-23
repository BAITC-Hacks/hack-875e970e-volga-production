import { getCatalog } from '@/lib/catalog';
export function GET() {
  try { return Response.json({ status: 'ok', profiles: getCatalog().profiles.length }); }
  catch { return Response.json({ status: 'error' }, { status: 503 }); }
}
