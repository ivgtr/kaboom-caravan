import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function openRun(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/?seed=42');
  await expect(
    page.getByRole('dialog', { name: '軍団の改造を選ぶ' }),
  ).toBeVisible();
  // Do not compare the runner's wall clock with the browser's advancing clock.
  // The draft does not simulate combat, so a fixed future target is safe.
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
}
async function chooseSwarm(page: Page) {
  await page.locator('.relic-swarm').click();
  await page.clock.runFor(100);
  await expect(page.getByTestId('siege-game')).toHaveAttribute(
    'data-phase',
    'combat',
  );
}
async function capture(page: Page, info: TestInfo, name: string) {
  if (process.env.CAPTURE_UI_REVIEW === '1') {
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
  }
}

test('the default is army siege: draft, real art, atomic deployment, no shooter controls', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openRun(page);
  await expect(page.locator('.relic-swarm')).toBeFocused();
  await expect(page.getByTestId('siege-game')).toHaveAttribute(
    'data-tick',
    '0',
  );
  await expect(page.locator('.weapon-controls')).toHaveCount(0);
  await capture(page, info, 'desktop-draft');
  await chooseSwarm(page);
  await page.keyboard.down('Digit1');
  await page.keyboard.down('Digit1');
  await page.keyboard.up('Digit1');
  await page.clock.runFor(200);
  await expect(page.locator('.siege-actor.ally')).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: 'バリケードを出撃' }),
  ).toBeDisabled();
  await page.clock.runFor(1000);
  await expect(page.locator('.siege-actor.ally')).toHaveCount(3);
  const broken = await page
    .locator('.siege-shell img')
    .evaluateAll(
      (images) =>
        images.filter(
          (image) =>
            !(image instanceof HTMLImageElement) ||
            !image.complete ||
            image.naturalWidth === 0,
        ).length,
    );
  expect(broken).toBe(0);
  expect(errors).toEqual([]);
  await capture(page, info, 'desktop-battle');
});

test('investment, pause, blur and input cancellation freeze the actual clock and wallet', async ({
  page,
}) => {
  await openRun(page);
  await chooseSwarm(page);
  await page.keyboard.press('KeyQ');
  await page.clock.runFor(100);
  await expect(page.getByRole('button', { name: '補給に増資' })).toContainText(
    'Lv.2',
  );
  await page.getByRole('button', { name: '音をオフ' }).click();
  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: '一時停止中' });
  await expect(dialog).toBeVisible();
  const tick = await page.getByTestId('siege-game').getAttribute('data-tick');
  const gold = await page.getByTestId('siege-gold').textContent();
  await page.keyboard.press('Digit1');
  await page.clock.runFor(5000);
  expect(await page.getByTestId('siege-game').getAttribute('data-tick')).toBe(
    tick,
  );
  expect(await page.getByTestId('siege-gold').textContent()).toBe(gold);
  await dialog.getByRole('button', { name: '戦闘を再開' }).click();
  await page.clock.runFor(300);
  await expect(page.locator('.siege-actor.ally')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '音をオン' })).toBeVisible();
  expect(
    await page.getByTestId('siege-game').getAttribute('data-tick'),
  ).not.toBe(tick);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(dialog).toBeVisible();
});

