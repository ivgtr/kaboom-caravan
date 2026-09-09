import { expect, test, type Page } from '@playwright/test';

async function waitForCombatInput(page: Page) {
  // Initial HUD markup can render before the effect connects keyboard input.
  await expect
    .poll(async () =>
      Number(
        (await page.locator('.debug-panel').textContent())?.match(
          /^tick (\d+)/,
        )?.[1],
      ),
    )
    .toBeGreaterThan(0);
}

async function enterZone(page: Page) {
  await waitForCombatInput(page);
  await page.keyboard.down('KeyD');
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole('progressbar', { name: '拠点の確保' })
          .getAttribute('value'),
      ),
    )
    .toBeGreaterThan(0);
  await page.keyboard.up('KeyD');
}

async function expectNoOverlap(page: Page, a: string, b: string) {
  const first = await page.locator(a).boundingBox();
  const second = await page.locator(b).boundingBox();
  expect(first, a).not.toBeNull();
  expect(second, b).not.toBeNull();
  if (!first || !second) return;
  const overlapX =
    Math.min(first.x + first.width, second.x + second.width) -
    Math.max(first.x, second.x);
  const overlapY =
    Math.min(first.y + first.height, second.y + second.height) -
    Math.max(first.y, second.y);
  expect(
    overlapX > 1 && overlapY > 1,
    `${a} overlaps ${b}: ${JSON.stringify({ first, second })}`,
  ).toBe(false);
}

test('ordinary starts do not gain a detour from a preview parameter', async ({
  page,
}) => {
  await page.goto('/?quickStart&objectivePreview=repair');
  await expect(page.locator('.phase-combat')).toBeVisible();
  await expect(page.locator('.objective-hud')).toHaveCount(0);
  await expect(page.locator('.run-hud')).toContainText('第1戦');
});

