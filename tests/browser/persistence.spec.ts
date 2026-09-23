import { test, expect } from '@playwright/test';
import evidence from '../../docs/evidence/smoke.json' with { type: 'json' };

// Recorded API fixtures keep these browser persistence checks independent of AI availability.
const selection = evidence.runs[0].result;
const key = 'sobrano:finder:v1';

test('reload restores selection, conversation and draft without repeating completed requests', async ({ page }) => {
  let selections = 0;
  let replies = 0;
  await page.route('**/api/recommendations', route => {
    selections++;
    return route.fulfill({ json: selection });
  });
  await page.route('**/api/chat', route => {
    replies++;
    return route.fulfill({ json: { answer: replies === 1 ? 'Начальное сравнение анкет.' : 'Ответ на уточнение.', answerMode: 'ai' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.assistant-answer')).toContainText('Начальное сравнение анкет.');
  const cards = await page.locator('.card-heading h3').allTextContents();
  const question = page.getByRole('textbox', { name: 'Спросите о выборе ведущего' });
  await question.fill('Кто спокойнее?');
  await page.getByRole('button', { name: 'Спросить', exact: true }).click();
  await expect(page.locator('.assistant-turn')).toContainText('Ответ на уточнение.');
  await question.fill('Что уточнить перед договором?');
  await page.reload();
  await expect(page.locator('.card-heading h3')).toHaveText(cards);
  await expect(page.locator('.assistant-answer')).toContainText('Начальное сравнение анкет.');
  await expect(page.locator('.user-turn')).toContainText('Кто спокойнее?');
  await expect(page.locator('.assistant-turn')).toContainText('Ответ на уточнение.');
  await expect(question).toHaveValue('Что уточнить перед договором?');
  expect(selections).toBe(1);
  expect(replies).toBe(2);
  await question.fill('Продолжим после обновления');
  await page.getByRole('button', { name: 'Спросить', exact: true }).click();
  await expect(page.locator('.user-turn')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Что для вас важно?' }).fill('Другие пожелания');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Что для вас важно?' })).toHaveValue('Другие пожелания');
  await expect(page.locator('.contractor')).toHaveCount(0);
  await expect(question).toHaveCount(0);
});

test('reload resumes an unfinished opening reply and keeps a pending question as a draft', async ({ page }) => {
  await page.route('**/api/recommendations', route => route.fulfill({ json: selection }));
  await page.route('**/api/chat', () => {});
  await page.goto('/');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.assistant-answer')).toContainText('Готовим краткое сравнение');
  await page.unroute('**/api/chat');
  await page.route('**/api/chat', route => route.fulfill({ json: { answer: 'Восстановленное сравнение.', answerMode: 'fallback' } }));
  await page.reload();
  await expect(page.locator('.assistant-answer')).toContainText('Восстановленное сравнение.');
  await page.unroute('**/api/chat');
  await page.route('**/api/chat', () => {});
  const question = page.getByRole('textbox', { name: 'Спросите о выборе ведущего' });
  await question.fill('Вопрос в процессе отправки');
  await page.getByRole('button', { name: 'Спросить', exact: true }).click();
  await expect(question).toBeDisabled();
  await page.reload();
  await expect(question).toBeEnabled();
  await expect(question).toHaveValue('Вопрос в процессе отправки');
  await expect(page.locator('.contractor')).toHaveCount(selection.cards.length);
});

test('empty results survive reload and invalid storage does not break the form', async ({ page }) => {
  const empty = evidence.runs.find(run => run.result.status === 'no_match')!.result;
  await page.route('**/api/recommendations', route => route.fulfill({ json: empty }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Малый бюджет', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.getByRole('heading', { name: 'Условия не совпали.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Условия не совпали.' })).toBeVisible();
  await page.evaluate(key => sessionStorage.setItem(key, '{"version":1,"result":{}}'), key);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Найти совпадения' })).toBeEnabled();
  await expect(page.locator('.empty-state')).toBeVisible();
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.getByRole('heading', { name: 'Условия не совпали.' })).toBeVisible();
});
