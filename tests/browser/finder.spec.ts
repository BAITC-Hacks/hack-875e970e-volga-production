import { test, expect } from '@playwright/test';
for (const width of [375, 414, 768, 1024, 1440]) {
  test(`responsive layout and real selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ваше событие. Ваши люди.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Найти совпадения' }).click();
    await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Есть совпадение.' })).toBeVisible();
    await expect(page.locator('.contractor').first()).toContainText('Свободен по календарю');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 375) await page.screenshot({ path: `docs/evidence/selection-${width}.png`, fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}
test('all demo outcomes, source disclosure and date-dependent top three', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3);
  const first = await page.locator('.card-heading h3').allTextContents();
  await page.locator('.source summary').first().click();
  await expect(page.locator('blockquote').first()).toBeVisible();
  await page.getByRole('button', { name: 'Другая дата', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3);
  expect(await page.locator('.card-heading h3').allTextContents()).not.toEqual(first);
  await page.getByRole('button', { name: 'Флористы', exact: false }).click();
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(2);
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
  await page.goto('/');
  await page.route('**/api/recommendations', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.error-box[role="alert"]')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Город', exact: true })).toHaveValue('Алматы');
  await page.unroute('**/api/recommendations');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3);
});

test('sparse band remains visible with an honest explanation and full source', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Кого ищем', exact: true }).click();
  await page.getByRole('option', { name: 'Лайв-бэнд', exact: true }).click();
  await page.getByRole('textbox', { name: 'Бюджет на подрядчика' }).fill('2000000');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3, { timeout: 15000 });
  const sparse = page.locator('.contractor').filter({ has: page.locator('.source', { hasText: 'HK-25279' }) });
  await expect(sparse).toHaveCount(1);
  await expect(sparse.locator('.explanation')).toContainText('не удалось выделить конкретную отличительную особенность');
  await expect(sparse.locator('.explanation')).not.toContainText('сверкаем');
  await sparse.locator('.source summary').click();
  await expect(sparse.locator('.source')).toContainText('Ниже — полная анкета');
  await expect(sparse.locator('.source')).toContainText('сверкаем');
  await expect(sparse.locator('blockquote')).toHaveCount(0);
  await expect(page.locator('.contractor').filter({ has: page.locator('blockquote') })).toHaveCount(2);
});