test('briefing compares four routes, shows real scouting and keeps focus inside', async ({
  page,
}) => {
  await page.goto('/?debug&routePreview');
  const dialog = page.getByRole('dialog', { name: '次に進む区画を選ぼう' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.route-choice')).toHaveCount(4);
  await expect(dialog).toContainText('第4戦');
  await expect(dialog).toContainText('ガレキガメ');
  await expect(dialog).toContainText('100 / 100');
  await expect(page.locator('[data-route="normal"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page
    .locator('.audio-toggle')
    .evaluate((element) => (element as HTMLElement).focus());
  await expect(page.locator('[data-route="normal"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-route="elite"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-route="repair"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-route="salvage"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-route="normal"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('[data-route="salvage"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.run-hud')).toContainText('第4戦');
  await expect(page.locator('.objective-hud')).toContainText('物資拠点');
  await expect(page.locator('.treasure-chip strong')).toHaveText('0');
});

test('final-battle briefing omits equipment detours but retains repair', async ({
  page,
}) => {
  await page.goto('/?debug&routePreview=boss');
  const dialog = page.locator('.route-briefing');
  await expect(dialog).toContainText('第10戦');
  await expect(dialog.locator('.route-choice')).toHaveCount(2);
  await expect(dialog.locator('[data-route="salvage"]')).toHaveCount(0);
  await dialog.locator('[data-route="repair"]').click();
  await expect(page.locator('.objective-hud')).toContainText('整備拠点');
  await expect(page.locator('.run-hud')).toContainText('第10戦');
});

test('real movement secures repair while siege deploys; reward is applied once', async ({
  page,
}) => {
  await page.goto('/?debug&objectivePreview=repair');
  await expect(page.locator('.compact-hud > b')).toHaveText('40');
  await enterZone(page);
  await expect(page.locator('.core-hud')).toContainText('展開中');
  await expect(page.locator('.objective-hud')).toHaveAttribute(
    'data-state',
    'secured',
  );
  await expect(page.locator('.compact-hud > b')).toHaveText('80');
  await page.waitForTimeout(300);
  await expect(page.locator('.compact-hud > b')).toHaveText('80');
});

test('salvage opens an actual three-choice cache, freezes combat, and resumes without duplicate reward', async ({
  page,
}) => {
  await page.goto('/?debug&objectivePreview=salvage');
  await enterZone(page);
  const cache = page.locator('.weapon-cache-panel');
  await expect(cache).toBeVisible();
  await expect(cache.locator('.reward-card')).toHaveCount(3);
  await expect(cache).toContainText('物資拠点：回収成功');
  const clock = await page.locator('.debug-panel').textContent();
  await page.waitForTimeout(250);
  expect(await page.locator('.debug-panel').textContent()).toBe(clock);
  await cache.locator('.reward-card button').first().click();
  const slotPicker = page.locator('.slot-picker');
  if (await slotPicker.isVisible())
    await slotPicker.getByRole('button', { name: /副武器 副 2/ }).click();
  await expect(page.locator('.phase-combat')).toBeVisible();
  await expect(page.locator('.objective-hud')).toHaveAttribute(
    'data-state',
    'secured',
  );
  await expect(page.locator('.treasure-chip strong')).toHaveText('2');
  await page.waitForTimeout(250);
  await expect(cache).not.toBeVisible();
  await expect(page.locator('.treasure-chip strong')).toHaveText('2');
});

test('active occupation and deadline freeze on manual pause and window blur', async ({
  page,
}) => {
  await page.goto('/?debug&objectivePreview=repair');
  await enterZone(page);
  await page.keyboard.press('Escape');
  const paused = page.getByRole('dialog', { name: '一時停止中' });
  await expect(paused).toBeVisible();
  await expect(
    paused.getByRole('region', { name: '寄り道の回収ルール' }),
  ).toContainText('18秒以内');
  const frozen = await page.locator('.objective-hud').textContent();
  const progress = await page
    .getByRole('progressbar', { name: '拠点の確保', includeHidden: true })
    .getAttribute('value');
  await page.waitForTimeout(350);
  expect(await page.locator('.objective-hud').textContent()).toBe(frozen);
  expect(
    await page
      .getByRole('progressbar', { name: '拠点の確保', includeHidden: true })
      .getAttribute('value'),
  ).toBe(progress);
  await paused.getByRole('button', { name: '戦闘を再開' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(paused).toBeVisible();
  const blurred = await page.locator('.objective-hud').textContent();
  await page.waitForTimeout(250);
  expect(await page.locator('.objective-hud').textContent()).toBe(blurred);
  await page.keyboard.press('Escape');
  await expect(page.locator('.objective-hud')).toHaveAttribute(
    'data-state',
    'secured',
  );
});

test('enemy presence blocks occupation and timeout does not end combat', async ({
  page,
}) => {
  await page.goto('/?debug&objectivePreview=contested');
  await expect(page.locator('.objective-hud')).toContainText('敵が範囲内');
  await waitForCombatInput(page);
  await page.keyboard.down('KeyD');
  await expect
    .poll(async () =>
      Number(
        (await page.locator('.debug-panel').textContent())?.match(
          /position ([\d.]+)/,
        )?.[1],
      ),
    )
    .toBeGreaterThan(58);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(250);
  await expect(
    page.getByRole('progressbar', { name: '拠点の確保' }),
  ).toHaveAttribute('value', '0');
  await page.goto('/?debug&objectivePreview=expired');
  await expect(page.locator('.objective-hud')).toHaveAttribute(
    'data-state',
    'lost',
  );
  await expect(page.locator('.phase-combat')).toBeVisible();
  await expect(page.locator('.treasure-chip strong')).toHaveText('0');
  await expect(page.locator('.compact-hud > b')).toHaveText('40');
});

for (const [width, height] of [
  [1280, 800],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
]) {
  test(`route scrolling, touch choice and objective/pause layout at ${width}x${height}`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: width!, height: height! },
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?debug&routePreview');
    const dialog = page.locator('.route-briefing');
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height! + 1);
    if (process.env.CAPTURE_UI_REVIEW === '1')
      await page.screenshot({
        path: testInfo.outputPath(`route-${width}x${height}.png`),
      });
    await page.keyboard.press('Shift+Tab');
    const salvage = page.locator('[data-route="salvage"]');
    await expect(salvage).toBeFocused();
    await expect(salvage).toBeInViewport();
    await salvage.tap();
    await expect(page.locator('.objective-hud')).toBeVisible();
    await page.goto('/?debug&objectivePreview=repair');
    await expect(page.locator('.core-hud')).toBeVisible();
    for (const selector of [
      '.core-hud',
      '.pause-toggle',
      '.compact-hud',
      '.treasure-chip',
      '.enemy-chip',
      '.movement-controls',
      '.weapon-controls',
      '.breakthrough-panel',
    ]) {
      await expectNoOverlap(page, '.objective-hud', selector);
    }
    const hud = await page.locator('.objective-hud').boundingBox();
    expect(hud!.x).toBeGreaterThanOrEqual(0);
    expect(hud!.x + hud!.width).toBeLessThanOrEqual(width! + 1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    if (process.env.CAPTURE_UI_REVIEW === '1')
      await page.screenshot({
        path: testInfo.outputPath(`objective-${width}x${height}.png`),
      });
    await page.getByRole('button', { name: '一時停止と操作ガイド' }).tap();
    const pause = page.locator('.pause-menu');
    await expect(pause).toBeVisible();
    await expect(
      pause.getByRole('region', { name: '寄り道の回収ルール' }),
    ).toBeVisible();
    await expectNoOverlap(page, '.pause-objective', '.pause-core');
    await expectNoOverlap(page, '.pause-objective', '.pause-controls');
    if (process.env.CAPTURE_UI_REVIEW === '1')
      await page.screenshot({
        path: testInfo.outputPath(`objective-pause-${width}x${height}.png`),
      });
    await pause.getByRole('button', { name: '戦闘を再開' }).tap();
    await expect(pause).not.toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}
