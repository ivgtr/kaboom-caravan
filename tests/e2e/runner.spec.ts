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
  await capture(page, info, 'desktop-jackpot-power-cut');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.clock.runFor(180);
  expect(await number(page, 'world-x')).toBe(frozenX);
  await expect(runner).toHaveAttribute('data-cut', 'true');
  await expect(page.locator('.runner-score')).toHaveCSS('opacity', '0');
  expect(
    await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let brightest = 0;
      for (let i = 0; i < pixels.length; i += 4)
        brightest = Math.max(
          brightest,
          pixels[i]!,
          pixels[i + 1]!,
          pixels[i + 2]!,
        );
      return brightest;
    }),
  ).toBe(0);
  await capture(page, info, 'desktop-jackpot-black-hold');
  await expect(runner).toHaveAttribute('data-holding', 'false');
  await page.clock.runFor(650);
  expect(await number(page, 'freeze')).toBe(0);
  await expect(runner).toHaveAttribute('data-cut', 'false');
  expect(await number(page, 'world-x')).toBeGreaterThan(frozenX);
  expect(await number(page, 'jumps')).toBe(1);
  expect(await number(page, 'score')).toBeGreaterThan(100);
  await capture(page, info, 'desktop-jackpot-release');
  await page.clock.runFor(5000);
  await expect(runner).toHaveAttribute('data-status', 'over');
  await expect(page.getByLabel('ラン結果')).toContainText('最大CHAIN');
  const finalScore = await number(page, 'score');
  const parts = await page.locator('.runner-score-parts b').allTextContents();
  expect(
    parts.reduce((sum, value) => sum + Number(value.replaceAll(',', '')), 0),
  ).toBe(finalScore);
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
  const checkpoints = [2.2, 2.8, 7.6, 15, 24, 32, 39, 60, 80, 100, 119].filter(
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
        const expectedSpeed = buildReplay(42, 32).state.speed;
        expect(
          Math.abs((await number(page, 'speed')) - expectedSpeed),
        ).toBeLessThan(35);
        expect(await number(page, 'score')).toBeGreaterThan(10000);
        expect(await number(page, 'chests')).toBeGreaterThan(5);
      }
      if (event.checkpoint === 119) {
        expect(await number(page, 'speed')).toBeGreaterThan(1200);
        expect(await number(page, 'slot-kick')).toBeGreaterThan(100);
      }
      await capture(page, info, `${name}-${event.checkpoint}s`);
    }
  }
  await page.clock.runFor(seconds * 1000 - time);
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'running',
  );
  if (session && held)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  else await page.keyboard.up('Space');
  await session?.detach();
  // A physical pause publishes the exact endpoint. The running HUD is sampled
  // every60ms, and a FREEZE edge may publish an extra frame between samples.
  const pauseButton = page.getByRole('button', {
    name: '一時停止',
    exact: true,
  });
  if (touch) await pauseButton.tap();
  else await pauseButton.click();
  await expect(page.getByTestId('runner')).toHaveAttribute(
    'data-status',
    'paused',
  );
  expect(
    Math.abs((await number(page, 'world-x')) - plan.state.distance),
  ).toBeLessThan(45);
  expect(await number(page, 'run-level')).toBeGreaterThan(1);
  expect(await number(page, 'defeated')).toBeGreaterThan(0);
  const resumeButton = page.getByRole('button', { name: '再開', exact: true });
  if (touch) await resumeButton.tap();
  else await resumeButton.click();
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
  const video = live.video()!;
  try {
    await live.addInitScript(() => {
      const qa = window as unknown as {
        qaStream?: MediaStream;
        qaRecorder?: MediaRecorder;
        qaChunks?: Blob[];
        qaFrames?: { at: number; gap: number; cpu: number }[];
        qaDraws?: Record<string, { calls: number; ms: number }>;
      };
      // Wall-clock diagnostics belong to the existing recording, not the
      // deterministic clock replay. Keep these out of the shipped game loop.
      qa.qaFrames = [];
      qa.qaDraws = {};
      const raf = window.requestAnimationFrame.bind(window);
      let previous = 0;
      window.requestAnimationFrame = (callback) =>
        raf((now) => {
          const begin = performance.now();
          callback(now);
          const runner = document.querySelector('[data-testid="runner"]');
          if (runner?.getAttribute('data-status') === 'running')
            qa.qaFrames!.push({
              at: Number(runner.getAttribute('data-time')),
              gap: previous ? now - previous : 0,
              cpu: performance.now() - begin,
            });
          previous = now;
        });
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        if (!this.canvas.isConnected) return Reflect.apply(draw, this, args);
        const source = args[0] as HTMLCanvasElement | HTMLImageElement;
        const key = `${source.width}x${source.height}${this.shadowBlur ? ':shadow' : ''}`;
        const entry = (qa.qaDraws![key] ??= { calls: 0, ms: 0 });
        const begin = performance.now();
        const result = Reflect.apply(draw, this, args);
        entry.calls++;
        entry.ms += performance.now() - begin;
        return result;
      } as typeof draw;
      const connect = AudioNode.prototype.connect;
      const taps = new WeakMap<AudioContext, MediaStreamAudioDestinationNode>();
      AudioNode.prototype.connect = function (
        ...args: Parameters<AudioNode['connect']>
      ) {
        const result = Reflect.apply(connect, this, args);
        if (
          (args[0] as unknown) instanceof AudioDestinationNode &&
          this.context instanceof AudioContext
        ) {
          let destination = taps.get(this.context);
          if (!destination) {
            destination = this.context.createMediaStreamDestination();
            taps.set(this.context, destination);
          }
          Reflect.apply(connect, this, [destination]);
          qa.qaStream = destination.stream;
        }
        return result;
      } as AudioNode['connect'];
    });
    const runUrl = new URL(page.url());
    runUrl.searchParams.set('seed', '1'); // A naturally rolled first-chest jackpot, not a forced game state.
    await live.goto(runUrl.toString());
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
    const jumpButton = await live
      .getByRole('button', { name: 'ジャンプ', exact: true })
      .boundingBox();
    await live.mouse.move(
      jumpButton!.x + jumpButton!.width / 2,
      jumpButton!.y + jumpButton!.height / 2,
    );
    // Read the actual generated island: build-weighted future sections can differ
    // from an unplayed route. Controls remain ordinary physical pointer input.
    let held = false;
    let airborneSeen = false;
    let previousX = 0;
    let frozen = false;
    const freezeTransitions: { kind: string; at: number; worldX: number }[] =
      [];
    while (Date.now() - start < 110000) {
      const observed = await live.getByTestId('runner').evaluate((element) => ({
        status: element.getAttribute('data-status'),
        x: Number(element.getAttribute('data-world-x')),
        y: Number(element.getAttribute('data-y')),
        speed: Number(element.getAttribute('data-speed')),
        grounded: element.getAttribute('data-grounded') === 'true',
        freeze: Number(element.getAttribute('data-freeze')),
        roadEnd: Number(element.getAttribute('data-road-end')),
      }));
      if (observed.status !== 'running') break;
      expect(observed.x).toBeGreaterThanOrEqual(previousX);
      previousX = observed.x;
      if (observed.freeze > 0 !== frozen) {
        frozen = observed.freeze > 0;
        freezeTransitions.push({
          kind: frozen ? 'freeze' : 'release',
          at: (Date.now() - start) / 1000,
          worldX: observed.x,
        });
      }
      if (!observed.grounded) airborneSeen = true;
      if (
        observed.grounded &&
        observed.freeze <= 0 &&
        (!held || airborneSeen)
      ) {
        if (held) {
          await live.mouse.up();
          held = false;
        }
        if (
          observed.roadEnd > 0 &&
          observed.roadEnd - observed.x < observed.speed * 0.14
        ) {
          // A physical pointer at this position cannot trigger an accidental retry.
          await live.mouse.down();
          held = true;
          airborneSeen = false;
        }
      }
      await live.waitForTimeout(12);
    }
    const gameplaySeconds = (Date.now() - start) / 1000;
    // This is a demo capture, not a promise of a perfect run. Keep any death in
    // the evidence and stop; never restart or edit gameplay state to improve it.
    if (
      (await live.getByTestId('runner').getAttribute('data-status')) ===
      'running'
    )
      await live.keyboard.press('Escape');
    await live.mouse.up();
    const status = await live.getByTestId('runner').getAttribute('data-status');
    expect(['paused', 'over']).toContain(status);
    const finalX = await number(live, 'world-x');
    expect(finalX).toBeGreaterThanOrEqual(previousX);
    const failureReason =
      status === 'over'
        ? await live.locator('.runner-cause').textContent()
        : null;
    if (status === 'paused') {
      expect(
        await live.evaluate(() =>
          localStorage.getItem('kaboom-score-fever-best-v1'),
        ),
      ).toBeNull();
    }
    await capture(live, info, 'desktop-normal-speed-final');
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
          seconds: gameplaySeconds,
          targetSeconds: 110,
          seed: 1,
          freezeTransitions,
          automatedPhysicalInput: true,
          audioDelayMs,
          finalStatus: status,
          retries: 0,
          finalWorldX: finalX,
          finalScore: await number(live, 'score'),
          failureReason,
          performance: await live.evaluate(() => {
            const qa = window as unknown as {
              qaFrames: { at: number; gap: number; cpu: number }[];
              qaDraws: Record<string, { calls: number; ms: number }>;
            };
            const distribution = (values: number[]) => {
              const sorted = [...values].sort((a, b) => a - b);
              return {
                count: sorted.length,
                mean:
                  values.reduce((sum, value) => sum + value, 0) /
                  Math.max(1, values.length),
                p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
                p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
                max: sorted.at(-1) ?? 0,
              };
            };
            return {
              userAgent: navigator.userAgent,
              dpr: devicePixelRatio,
              viewport: [innerWidth, innerHeight],
              frameGapMs: distribution(qa.qaFrames.map((frame) => frame.gap)),
              callbackMs: distribution(qa.qaFrames.map((frame) => frame.cpu)),
              over33ms: qa.qaFrames.filter((frame) => frame.gap > 33.5).length,
              draws: qa.qaDraws,
            };
          }),
          endpoint:
            status === 'over'
              ? 'natural run end'
              : 'explicit pause at recording endpoint',
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
  }
  await rename(
    await video.path(),
    info.outputPath('normal-speed-gameplay.webm'),
  );
}

