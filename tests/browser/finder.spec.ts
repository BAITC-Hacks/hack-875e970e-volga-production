import { test, expect } from '@playwright/test';
for (const width of [375, 414, 768, 1024, 1440]) {
  test(`responsive layout and real selection at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ваше событие. Ваши люди.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Найти совпадения' }).click();
    await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 35000 });
    await expect(page.getByRole('heading', { name: 'Есть совпадение.' })).toBeVisible();
    await expect(page.locator('.contractor').first()).toContainText('Свободен по календарю');
    await expect(page.locator('.contractor-lead')).toHaveCount(1);
    await expect(page.locator('.contractor-lead .lead-label')).toContainText(/Первый по/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 375) await page.screenshot({ path: `docs/evidence/selection-${width}.png`, fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}
test('all demo outcomes, source disclosure and date-dependent top three', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 35000 });
  const first = await page.locator('.card-heading h3').allTextContents();
  await page.locator('.source summary').first().click();
  await expect(page.locator('blockquote').first()).toBeVisible();
  await page.getByRole('button', { name: 'Другая дата', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 35000 });
  expect(await page.locator('.card-heading h3').allTextContents()).not.toEqual(first);
  await page.getByRole('button', { name: 'Флористы', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(2, { timeout: 35000 });
  await expect(page.locator('.selection-summary')).toContainText('показываем всех');
  await expect(page.locator('.results')).toContainText('Синтетический профиль организаторов');
  await page.getByRole('button', { name: 'Малый бюджет', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.getByRole('heading', { name: 'Условия не совпали.' })).toBeVisible();
  await page.getByRole('button', { name: 'Нет категории', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.getByRole('heading', { name: 'Пока нет в каталоге.' })).toBeVisible();
});
test('invalid API input returns validation errors', async ({ request }) => {
  const response = await request.post('/api/recommendations', { data: { city: 'Алматы', date: '2026-10-99', format: 'корпоратив', category: 'Ведущий', budget: -1 } });
  expect(response.status()).toBe(400);
  const data = await response.json();
  expect(data.fields.date).toBeTruthy(); expect(data.fields.budget).toBeTruthy();
});
test('network error and retry preserve form, loading blocks duplicate requests', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.route('**/api/recommendations', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.error-box')).toContainText('Проверьте соединение и повторите запрос.');
  await expect(page.getByRole('combobox', { name: 'Город', exact: true })).toHaveValue('Алматы');
  await page.unroute('**/api/recommendations');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 35000 });
});

test('host conversation opens after selection, preserves a failed question, and resets with the form', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Спросите о выборе ведущего' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.assistant-answer')).toBeVisible({ timeout: 35000 });
  await expect(page.locator('.assistant-answer')).not.toContainText('Готовим краткое сравнение', { timeout: 15000 });
  const question = page.getByRole('textbox', { name: 'Спросите о выборе ведущего' });
  await expect(question).toBeVisible();
  await question.fill('Кто больше подходит для спокойного вечера?');
  await page.route('**/api/chat', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Спросить' }).click();
  await expect(page.locator('.chat-error')).toContainText('Вопрос сохранён');
  await expect(question).toHaveValue('Кто больше подходит для спокойного вечера?');
  await page.unroute('**/api/chat');
  await page.route('**/api/chat', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'Первый ведущий подходит для спокойного вечера по описанию анкеты. Уточните детали программы.', answerMode: 'ai' }) }));
  await page.getByRole('button', { name: 'Спросить' }).click();
  await expect(page.locator('.chat-transcript .user-turn')).toContainText('Кто больше подходит');
  await expect(page.locator('.chat-transcript .assistant-turn')).toContainText('Первый ведущий подходит');
  await page.getByRole('textbox', { name: 'Что для вас важно?' }).fill('Нужен другой стиль');
  await expect(page.getByRole('textbox', { name: 'Спросите о выборе ведущего' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ваш диалог начнётся здесь.' })).toBeVisible();
  await page.getByRole('button', { name: 'Флористы', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(2, { timeout: 12000 });
  await expect(page.locator('.assistant-answer')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Спросите о выборе ведущего' })).toHaveCount(0);
});

test('cards appear while the separate opening comparison is still pending', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/chat', async route => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'Первый ведущий ближе к запросу по анкете. Сравните детали с другими вариантами.', answerMode: 'ai' }) });
  });
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 12000 });
  await expect(page.locator('.assistant-answer')).toContainText('Готовим краткое сравнение');
  await expect(page.locator('.assistant-answer')).toContainText('Первый ведущий ближе к запросу');
});
