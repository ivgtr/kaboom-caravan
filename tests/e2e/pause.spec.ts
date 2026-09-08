import { expect, test } from '@playwright/test';

test('pause freezes the HUD and resumes only on request', async ({ page }) => {
  await page.goto('/?debug');
  await page.getByRole('button', { name: '一時停止と操作ガイド' }).click();
  const dialog = page.getByRole('dialog', { name: '一時停止中' });
  await expect(dialog).toBeVisible();
  const before = await page.locator('.debug-panel').textContent();
  const hp = await page.locator('.compact-hud progress').getAttribute('value');
  await page.waitForTimeout(400);
  expect(await page.locator('.debug-panel').textContent()).toBe(before);
  expect(
    await page.locator('.compact-hud progress').getAttribute('value'),
  ).toBe(hp);
  await expect(dialog.getByRole('button', { name: '戦闘を再開' })).toBeFocused();
  await page.locator('.pause-toggle').evaluate((element) => {
    if (element instanceof HTMLElement) element.focus();
  });
  await expect(dialog.getByRole('button', { name: '戦闘を再開' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.debug-panel')).not.toHaveText(before ?? '');
  await expect(
    page.getByRole('button', { name: '一時停止と操作ガイド' }),
  ).toBeFocused();
});

test('blur pauses until explicit resume', async ({ page }) => {
  await page.goto('/?debug');
  await expect(
    page.getByRole('button', { name: '一時停止と操作ガイド' }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const dialog = page.getByRole('dialog', { name: '一時停止中' });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '戦闘を再開' }).click();
  await expect(dialog).not.toBeVisible();
});

test('repeat is ignored and mute is preserved', async ({ page }) => {
  await page.goto('/?debug');
  await page.getByRole('button', { name: '音をオフ' }).click();
  await page.keyboard.down('p');
  await page.keyboard.down('p');
  const dialog = page.getByRole('dialog', { name: '一時停止中' });
  await expect(dialog).toBeVisible();
  await page.keyboard.up('p');
  await page.keyboard.press('p');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: '音をオン' })).toBeVisible();
});

test('Escape still cancels weapon slot selection', async ({ page }) => {
  await page.goto('/?debug&rewardPreview=weapon-slot');
  await page
    .locator('.reward-card:not(.reward-upgrade).reward-weapon button')
    .first()
    .click();
  await expect(
    page.getByRole('region', { name: '武器の装着先を選択' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('region', { name: '武器の装着先を選択' }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('dialog', { name: '一時停止中' }),
  ).not.toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`touch ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });

    test('fits the viewport and supports touch resume', async ({ page }) => {
      await page.goto('/?debug');
      await page.getByRole('button', { name: '一時停止と操作ガイド' }).tap();
      const dialog = page.getByRole('dialog', { name: '一時停止中' });
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= innerHeight &&
            element.scrollWidth <= element.clientWidth
          );
        }),
      ).toBe(true);
      await dialog.getByRole('button', { name: '戦闘を再開' }).tap();
      await expect(dialog).not.toBeVisible();
    });
  });
}