test('real keyboard replay chains chests, inflation and high-speed landing destruction', async ({
  page,
}, info) => {
  test.setTimeout(360000);
  // Observe real draws throughout the existing input-only replay. These are the
  // trimmed SLAM, explosion and exhaust assets, not replacement test sprites.
  await page.addInitScript(() => {
    const probe = { seen: {} as Record<string, number>, distortion: 0 };
    (window as unknown as { effectArtProbe: typeof probe }).effectArtProbe =
      probe;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    let worldTransform = new DOMMatrix();
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const image = args[0];
      if (this.canvas.isConnected) {
        const matrix = this.getTransform();
        // Remove the whole-scene FREEZE transform before measuring local art,
        // including exhaust rotated with the car on slopes or in midair.
        if (image instanceof HTMLImageElement) worldTransform = matrix;
        const local = worldTransform.inverse().multiply(matrix);
        const ratio =
          Math.hypot(local.a, local.b) / Math.hypot(local.c, local.d);
        if (image instanceof HTMLCanvasElement && args.length === 5) {
          const key = `${image.width}x${image.height}`;
          if (['351x307', '485x490', '347x210'].includes(key)) {
            probe.seen[key] = (probe.seen[key] ?? 0) + 1;
            probe.distortion = Math.max(
              probe.distortion,
              Math.abs(
                ((Number(args[3]) / Number(args[4])) * image.height * ratio) /
                  image.width -
                  1,
              ),
            );
          }
        }
      }
      return Reflect.apply(draw, this, args);
    } as typeof draw;
  });
  await openRun(page);
  await replay(page, info, 'desktop-course', 120);
  expect(await number(page, 'slot-kick')).toBeGreaterThan(60);
  expect(await number(page, 'boost')).toBe(20);
  expect(await number(page, 'multiplier')).toBeGreaterThan(10);
  const art = await page.evaluate(
    () =>
      (
        window as unknown as {
          effectArtProbe: { seen: Record<string, number>; distortion: number };
        }
      ).effectArtProbe,
  );
  expect(Object.keys(art.seen).sort()).toEqual(
    ['351x307', '485x490', '347x210'].sort(),
  );
  expect(art.distortion).toBeLessThan(0.001);

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
      await replay(page, info, `touch-${viewport.name}`, 120, true);
      expect(await number(page, 'slot-kick')).toBeGreaterThan(60);
      await expect(
        page.locator('.runner-module[data-awakened="true"]').first(),
      ).toBeVisible();
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
