import { expect, test } from '@playwright/test';

test('freezes combat until explicit resume', async ({ page }) => {
  await page.goto('/?debug');
  const pauseButton = page.getByRole('button', {
    name: '一時停止と操作ガイド',
  });
  await pauseButton.click();
  const dialog = page.getByRole('dialog', { name: '一時停止中' });
  const resumeButton = dialog.getByRole('button', { name: '戦闘を再開' });
  const hud = page.locator('.debug-panel');
  const health = page.locator('.compact-hud progress');
  await expect(dialog).toBeVisible();
  const before = await hud.textContent();
  const hitPoints = await health.getAttribute('value');
  await page.waitForTimeout(400);
  expect(await hud.textContent()).toBe(before);
  expect(await health.getAttribute('value')).toBe(hitPoints);
  await expect(resumeButton).toBeFocused();
  await page.locator('.pause-toggle').evaluate((element) => {
    if (element instanceof HTMLElement) element.focus();
  });
  await expect(resumeButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(hud).not.toHaveText(before ?? '');
  await expect(pauseButton).toBeFocused();
});

test('blur pauses until explicit resume', async ({ page }) => {
  await page.goto('/?debug');
  const pauseButton = page.getByRole('button', {
    name: '一時停止と操作ガイド',
  });
  await expect(pauseButton).toBeVisible();
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
  const slotPicker = page.getByRole('region', {
    name: '武器の装着先を選択',
  });
  await expect(slotPicker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(slotPicker).not.toBeVisible();
  const pauseDialog = page.getByRole('dialog', { name: '一時停止中' });
  await expect(pauseDialog).not.toBeVisible();
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
      const layoutFits = await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight &&
          element.scrollWidth <= element.clientWidth
        );
      });
      expect(layoutFits).toBe(true);
      await dialog.getByRole('button', { name: '戦闘を再開' }).tap();
      await expect(dialog).not.toBeVisible();
    });
  });
}
