import { expect, test } from '@playwright/test';

test('normal runs start empty and cannot charge by waiting or pressing E', async ({
  page,
}) => {
  await page.goto('/?debug');
  const meter = page.getByRole('progressbar', { name: '突破ゲージ' });
  await expect(meter).toHaveAttribute('value', '0');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  await expect(meter).toHaveAttribute('value', '0');
  await expect(
    page.getByRole('button', { name: '前線突破', exact: true }),
  ).toBeDisabled();
});

test('earns charge from a real hit and requires a fresh E press, not a held key', async ({
  page,
}) => {
  await page.goto('/?debug&breakthroughPreview=charging');
  const panel = page.getByRole('region', { name: '突破状況' });
  await expect(panel).toHaveAttribute('data-state', 'charging');
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(100);
  await page.keyboard.down('Space');
  await expect(panel).toHaveAttribute('data-state', 'ready');
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyE');
  await expect(panel).toHaveAttribute('data-state', 'ready');
  await page.keyboard.up('KeyE');
  await page.keyboard.press('KeyE');
  await expect(panel).toHaveAttribute('data-state', 'active');
});

test('vents overheat and freezes the burst clock during pause and blur', async ({
  page,
}) => {
  await page.goto('/?debug&breakthroughPreview=ready');
  const primary = page.getByRole('button', { name: '主武器', exact: true });
  const panel = page.getByRole('region', { name: '突破状況' });
  await expect(primary).toHaveClass(/overheat/);
  await page.keyboard.press('KeyE');
  await expect(panel).toHaveAttribute('data-state', 'active');
  await expect(primary).not.toHaveClass(/overheat/);
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: '一時停止中' });
  await expect(dialog).toContainText('前線突破');
  const remaining = page.getByRole('progressbar', {
    name: '突破の残り時間',
    includeHidden: true,
  });
  const value = await remaining.getAttribute('value');
  await page.waitForTimeout(350);
  expect(await remaining.getAttribute('value')).toBe(value);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Escape');
  await expect(remaining).not.toHaveAttribute('value', value!);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(dialog).toBeVisible();
  const blurred = await remaining.getAttribute('value');
  await page.waitForTimeout(200);
  expect(await remaining.getAttribute('value')).toBe(blurred);
  await dialog.getByRole('button', { name: '戦闘を再開' }).click();
  await expect(panel).toHaveAttribute('data-state', 'charging', {
    timeout: 7000,
  });
});

for (const key of ['Space', 'Enter']) {
  test(`supports native ${key} button activation without also shooting`, async ({
    page,
  }) => {
    await page.goto('/?debug&breakthroughPreview=ready');
    const button = page.getByRole('button', { name: '前線突破', exact: true });
    const ammo = await page.locator('.ammo').textContent();
    await button.focus();
    await page.keyboard.press(key);
    await expect(page.locator('.breakthrough-panel')).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(await page.locator('.ammo').textContent()).toBe(ammo);
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test.describe(`breakthrough controls ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });
    test('keeps the action readable, non-overlapping and tappable', async ({
      page,
    }) => {
      await page.goto('/?debug&breakthroughPreview=ready');
      const button = page.getByRole('button', {
        name: '前線突破',
        exact: true,
      });
      await expect(button).toBeEnabled();
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      const overlaps = await button.evaluate((element) => {
        const a = element.getBoundingClientRect();
        return [
          ...document.querySelectorAll('.control-button, .pause-toggle'),
        ].some((other) => {
          const b = other.getBoundingClientRect();
          return (
            Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
          );
        });
      });
      expect(overlaps).toBe(false);
      if (process.env.CAPTURE_UI_REVIEW)
        await page.screenshot({
          path: `test-results/breakthrough-ready-${viewport.width}x${viewport.height}.png`,
        });
      await button.tap();
      await expect(page.locator('.breakthrough-panel')).toHaveAttribute(
        'data-state',
        'active',
      );
      if (process.env.CAPTURE_UI_REVIEW)
        await page.screenshot({
          path: `test-results/breakthrough-active-${viewport.width}x${viewport.height}.png`,
        });
    });
  });
}
