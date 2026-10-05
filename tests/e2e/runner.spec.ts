import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { buildReplay } from '../runner-replay';

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
async function number(page: Page, field: string) {
  return Number(await page.getByTestId('runner').getAttribute(`data-${field}`));
}

test('tap, hold and one recovery have distinct responsive results', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openRun(page);
  await capture(page, info, 'desktop-ready');
  await page.keyboard.press('Space');
  await page.clock.runFor(160);
  const tapHeight = await number(page, 'y');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.getByRole('button', { name: '最初から', exact: true }).click();
  await page.keyboard.down('Space');
  await page.clock.runFor(160);
  expect(await number(page, 'y')).toBeGreaterThan(tapHeight + 35);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '1');
  await capture(page, info, 'desktop-held-jump');
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await page.clock.runFor(80);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '2');
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-air-hops',
    '0',
  );
  await page.keyboard.down('Space');
  await page.clock.runFor(80);
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '2');
  await page.keyboard.up('Space');
  await capture(page, info, 'desktop-air-recovery');
  expect(errors).toEqual([]);
});

test('pause, pointer release outside and focus loss clear hold and require explicit resume', async ({
  page,
}) => {
  await openRun(page);
  await page.getByRole('button', { name: 'スタート', exact: true }).click();
  await page.keyboard.down('Space');
  await page.clock.runFor(120);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const runner = page.getByTestId('runner');
  await expect(runner).toHaveAttribute('data-status', 'paused');
  await expect(runner).toHaveAttribute('data-holding', 'false');
  const paused = await number(page, 'world-x');
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await page.clock.runFor(1500);
  expect(await number(page, 'world-x')).toBe(paused);
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await page.clock.runFor(150);
  expect(await number(page, 'world-x')).toBeGreaterThan(paused);
  const jump = await page
    .getByRole('button', { name: 'ジャンプ', exact: true })
    .boundingBox();
  await page.mouse.move(jump!.x + jump!.width / 2, jump!.y + jump!.height / 2);
  await page.mouse.down();
  await expect(runner).toHaveAttribute('data-holding', 'true');
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await page.clock.runFor(80);
  await expect(runner).toHaveAttribute('data-holding', 'false');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.clock.runFor(1000);
  await expect(runner).toHaveAttribute('data-status', 'paused');
});

test('starter gun pays off before first gap; death explains missed input and retry is immediate', async ({
  page,
}, info) => {
  await openRun(page);
  await page.getByRole('button', { name: 'スタート', exact: true }).click();
  await page.clock.runFor(1200);
  await expect(page.getByLabel('現在の装備')).toContainText('連射');
  expect(await number(page, 'defeated')).toBeGreaterThan(0);
  await capture(page, info, 'desktop-first-payoff');
  await page.clock.runFor(1500);
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'over',
  );
  await expect(page.locator('.runner-cause')).toContainText('ジャンプせず');
  await capture(page, info, 'desktop-death-context');
  const finalDistance = await number(page, 'distance');
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'running',
  );
  await expect(page.getByTestId('runner')).toHaveAttribute('data-jumps', '0');
  await page.clock.runFor(100);
  expect(await number(page, 'distance')).toBeLessThan(finalDistance);
});

