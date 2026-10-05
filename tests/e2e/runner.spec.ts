import { mkdir, writeFile, rename } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { buildReplay } from '../runner-replay';

async function openRun(page: Page, seed = 42) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto(`/?seed=${seed}`);
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
  await page.clock.runFor(90);
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

test('early chest grows score; jackpot freezes the world, then resumes a queued tap and preserves score record', async ({
  page,
}, info) => {
  await openRun(page, 1);
  const runner = page.getByTestId('runner');
  await page.getByRole('button', { name: 'スタート', exact: true }).click();
  await page.clock.runFor(1880);
  expect(await number(page, 'chests')).toBe(1);
  expect(await number(page, 'freeze')).toBeGreaterThan(0.4);
  const frozenX = await number(page, 'world-x');
  await capture(page, info, 'desktop-jackpot-freeze');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.clock.runFor(180);
  expect(await number(page, 'world-x')).toBe(frozenX);
  await expect(runner).toHaveAttribute('data-holding', 'false');
  await page.clock.runFor(650);
  expect(await number(page, 'freeze')).toBe(0);
  expect(await number(page, 'world-x')).toBeGreaterThan(frozenX);
  expect(await number(page, 'jumps')).toBe(1);
  expect(await number(page, 'score')).toBeGreaterThan(100);
  await capture(page, info, 'desktop-jackpot-release');
  await page.clock.runFor(5000);
  await expect(runner).toHaveAttribute('data-status', 'over');
  await expect(page.getByLabel('ラン結果')).toContainText('最大CHAIN');
  const finalScore = await number(page, 'score');
  expect(
    await page.evaluate(() =>
      Number(localStorage.getItem('kaboom-score-fever-best-v1')),
    ),
  ).toBe(finalScore);
  await capture(page, info, 'desktop-score-result');
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await expect(runner).toHaveAttribute('data-status', 'running');
  await expect(runner).toHaveAttribute('data-jumps', '0');
  await expect(runner).toHaveAttribute('data-score', '0');
  await page.clock.runFor(1880);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const frozenClock = await number(page, 'fever-clock');
  const remaining = await number(page, 'freeze');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('Space');
  await page.clock.runFor(1000);
  expect(await number(page, 'fever-clock')).toBe(frozenClock);
  expect(await number(page, 'freeze')).toBe(remaining);
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await page.clock.runFor(800);
  await expect(runner).toHaveAttribute('data-holding', 'false');
  await expect(runner).toHaveAttribute('data-jumps', '0');
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
  const checkpoints = [2.2, 2.8, 7.6, 15, 24, 32, 39].filter(
    (t) => t < seconds,
  );
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
      if (event.checkpoint === 32) {
        expect(await number(page, 'speed')).toBeGreaterThan(800);
        expect(await number(page, 'score')).toBeGreaterThan(10000);
        expect(await number(page, 'chests')).toBeGreaterThan(5);
      }
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

/** A separate wall-clock recording, with physical inputs and the real audio graph. */
async function captureNormalSpeed(page: Page, info: TestInfo) {
  const dir = info.outputPath('normal-speed');
  await mkdir(dir, { recursive: true });
  const context = await page
    .context()
    .browser()!
    .newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir, size: { width: 1280, height: 720 } },
    });
  const live = await context.newPage();
  const videoStarted = Date.now();
  await live.addInitScript(() => {
    const qa = window as unknown as {
      qaStream?: MediaStream;
      qaRecorder?: MediaRecorder;
      qaChunks?: Blob[];
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (
      ...args: Parameters<AudioNode['connect']>
    ) {
      const result = Reflect.apply(connect, this, args);
      if (
        (args[0] as unknown) instanceof AudioDestinationNode &&
        this.context instanceof AudioContext
      ) {
        const destination = this.context.createMediaStreamDestination();
        Reflect.apply(connect, this, [destination]);
        qa.qaStream = destination.stream;
      }
      return result;
    } as AudioNode['connect'];
  });
  await live.goto(page.url());
  await expect(live.getByTestId('runner')).toHaveAttribute(
    'data-art-ready',
    'true',
  );
  await live.getByRole('button', { name: 'スタート', exact: true }).click();
  const start = Date.now();
  await live.evaluate(() => {
    const qa = window as unknown as {
      qaStream?: MediaStream;
      qaRecorder?: MediaRecorder;
      qaChunks?: Blob[];
    };
    if (!qa.qaStream) return;
    qa.qaChunks = [];
    qa.qaRecorder = new MediaRecorder(qa.qaStream);
    qa.qaRecorder.ondataavailable = (event) => qa.qaChunks!.push(event.data);
    qa.qaRecorder.start();
  });
  const audioDelayMs = Date.now() - videoStarted;
  const plan = buildReplay(42, 24);
  for (const input of plan.inputs) {
    const remaining = start + input.time * 1000 - Date.now();
    if (remaining > 0) await live.waitForTimeout(remaining);
    if (input.action === 'press') await live.keyboard.down('Space');
    else await live.keyboard.up('Space');
  }
  const remaining = start + 24000 - Date.now();
  if (remaining > 0) await live.waitForTimeout(remaining);
  await live.keyboard.up('Space');
  await capture(live, info, 'desktop-normal-speed-final');
  const status = await live.getByTestId('runner').getAttribute('data-status');
  const audio = await live.evaluate(async () => {
    const qa = window as unknown as {
      qaRecorder?: MediaRecorder;
      qaChunks?: Blob[];
    };
    if (!qa.qaRecorder) return null;
    await new Promise<void>((resolve) => {
      qa.qaRecorder!.onstop = () => resolve();
      qa.qaRecorder!.stop();
    });
    return Array.from(
      new Uint8Array(
        await new Blob(qa.qaChunks, { type: 'audio/webm' }).arrayBuffer(),
      ),
    );
  });
  if (audio)
    await writeFile(
      info.outputPath('normal-speed-audio.webm'),
      Buffer.from(audio),
    );
  await writeFile(
    info.outputPath('normal-speed-capture.json'),
    JSON.stringify(
      {
        seconds: 24,
        seed: 42,
        automatedPhysicalInput: true,
        audioDelayMs,
        finalStatus: status,
      },
      null,
      2,
    ),
  );
  const video = live.video()!;
  await context.close();
  await rename(
    await video.path(),
    info.outputPath('normal-speed-gameplay.webm'),
  );
}

test('real keyboard replay chains chests, inflation and high-speed landing destruction', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await openRun(page);
  await replay(page, info, 'desktop-course', 40);
  expect(await number(page, 'multiplier')).toBeGreaterThan(10);
  if (process.env.CAPTURE_UI_REVIEW) await captureNormalSpeed(page, info);
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
      test.setTimeout(180000);
      await openRun(page);
      await replay(page, info, `touch-${viewport.name}`, 40, true);
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
