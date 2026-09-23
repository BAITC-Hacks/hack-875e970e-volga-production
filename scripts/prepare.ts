import { prepareVectors } from '../lib/ai';
import { getCatalog } from '../lib/catalog';
try {
  console.log(`Каталог проверен: ${getCatalog().profiles.length} профилей.`);
  const vectors = await prepareVectors(AbortSignal.timeout(60000));
  console.log(`Готово: ${Object.keys(vectors).length} эмбеддингов сохранено. Ключ не выводится.`);
} catch (error) {
  console.error('Не удалось подготовить эмбеддинги. Проверьте сеть, OPENAI_API_KEY, баланс и доступ к модели.');
  if (error && typeof error === 'object' && 'status' in error) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
