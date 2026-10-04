import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  createRunner,
  generateTerrain,
  JUMP_AIRTIME,
  PLAYER_HALF_HITBOX,
  requestJump,
  startRunner,
  stepRunner,
} from '../../src/runner/simulation';
import {
  platformSlope,
  platformTopAt,
  platformsJoin,
} from '../../src/runner/terrain';
import {
  FIXED_DT,
  type Platform,
  type RunnerState,
} from '../../src/runner/types';

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

interface Checkpoint {
  name: string;
  x: number;
  surface?: Platform;
  apex?: number;
}
interface ReplayEvent {
  at: number;
  x: number;
  jumps: number;
  checkpoint?: Checkpoint;
}

/**
 * A deterministic, input-only heuristic replay, not a human-feel playtest.
 * The model is local to the test process. The page gets only real keyboard/touch
 * presses and elapsed animation frames; no position, gear or invulnerability edits.
 */
function planRoute(late: boolean): ReplayEvent[] {
  const preview = createRunner(42);
  generateTerrain(preview, 26000);
  const roads = preview.platforms;
  const firstRise = roads.find((road) => platformSlope(road) > 0)!;
  const crest = roads.find((road) => road.top === 128 && !platformSlope(road))!;
  const descent = roads.find(
    (road) => road.top === 128 && platformSlope(road) < 0,
  )!;
  const chainAt = (minimum: number) =>
    roads.findIndex(
      (road, index) =>
        road.x >= minimum && road.width <= 40 && roads[index - 1]!.width > 40,
    );
  const firstChain = chainAt(0);
  const lateChain = chainAt(18000);
  const checkpoints: Checkpoint[] = [
    { name: 'equipped-first-gap', x: 1100, surface: roads[1] },
    {
      name: 'slope-ascent',
      x: firstRise.x + firstRise.width * 0.6,
      surface: firstRise,
    },
    { name: 'crest-apex', x: crest.x + crest.width / 2, apex: crest.top },
    {
      name: 'slope-descent',
      x: descent.x + descent.width / 2,
      surface: descent,
    },
    {
      name: 'tiny-chain',
      x: (roads[firstChain]!.x + roads[firstChain + 1]!.x) / 2,
    },
    {
      name: 'chain-exit',
      x: roads[firstChain + 3]!.x + 280,
      surface: roads[firstChain + 3],
    },
  ];
  if (late) {
    const lateCrest = roads.find(
      (road) => road.x > 16000 && road.top === 128 && !platformSlope(road),
    )!;
    const lateDescent = roads.find(
      (road) =>
        road.x > lateCrest.x && road.top === 128 && platformSlope(road) < 0,
    )!;
    checkpoints.push(
      {
        name: 'late-crest-apex',
        x: lateCrest.x + lateCrest.width / 2,
        apex: lateCrest.top,
      },
      {
        name: 'late-slope-descent',
        x: lateDescent.x + lateDescent.width / 2,
        surface: lateDescent,
      },
      {
        name: 'late-tiny-chain',
        x: (roads[lateChain]!.x + roads[lateChain + 1]!.x) / 2,
      },
      {
        name: 'late-chain-exit',
        x: roads[lateChain + 3]!.x + 280,
        surface: roads[lateChain + 3],
      },
    );
  }
  const state = createRunner(42);
  startRunner(state);
  requestJump(state); // The start button also performs the first jump.
  const events: ReplayEvent[] = [];
  let accumulator = 0;
  let at = 0;
  let starterGear = false;
  const crestJumps = new Set<number>();
  const record = (checkpoint?: Checkpoint) =>
    events.push({ at, x: state.distance, jumps: state.jumps, checkpoint });
  while (checkpoints.length && at < 120000) {
    if (needsPress(state)) {
      requestJump(state);
      record();
    }
    while (checkpoints[0] && state.distance >= checkpoints[0].x)
      record(checkpoints.shift());
    accumulator += 0.016; // Playwright's clock schedules animation frames every 16ms.
    while (accumulator >= FIXED_DT) {
      stepRunner(state, FIXED_DT);
      accumulator -= FIXED_DT;
    }
    at += 16;
    expect(
      state.status,
      `Input route stopped at ${state.distance}: ${state.reason}`,
    ).toBe('running');
  }
  expect(checkpoints).toEqual([]);
  return events;

  function needsPress(run: RunnerState): boolean {
    if (!run.player.grounded) {
      return (
        run.player.vy < 0 &&
        !run.player.buffer &&
        run.platforms.some(
          (road) =>
            road.width <= 40 &&
            run.player.y >= road.top &&
            run.player.y - road.top < 22 &&
            run.distance + PLAYER_HALF_HITBOX + run.speed * 0.1 > road.x &&
            run.distance - PLAYER_HALF_HITBOX < road.x + road.width,
        )
      );
    }
    if (!starterGear && run.distance >= 410) {
      starterGear = true;
      return true;
    }
    const support = run.platforms.find(
      (road) =>
        run.distance + PLAYER_HALF_HITBOX > road.x &&
        run.distance - PLAYER_HALF_HITBOX < road.x + road.width &&
        Math.abs(run.player.y - platformTopAt(road, run.distance)) < 0.1,
    );
    if (
      support?.top === 128 &&
      !platformSlope(support) &&
      !crestJumps.has(support.x) &&
      run.distance >=
        support.x + support.width / 2 - run.speed * JUMP_AIRTIME * 0.5
    ) {
      crestJumps.add(support.x);
      return true;
    }
    const next = run.platforms[run.platforms.indexOf(support!) + 1];
    return (
      Boolean(
        support &&
        next &&
        !platformsJoin(support, next) &&
        support.x + support.width - run.distance <= run.speed * 0.14,
      ) ||
      run.obstacles.some(
        (obstacle) =>
          obstacle.x > run.distance &&
          obstacle.x - run.distance <= run.speed * JUMP_AIRTIME * 0.5,
      ) ||
      run.rivals.some(
        (rival) =>
          !rival.defeated &&
          rival.x > run.distance &&
          rival.x - run.distance <=
            (run.speed - rival.speed) * JUMP_AIRTIME * 0.5,
      )
    );
  }
}

