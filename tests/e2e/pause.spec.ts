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

test.describe('touch portrait 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('blocks portrait combat and requires resume after rotation', async ({
    page,
  }) => {
    await page.goto('/?debug');
    const orientationGuard = page.getByRole('dialog', {
      name: '横向きでプレイ',
    });
    const pauseDialog = page.getByRole('dialog', { name: '一時停止中' });
    const hud = page.locator('.debug-panel');

    await expect(orientationGuard).toBeVisible();
    await expect(pauseDialog).not.toBeVisible();
    await page.waitForTimeout(80);
    const blockedTick = await hud.textContent();
    await page.waitForTimeout(350);
    expect(await hud.textContent()).toBe(blockedTick);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(orientationGuard).not.toBeVisible();
    await expect(pauseDialog).toBeVisible();
    const pausedTick = await hud.textContent();
    await page.waitForTimeout(300);
    expect(await hud.textContent()).toBe(pausedTick);

    await pauseDialog.getByRole('button', { name: '戦闘を再開' }).tap();
    await expect(pauseDialog).not.toBeVisible();
    await expect(hud).not.toHaveText(pausedTick ?? '');
  });
});

test.describe('touch landscape 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('tracks the visible viewport and suppresses native game gestures', async ({
    page,
  }) => {
    await page.goto('/?debug');
    await expect(
      page.getByRole('dialog', { name: '横向きでプレイ' }),
    ).not.toBeVisible();

    const viewportFit = await page
      .locator('.immersive-shell')
      .evaluate((shell) => {
        const rect = shell.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
          touchAction: getComputedStyle(shell).touchAction,
          visualHeight: window.visualViewport?.height ?? innerHeight,
          visualWidth: window.visualViewport?.width ?? innerWidth,
        };
      });
    expect(
      Math.abs(viewportFit.height - viewportFit.visualHeight),
    ).toBeLessThan(2);
    expect(Math.abs(viewportFit.width - viewportFit.visualWidth)).toBeLessThan(
      2,
    );
    expect(viewportFit.touchAction).toBe('none');

    const contextMenuPrevented = await page
      .locator('.combat-stage canvas')
      .evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      });
    expect(contextMenuPrevented).toBe(true);

    const dragPrevented = await page
      .locator('.game-shell')
      .evaluate((element) => {
        const event = new Event('dragstart', {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      });
    expect(dragPrevented).toBe(true);

    await page.getByRole('button', { name: '一時停止と操作ガイド' }).tap();
    const dialog = page.getByRole('dialog', { name: '一時停止中' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '戦闘を再開' }).tap();
    await expect(dialog).not.toBeVisible();
  });
});
