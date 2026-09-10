import { expect, test } from '@playwright/test';

const names = {
  relay: '連携機関',
  siege: '展開砲座',
  counter: '反攻蓄電器',
} as const;

test('normal starts have no core, and debug previews require the debug flag', async ({
  page,
}) => {
  await page.goto('/?quickStart&corePreview=counter');
  await expect(page.locator('.phase-combat')).toBeVisible();
  await expect(page.locator('.core-hud')).toHaveCount(0);
  await expect(page.locator('.core-choice-panel')).toHaveCount(0);
});

for (const [index, id] of (['relay', 'siege', 'counter'] as const).entries()) {
  test(`${id}: core selection preserves ordinary rewards and takes effect in Battle 2`, async ({
    page,
  }) => {
    await page.goto('/?debug&corePreview=choice');
    const dialog = page.getByRole('dialog', {
      name: 'この遠征の戦い方を決めよう',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('この後に通常の戦利品');
    const clock = await page.locator('.debug-panel').textContent();
    await page.waitForTimeout(200);
    expect(await page.locator('.debug-panel').textContent()).toBe(clock);
    await page.keyboard.press(String(index + 1));
    await expect(dialog).not.toBeVisible();
    const reward = page.locator('.reward-panel');
    await expect(reward).toBeVisible();
    await expect(reward.locator('.reward-card')).toHaveCount(3);
    await expect(reward).toContainText(`改造コア：${names[id]}`);
    expect(await page.locator('.debug-panel').textContent()).toBe(clock);
    await reward.locator('.reward-module button').first().click();
    await expect(page.locator('.run-hud')).toContainText('第2戦');
    await expect(page.locator('.core-hud')).toContainText(names[id]);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('region', { name: '改造コアの使い方' }),
    ).toContainText(names[id]);
  });
}

test('core dialog traps background focus, ignores Escape, and supports arrows plus native Enter', async ({
  page,
}) => {
  await page.goto('/?debug&corePreview=choice');
  const dialog = page.locator('.core-choice-panel');
  const first = page.locator('[data-core="relay"]');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page
    .locator('.audio-toggle')
    .evaluate((element) => (element as HTMLElement).focus());
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-core="siege"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-core="counter"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('[data-core="counter"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('[data-core="siege"]')).toBeFocused();
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.reward-panel')).toContainText(
    '改造コア：展開砲座',
  );
});

test('relay arms the opposite weapon on real fire and both held cancels it', async ({
  page,
}) => {
  await page.goto('/?debug&corePreview=relay');
  const hud = page.locator('.core-hud');
  await expect(hud).toContainText('片方ずつ');
  await page.keyboard.down('Space');
  await expect(hud).toContainText('次は副武器');
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyC');
  await expect(hud).toContainText('次は主武器');
  await page.keyboard.down('Space');
  await expect(hud).toContainText('片方ずつ');
  await page.keyboard.up('KeyC');
  await page.keyboard.up('Space');
});

test('siege deploys, movement cancels it, and partial deployment freezes during pause and blur', async ({
  page,
}) => {
  await page.goto('/?debug&corePreview=siege');
  const hud = page.locator('.core-hud');
  // Initial HUD markup can render before the effect connects keyboard input.
  // A positive combat tick proves the live loop has started before KeyF goes down.
  await expect
    .poll(async () => {
      const text = await page.locator('.debug-panel').textContent();
      return Number(text?.match(/^tick (\d+)/)?.[1]);
    })
    .toBeGreaterThan(0);
  // The fixture must commit world-time before its stationary 1.5s deployment
  // can complete under ACTION TIME. Parry keeps the vehicle in place.
  await page.keyboard.down('KeyF');
  await expect(hud).toContainText('展開中');
  await page.keyboard.up('KeyF');
  await page.keyboard.down('KeyD');
  await expect(hud).not.toContainText('展開中');
  await page.keyboard.up('KeyD');
  const progress = hud.locator('progress');
  await expect
    .poll(async () => Number(await progress.getAttribute('value')))
    .toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  const frozen = await progress.getAttribute('value');
  expect(Number(frozen)).toBeLessThan(1.5);
  await page.waitForTimeout(350);
  expect(await progress.getAttribute('value')).toBe(frozen);
  await page.keyboard.press('Escape');
  // Stationary deployment now needs an explicit combat commitment to give the
  // world full-speed time; parry keeps the vehicle in place.
  await page.keyboard.down('KeyF');
  await expect(hud).toContainText('展開中');
  await page.keyboard.up('KeyF');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.pause-menu')).toBeVisible();
  const blurred = await progress.getAttribute('value');
  await page.waitForTimeout(200);
  expect(await progress.getAttribute('value')).toBe(blurred);
  await page.getByRole('button', { name: '戦闘を再開' }).click();
  await expect(hud).toContainText('展開中');
});

test('counter parries a real incoming projectile and consumes one empowered volley', async ({
  page,
}) => {
  await page.goto('/?debug&corePreview=counter');
  const hud = page.locator('.core-hud');
  await expect(hud).toContainText('パリィ成功');
  // ACTION TIME ties projectile travel to player commitment. Keep firing while
  // the fixture approaches so tick 110 still represents roughly 1.8s of world
  // time, then parry once it reaches the original timing window.
  await page.keyboard.down('Space');
  await expect
    .poll(
      async () => {
        const text = await page.locator('.debug-panel').textContent();
        return Number(text?.match(/tick (\d+)/)?.[1]);
      },
      { intervals: [20] },
    )
    .toBeGreaterThanOrEqual(110);
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyF');
  await expect(hud).toContainText('反攻弾 ×2.5');
  await page.keyboard.up('KeyF');
  await page.keyboard.down('KeyC');
  await expect(hud).toContainText('パリィ成功');
  await page.keyboard.up('KeyC');
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test.describe(`core layout ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });
    test('can read and tap the third core, then keeps its combat HUD out of the controls', async ({
      page,
    }) => {
      await page.goto('/?debug&corePreview=choice');
      const dialog = page.locator('.core-choice-panel');
      await expect(dialog).toBeVisible();
      const fits = await dialog.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth &&
          r.bottom <= innerHeight &&
          element.scrollWidth <= element.clientWidth
        );
      });
      expect(fits).toBe(true);
      await expect(page.locator('[data-core="counter"]')).toHaveCSS(
        'touch-action',
        'pan-y',
      );
      if (process.env.CAPTURE_UI_REVIEW)
        await page.screenshot({
          path: `test-results/core-choice-${viewport.width}x${viewport.height}.png`,
        });
      await page.locator('[data-core="counter"]').tap();
      await expect(page.locator('.reward-panel')).toContainText(
        '改造コア：反攻蓄電器',
      );
      if (process.env.CAPTURE_UI_REVIEW)
        await page.screenshot({
          path: `test-results/core-reward-${viewport.width}x${viewport.height}.png`,
        });
      await page.locator('.reward-module button').first().tap();
      await expect(page.locator('.core-hud')).toBeVisible();
      expect(
        await page.locator('.game-shell').evaluate((element) => ({
          top: element.scrollTop,
          left: element.scrollLeft,
        })),
      ).toEqual({ top: 0, left: 0 });
      const obstruction = await page
        .locator('.core-hud')
        .evaluate((element) => {
          const a = element.getBoundingClientRect();
          if (
            a.left < 0 ||
            a.top < 0 ||
            a.right > innerWidth ||
            a.bottom > innerHeight
          )
            return 'viewport';
          const selectors = [
            '.control-button',
            '.pause-toggle',
            '.compact-hud',
            '.run-hud',
            '.enemy-chip',
            '.treasure-chip',
            '.breakthrough-panel',
          ];
          for (const selector of selectors)
            for (const other of document.querySelectorAll(selector)) {
              const b = other.getBoundingClientRect();
              if (
                Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
                Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
              )
                return selector;
            }
          return null;
        });
      expect(obstruction).toBeNull();
      if (process.env.CAPTURE_UI_REVIEW)
        await page.screenshot({
          path: `test-results/core-combat-${viewport.width}x${viewport.height}.png`,
        });
      await page.getByRole('button', { name: '一時停止と操作ガイド' }).tap();
      await expect(
        page.getByRole('region', { name: '改造コアの使い方' }),
      ).toContainText('反攻蓄電器');
      const coreGuide = page.getByRole('region', { name: '改造コアの使い方' });
      const controlGuide = page.getByRole('region', { name: '操作ガイド' });
      const [coreBox, controlsBox] = await Promise.all([
        coreGuide.boundingBox(),
        controlGuide.boundingBox(),
      ]);
      expect(coreBox).not.toBeNull();
      expect(controlsBox).not.toBeNull();
      expect(coreBox!.y).toBeGreaterThanOrEqual(
        controlsBox!.y + controlsBox!.height,
      );
      if (process.env.CAPTURE_UI_REVIEW)
        await page.screenshot({
          path: `test-results/core-pause-${viewport.width}x${viewport.height}.png`,
        });
      await page.getByRole('button', { name: '戦闘を再開' }).tap();
      await expect(page.locator('.pause-menu')).not.toBeVisible();
    });
  });
}
