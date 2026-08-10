import { expect, test, type Page } from '@playwright/test';
import type { RendererDiagnostics } from '../../src/render/GameRenderer';

type DiagnosticsWindow = Window & {
  __kaboomRendererDiagnostics?: RendererDiagnostics;
};

const readDiagnostics = (page: Page) =>
  page.evaluate(
    () => (window as DiagnosticsWindow).__kaboomRendererDiagnostics,
  );

const percentile = (values: number[], percentage: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * percentage) - 1] ?? Infinity;
};

test.describe('renderer quality and performance gates', () => {
  test.describe.configure({ mode: 'serial' });

  for (const target of [
    { name: 'desktop', width: 1920, height: 1080, budgetMs: 20 },
    { name: 'mobile-landscape', width: 844, height: 390, budgetMs: 25 },
  ]) {
    test(`keeps ${target.name} stress render p95 below budget`, async ({
      page,
    }) => {
      test.skip(
        process.env.RUN_PERFORMANCE_BUDGETS !== '1',
        'Run performance budgets in isolation with one worker.',
      );
      await page.setViewportSize(target);
      await page.goto('/?debug=performance');
      await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
      await expect
        .poll(
          async () =>
            (await readDiagnostics(page))?.renderDurationsMs.length ?? 0,
        )
        .toBeGreaterThanOrEqual(120);
      await expect
        .poll(async () => {
          const assets = (await readDiagnostics(page))?.assets;
          return assets ? assets.readySources === assets.totalSources : false;
        })
        .toBe(true);

      const diagnostics = await readDiagnostics(page);
      expect(diagnostics).toBeDefined();
      const recentSamples = diagnostics!.renderDurationsMs.slice(-120);
      const p95 = percentile(recentSamples, 0.95);
      console.info(
        JSON.stringify({
          viewport: `${target.width}x${target.height}`,
          samples: recentSamples.length,
          renderP95Ms: Number(p95.toFixed(2)),
        }),
      );

      expect(diagnostics!.stressPlayerProjectiles).toBe(100);
      expect(diagnostics!.stressEnemyProjectiles).toBe(32);
      expect(diagnostics!.activeEffects).toBe(48);
      expect(diagnostics!.activeEffects).toBeLessThanOrEqual(
        diagnostics!.maximumActiveEffects,
      );
      expect(diagnostics!.recycledEffects).toBeLessThanOrEqual(
        diagnostics!.maximumRecycledEffects,
      );
      expect(diagnostics!.assets.failedSources).toEqual([]);
      expect(p95).toBeLessThan(target.budgetMs);
    });
  }

  test('reduces secondary motion without removing combat readability', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?debug=performance&enemyVfx=boss-burst');
    await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
    await expect
      .poll(async () => (await readDiagnostics(page))?.reducedMotion)
      .toBe(true);

    const diagnostics = await readDiagnostics(page);
    expect(diagnostics?.stressPlayerProjectiles).toBe(100);
    expect(diagnostics?.stressEnemyProjectiles).toBe(32);
    expect(diagnostics?.activeEffects).toBe(48);
    const animationDurationMs = await page
      .locator('.weapon.main')
      .evaluate((element) => {
        const duration = getComputedStyle(element).animationDuration;
        return duration.endsWith('ms')
          ? Number.parseFloat(duration)
          : Number.parseFloat(duration) * 1000;
      });
    expect(animationDurationMs).toBeLessThanOrEqual(0.01);
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('keeps the procedural fallback alive after an image decode failure', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.route('**/assets/vfx/vfx_enemy_spore_pair_v001.png', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: 'not-a-valid-png',
      }),
    );
    await page.goto('/?debug=1&enemyVfx=spore');
    await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
    await expect
      .poll(
        async () =>
          (await readDiagnostics(page))?.assets.failedSources.includes(
            '/assets/vfx/vfx_enemy_spore_pair_v001.png',
          ) ?? false,
      )
      .toBe(true);

    expect(pageErrors).toEqual([]);
    await expect(page.locator('canvas')).toBeVisible();
  });
});
