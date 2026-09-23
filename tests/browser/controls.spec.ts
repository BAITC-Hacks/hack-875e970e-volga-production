import { expect, test } from '@playwright/test';

test('form controls keep one appearance and send selected values across browsers', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');

  const date = page.getByRole('button', { name: 'Дата мероприятия' });
  await expect(date).toHaveText('15.10.2026');
  await date.click();
  const calendar = page.getByRole('dialog');
  await expect(calendar).toBeVisible();
  await expect(calendar).toContainText('октябрь 2026', { ignoreCase: true });
  await calendar.getByRole('button', { name: /20 октября 2026/i }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(calendar.getByRole('button', { name: /21 октября 2026/i })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(date).toHaveText('20.10.2026');

  await page.getByRole('combobox', { name: 'Город', exact: true }).click();
  await page.getByRole('option', { name: 'Астана' }).click();
  await page.getByRole('textbox', { name: 'Бюджет на подрядчика' }).fill('750000');
  await page.getByText('Язык и длительность').click();
  await page.getByRole('combobox', { name: 'Язык' }).click();
  await page.getByRole('option', { name: 'казахский' }).click();
  await page.getByRole('textbox', { name: 'Длительность, ч' }).fill('4.5');
  await page.getByRole('textbox', { name: 'Что для вас важно?' }).fill('Живое общение');

  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/recommendations', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Тестовый ответ', fields: {} }) });
  });
  await page.getByRole('button', { name: 'Найти совпадения' }).click();
  await expect(page.locator('.error-box')).toContainText('Тестовый ответ');
  expect(submitted).toMatchObject({ city: 'Астана', date: '2026-10-20', budget: 750000, language: 'казахский', hours: 4.5, wishes: 'Живое общение' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('calendar respects the first and last permitted dates', async ({ page }) => {
  await page.goto('/');
  const date = page.getByRole('button', { name: 'Дата мероприятия' });
  await date.click();
  const calendar = page.getByRole('dialog');
  await calendar.locator('button[data-direction="previous"]').click();
  await expect(calendar.getByRole('button', { name: '22 сентября 2026' })).toBeDisabled();
  await expect(calendar.getByRole('button', { name: '23 сентября 2026' })).toBeEnabled();
  await calendar.getByRole('button', { name: '23 сентября 2026' }).click();
  await expect(date).toHaveText('23.09.2026');

  await date.click();
  for (let i = 0; i < 3; i += 1) await calendar.locator('button[data-direction="next"]').click();
  await expect(calendar.getByRole('button', { name: '31 декабря 2026' })).toBeEnabled();
  await expect(calendar.getByRole('button', { name: '1 января 2027' })).toBeDisabled();
  await calendar.getByRole('button', { name: '31 декабря 2026' }).click();
  await expect(date).toHaveText('31.12.2026');
});
