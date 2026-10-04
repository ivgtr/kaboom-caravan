import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function openRun(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/?seed=42');
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'ready',
  );
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-art-ready',
    'true',
  );
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function distance(page: Page) {
  return Number(await page.getByTestId('runner').getAttribute('data-distance'));
}

async function runTo(page: Page, metres: number) {
  for (let step = 0; step < 100 && (await distance(page)) < metres; step++) {
    await page.clock.runFor(100);
    await expect(page.getByTestId('runner')).toHaveAttribute(
      'data-status',
      'running',
    );
  }
  expect(await distance(page)).toBeGreaterThanOrEqual(metres);
}

test('starts a real run and held Space produces only one jump', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openRun(page);
  await expect(page.locator('canvas[aria-label="ゲーム画面"]')).toBeVisible();
  await capture(page, info, 'desktop-ready');
  await page.keyboard.down('Space');
  await page.clock.runFor(150);
  expect(await distance(page)).toBeGreaterThan(0);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '1');
  await capture(page, info, 'desktop-jump');
  for (let repeat = 0; repeat < 8; repeat++) {
    await page.keyboard.down('Space');
    await page.clock.runFor(100);
  }
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'running',
  );
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '1');
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await page.clock.runFor(100);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '2');
  expect(errors).toEqual([]);
});

test('pause and focus interruption freeze distance until explicit resume', async ({
  page,
}) => {
  await openRun(page);
  await page.getByRole('button', { name: 'スタート', exact: true }).click();
  await page.clock.runFor(250);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'paused',
  );
  const paused = await distance(page);
  await page.keyboard.press('Space');
  await page.clock.runFor(1500);
  expect(await distance(page)).toBe(paused);
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await page.clock.runFor(200);
  expect(await distance(page)).toBeGreaterThan(paused);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'paused',
  );
  const interrupted = await distance(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(1500);
  expect(await distance(page)).toBe(interrupted);
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await page.clock.runFor(200);
  expect(await distance(page)).toBeGreaterThan(interrupted);
});

test('collects equipment and clears the first gap through real jump input', async ({
  page,
}, info) => {
  await openRun(page);
  await page.getByRole('button', { name: 'スタート', exact: true }).click();
  await runTo(page, 42);
  await page.keyboard.press('Space');
  await runTo(page, 84);
  await expect(page.getByLabel('現在の装備')).toContainText('MACHINE');
  await page.keyboard.press('Space');
  await page.clock.runFor(400);
  expect(
    Number(await page.getByTestId('runner').getAttribute('data-y')),
  ).toBeGreaterThan(0);
  await capture(page, info, 'desktop-equipped-first-gap');
  await page.clock.runFor(500);
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'running',
  );
  await expect(page.getByTestId('runner')).toHaveAttribute('data-y', '0.0');
  expect(await distance(page)).toBeGreaterThan(98);
  // Real input traverses the two-step crest, a walk-off and a lower valley.
  await runTo(page, 154);
  await page.keyboard.press('Space');
  await page.clock.runFor(350);
  await capture(page, info, 'desktop-vertical-climb');
  await runTo(page, 187);
  await page.keyboard.press('Space');
  await page.clock.runFor(350);
  expect(
    Number(await page.getByTestId('runner').getAttribute('data-y')),
  ).toBeGreaterThan(128);
  await capture(page, info, 'desktop-high-crest');
  await page.clock.runFor(400);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-y', '128.0');
  await runTo(page, 275);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-y', '64.0');
  await runTo(page, 288);
  await page.keyboard.press('Space');
  await runTo(page, 313);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-y', '0.0');
  await runTo(page, 340);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-y', '-48.0');
  await capture(page, info, 'desktop-lower-valley');
});

test('a natural collision ends the run and restart resets distance', async ({
  page,
}, info) => {
  await openRun(page);
  await page.getByRole('button', { name: 'スタート', exact: true }).click();
  for (let second = 0; second < 30; second++) {
    await page.clock.runFor(1000);
    if (
      (await page.getByTestId('runner').getAttribute('data-status')) === 'over'
    )
      break;
  }
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'over',
  );
  const finalDistance = await distance(page);
  expect(finalDistance).toBeGreaterThan(0);
  await capture(page, info, 'desktop-game-over');
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'running',
  );
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '0');
  await page.clock.runFor(150);
  expect(await distance(page)).toBeGreaterThan(0);
  expect(await distance(page)).toBeLessThan(finalDistance);
});

for (const viewport of [
  { width: 390, height: 844, name: 'portrait' },
  { width: 844, height: 390, name: 'landscape' },
]) {
  test.describe(`touch ${viewport.name}`, () => {
    test.use({ viewport, hasTouch: true });
    test('touch jump works and the playable view fits', async ({
      page,
    }, info) => {
      await openRun(page);
      await page.getByRole('button', { name: 'スタート', exact: true }).tap();
      await page.clock.runFor(850);
      await page.getByRole('button', { name: 'ジャンプ', exact: true }).tap();
      await page.clock.runFor(150);
      await expect(page.getByTestId('runner')).toHaveAttribute(
        'data-jumps',
        '2',
      );
      const canvas = await page
        .locator('canvas[aria-label="ゲーム画面"]')
        .boundingBox();
      expect(canvas).not.toBeNull();
      expect(canvas!.x).toBeGreaterThanOrEqual(0);
      expect(canvas!.y).toBeGreaterThanOrEqual(0);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      for (const name of ['ジャンプ', '一時停止', /^サウンド/]) {
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      }
      await capture(page, info, `touch-${viewport.name}-jump`);
      await runTo(page, 84);
      await page.getByRole('button', { name: 'ジャンプ', exact: true }).tap();
      await runTo(page, 154);
      await page.getByRole('button', { name: 'ジャンプ', exact: true }).tap();
      await page.clock.runFor(350);
      await capture(page, info, `touch-${viewport.name}-vertical-climb`);
      await runTo(page, 187);
      await page.getByRole('button', { name: 'ジャンプ', exact: true }).tap();
      await page.clock.runFor(350);
      expect(
        Number(await page.getByTestId('runner').getAttribute('data-y')),
      ).toBeGreaterThan(128);
      await page.clock.runFor(400);
      await expect(page.getByTestId('runner')).toHaveAttribute(
        'data-y',
        '128.0',
      );
    });
  });
}
