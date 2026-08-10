import { expect, test } from '@playwright/test';

test('supports keyboard and thumb controls while keeping debug opt-in', async ({
  page,
}) => {
  await page.goto('/?debug=1');

  const health = page.getByRole('region', { name: '車両耐久' });
  const debug = page.locator('.debug-panel');
  const main = page.getByRole('button', { name: '主武器' });

  await expect(health).toContainText('100');
  await expect(main).toContainText('30');
  await expect(debug).toContainText('position 10.0');

  await page.keyboard.down('d');
  await expect(debug).not.toContainText('position 10.0');
  await page.keyboard.up('d');

  await page.keyboard.down('Space');
  await expect(main).not.toContainText('30');
  await page.keyboard.up('Space');

  const positionBeforeTouch = await debug.textContent();
  const backward = page.getByRole('button', { name: '後退' });
  await backward.hover();
  await page.mouse.down();
  await expect(debug).not.toHaveText(positionBeforeTouch ?? '');
  await page.mouse.up();

  await page.reload();
  await expect(health).toContainText('100');
  await expect(main).toContainText('30');
  await expect(debug).toContainText('position 10.0');
});

test('hides diagnostic UI from the product view', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.debug-panel')).toHaveCount(0);
});