/** The browser receives only physical input and elapsed time, never game-state edits. */
async function replay(
  page: Page,
  info: TestInfo,
  name: string,
  seconds: number,
  touch = false,
) {
  const plan = buildReplay(42, seconds);
  expect(
    plan.state.status,
    `Replay model stopped at ${plan.state.distance}: ${plan.state.deathFeedback}`,
  ).toBe('running');
  const session = touch ? await page.context().newCDPSession(page) : null;
  const jump = await page
    .getByRole('button', { name: 'スタート', exact: true })
    .boundingBox();
  expect(jump).not.toBeNull();
  if (touch)
    await page.getByRole('button', { name: 'スタート', exact: true }).tap();
  else
    await page.getByRole('button', { name: 'スタート', exact: true }).click();
  const button = await page
    .getByRole('button', { name: 'ジャンプ', exact: true })
    .boundingBox();
  const point = {
    x: button!.x + button!.width / 2,
    y: button!.y + button!.height / 2,
  };
  const checkpoints = (
    seconds > 60 ? [2.8, 7.6, 15, 35, 58, 74] : [2.8, 7.6, 15, 30]
  ).filter((t) => t < seconds);
  const events = [
    ...plan.inputs.map((input) => ({
      at: Math.round(input.time * 1000),
      action: input.action,
      checkpoint: 0,
    })),
    ...checkpoints.map((at) => ({
      at: Math.round(at * 1000),
      action: '' as const,
      checkpoint: at,
    })),
  ].sort((a, b) => a.at - b.at);
  let time = 0;
  let held = false;
  for (const event of events) {
    await page.clock.runFor(event.at - time);
    time = event.at;
    if (event.action) {
      held = event.action === 'press';
      if (session)
        await session.send('Input.dispatchTouchEvent', {
          type: event.action === 'press' ? 'touchStart' : 'touchEnd',
          touchPoints: event.action === 'press' ? [point] : [],
        });
      else if (event.action === 'press') await page.keyboard.down('Space');
      else await page.keyboard.up('Space');
    }
    if (event.checkpoint) {
      await expect(page.getByTestId('runner')).toHaveAttribute(
        'data-status',
        'running',
      );
      await capture(page, info, `${name}-${event.checkpoint}s`);
    }
  }
  await page.clock.runFor(seconds * 1000 - time);
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'running',
  );
  expect(
    Math.abs((await number(page, 'world-x')) - plan.state.distance),
  ).toBeLessThan(45);
  expect(await number(page, 'run-level')).toBeGreaterThan(1);
  expect(await number(page, 'defeated')).toBeGreaterThan(0);
  if (session && held)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  else await page.keyboard.up('Space');
  await session?.detach();
}

test('real keyboard replay crosses hills, gear encounters and late capped-speed accents', async ({
  page,
}, info) => {
  test.setTimeout(150000);
  await openRun(page);
  await replay(page, info, 'desktop-course', 75);
  expect(await number(page, 'world-x')).toBeGreaterThan(22000);
});

for (const viewport of [
  { width: 390, height: 844, name: 'portrait' },
  { width: 568, height: 320, name: 'landscape' },
]) {
  test.describe(`touch ${viewport.name}`, () => {
    test.use({ viewport, hasTouch: true });
    test('press, hold, release and cancellation work while the full play area fits', async ({
      page,
    }, info) => {
      test.setTimeout(120000);
      await openRun(page);
      await replay(page, info, `touch-${viewport.name}`, 32, true);
      const runner = page.getByTestId('runner');
      await page.getByRole('button', { name: '一時停止', exact: true }).tap();
      await page.getByRole('button', { name: '最初から', exact: true }).tap();
      const session = await page.context().newCDPSession(page);
      const button = await page
        .getByRole('button', { name: 'ジャンプ', exact: true })
        .boundingBox();
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          {
            x: button!.x + button!.width / 2,
            y: button!.y + button!.height / 2,
          },
        ],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: [],
      });
      await page.clock.runFor(80);
      await expect(runner).toHaveAttribute('data-holding', 'false');
      await session.detach();
      await page.getByRole('button', { name: '一時停止', exact: true }).tap();
      const paused = await number(page, 'world-x');
      await page.clock.runFor(1000);
      expect(await number(page, 'world-x')).toBe(paused);
      await page.getByRole('button', { name: '再開', exact: true }).tap();
      await page.clock.runFor(80);
      await expect(runner).toHaveAttribute('data-status', 'running');
      const canvas = await page.locator('canvas').boundingBox();
      expect(canvas!.x).toBeGreaterThanOrEqual(0);
      expect(canvas!.y).toBeGreaterThanOrEqual(0);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      for (const name of ['ジャンプ', '一時停止', /^サウンド/]) {
        const box = await page
          .getByRole('button', { name, exact: true })
          .boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      }
      await capture(page, info, `touch-${viewport.name}-controls`);
    });
  });
}