for (const viewport of [
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test.describe(`siege touch ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });
    test('all controls fit, taps deploy, rotation pauses until explicit resume', async ({
      page,
    }, info) => {
      await openRun(page);
      await capture(page, info, 'touch-draft');
      await page.locator('.relic-swarm').tap();
      await page.clock.runFor(100);
      await page.getByRole('button', { name: 'バリケードを出撃' }).tap();
      await page.clock.runFor(100);
      await expect(page.locator('.siege-actor.ally')).toHaveCount(3);
      const boxes = await page
        .locator('.siege-dock button,.siege-system button')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().toJSON()),
        );
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height);
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(28);
      }
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const left = boxes[a]!;
          const right = boxes[b]!;
          const area =
            Math.max(
              0,
              Math.min(left.right, right.right) -
                Math.max(left.left, right.left),
            ) *
            Math.max(
              0,
              Math.min(left.bottom, right.bottom) -
                Math.max(left.top, right.top),
            );
          expect(area).toBeLessThan(1);
        }
      await capture(page, info, 'touch-battle');
      await page.setViewportSize({
        width: viewport.height,
        height: viewport.width,
      });
      await expect(
        page.getByRole('dialog', { name: '横向きでプレイ' }),
      ).toBeVisible();
      const tick = await page
        .getByTestId('siege-game')
        .getAttribute('data-tick');
      await page.clock.runFor(1000);
      expect(
        await page.getByTestId('siege-game').getAttribute('data-tick'),
      ).toBe(tick);
      await page.setViewportSize(viewport);
      const pause = page.getByRole('dialog', { name: '一時停止中' });
      await expect(pause).toBeVisible();
      await page.clock.runFor(1000);
      expect(
        await page.getByTestId('siege-game').getAttribute('data-tick'),
      ).toBe(tick);
      await capture(page, info, 'touch-pause');
      await pause.getByRole('button', { name: '戦闘を再開' }).tap();
      await page.clock.runFor(200);
      expect(
        await page.getByTestId('siege-game').getAttribute('data-tick'),
      ).not.toBe(tick);
    });
  });
}

test('a real first battle reaches its reward and starts the next fort; no debug state injection', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await openRun(page);
  await chooseSwarm(page);
  await page.keyboard.press('KeyQ');
  await page.clock.runFor(100);
  let captured = false;
  for (let i = 0; i < 500; i++) {
    if (
      (await page.getByTestId('siege-game').getAttribute('data-phase')) !==
      'combat'
    )
      break;
    const counts = await page
      .locator('.siege-actor.ally')
      .evaluateAll((actors) =>
        ['wall', 'buggy', 'mortar', 'titan'].map(
          (kind) =>
            actors.filter((actor) => actor.classList.contains(`kind-${kind}`))
              .length,
        ),
      );
    const cannon = page.getByRole('button', { name: '母艦砲を発射' });
    const commander = page.locator('.siege-actor.kind-commander');
    if ((await commander.count()) && !captured) {
      await capture(page, info, 'counterattack');
      captured = true;
    }
    if (
      (await cannon.isEnabled()) &&
      ((await page.locator('.kind-commander.is-winding').count()) ||
        (await page.locator('.siege-actor.enemy').count()) >= 5)
    )
      await cannon.click();
    const desired =
      counts[0]! < 3
        ? 'バリケード'
        : counts[2]! < 2
          ? 'ドカン砲車'
          : counts[1]! < 2
            ? 'ラッシュバギー'
            : '鉄くずタイタン';
    const button = page.getByRole('button', { name: `${desired}を出撃` });
    if (await button.isEnabled()) await button.click();
    await page.clock.runFor(200);
  }
  const reward = page.getByRole('dialog', { name: '勝利報酬の改造を選ぶ' });
  await expect(reward).toBeVisible();
  await capture(page, info, 'victory-draft');
  const tick = await page.getByTestId('siege-game').getAttribute('data-tick');
  await page.clock.runFor(2000);
  expect(await page.getByTestId('siege-game').getAttribute('data-tick')).toBe(
    tick,
  );
  await reward.locator('.siege-relic').first().click();
  await page.clock.runFor(100);
  await expect(page.getByTestId('siege-game')).toHaveAttribute(
    'data-phase',
    'combat',
  );
  await expect(page.locator('.siege-build-strip > span')).toHaveCount(2);
  await expect(page.locator('.siege-stage-title')).toContainText('FORT 02');
  await expect(page.locator('.siege-actor.ally')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '補給に増資' })).toContainText(
    'Lv.1',
  );
});

test('idle defeat, same-seed retry and reduced-motion retain correct phase and input', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRun(page);
  await chooseSwarm(page);
  await page.clock.runFor(60_000);
  const result = page.getByRole('dialog', { name: '母艦陥落' });
  await expect(result).toBeVisible();
  await expect(result).toContainText('SEED 42');
  await capture(page, info, 'defeat');
  await result.getByRole('button', { name: '同じSEEDで再挑戦' }).click();
  await expect(
    page.getByRole('dialog', { name: '軍団の改造を選ぶ' }),
  ).toBeVisible();
  await expect(page.getByTestId('siege-game')).toHaveAttribute(
    'data-tick',
    '0',
  );
  await chooseSwarm(page);
  await page.keyboard.press('Digit1');
  await page.clock.runFor(200);
  await expect(page.locator('.siege-actor.ally')).toHaveCount(3);
  expect(
    await page
      .locator('.siege-unit-body')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});
