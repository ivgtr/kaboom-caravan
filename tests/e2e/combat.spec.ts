import { expect, test } from '@playwright/test';

test('moves, fires both weapons, activates the skill and restores a fresh session', async ({
  page,
}) => {
  await page.goto('/');

  const hud = page.getByRole('region', { name: '車両状態' });
  const weapons = page.getByRole('region', { name: '武器状態' });
  const debug = page.locator('.debug-panel');

  await expect(hud).toContainText('HP 100');
  await expect(hud).toContainText('AMMO 30');
  await expect(weapons).toContainText('機関砲 12–38m READY');

  await page.keyboard.down('d');
  await expect(debug).not.toContainText('position 10.0');
  await page.keyboard.up('d');

  await page.keyboard.down('Space');
  await expect(hud).not.toContainText('AMMO 30');
  await page.keyboard.up('Space');

  await page.keyboard.down('e');
  await expect(weapons).toContainText(/レールガン 30–72m \d+\.\ds/);
  await page.keyboard.up('e');

  await page.keyboard.down('q');
  await expect(weapons).toContainText(/緊急ブースト \d+\.\ds/);
  await page.keyboard.up('q');

  await page.reload();
  await expect(hud).toContainText('HP 100');
  await expect(hud).toContainText('AMMO 30');
  await expect(debug).toContainText('position 10.0');
});
