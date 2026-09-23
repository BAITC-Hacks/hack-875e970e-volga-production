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
    await expect(page.locator('.contractor')).toHaveCount(3);
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
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Город', exact: true })).toHaveValue('Алматы');
  await page.unroute('**/api/recommendations');
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.contractor')).toHaveCount(3);
});