async function replayRoute(
  page: Page,
  info: TestInfo,
  name: string,
  touch = false,
  late = false,
) {
  const events = planRoute(late);
  const runner = page.getByTestId('runner');
  if (touch)
    await page.getByRole('button', { name: 'スタート', exact: true }).tap();
  else
    await page.getByRole('button', { name: 'スタート', exact: true }).click();
  let at = 0;
  for (const event of events) {
    await page.clock.runFor(event.at - at);
    at = event.at;
    if (!event.checkpoint) {
      if (touch)
        await page.getByRole('button', { name: 'ジャンプ', exact: true }).tap();
      else await page.keyboard.press('Space');
    }
    await expect(runner).toHaveAttribute('data-status', 'running');
    const x = Number(await runner.getAttribute('data-world-x'));
    // Read-only UI snapshots update every 60ms; one RAF phase can also differ.
    expect(Math.abs(x - event.x)).toBeLessThan(30);
    if (!event.checkpoint) continue;
    const checkpoint = event.checkpoint;
    const y = Number(await runner.getAttribute('data-y'));
    if (checkpoint.surface) {
      await expect(runner).toHaveAttribute('data-grounded', 'true');
      expect(Math.abs(y - platformTopAt(checkpoint.surface, x))).toBeLessThan(
        1,
      );
    }
    if (checkpoint.apex !== undefined) {
      expect(y).toBeGreaterThan(checkpoint.apex + 80);
      await expect(runner).toHaveAttribute('data-grounded', 'false');
    }
    if (checkpoint.name === 'equipped-first-gap')
      await expect(page.getByLabel('現在の装備')).toContainText('MACHINE');
    await expect(runner).toHaveAttribute('data-jumps', String(event.jumps));
    await capture(page, info, `${name}-${checkpoint.name}`);
  }
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

test('keyboard input traverses slopes, tiny chains and a later capped-speed pattern', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await openRun(page);
  await replayRoute(page, info, 'desktop', false, true);
  expect(await distance(page)).toBeGreaterThan(1800);
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
  { width: 568, height: 320, name: 'landscape' },
]) {
  test.describe(`touch ${viewport.name}`, () => {
    test.use({ viewport, hasTouch: true });
    test('touch input clears slopes and tiny chains while the playable view fits', async ({
      page,
    }, info) => {
      test.setTimeout(90000);
      await openRun(page);
      await replayRoute(page, info, `touch-${viewport.name}`, true);
      if (viewport.name === 'landscape')
        await expect(page.locator('.runner-best')).toBeHidden();
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
    });
  });
}
