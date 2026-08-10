import { expect, test } from '@playwright/test';

test('supports keyboard and thumb controls while keeping debug opt-in', async ({
  page,
}) => {
  await page.goto('/?debug=1');

  const health = page.getByRole('region', { name: '車両耐久' });
  const debug = page.locator('.debug-panel');
  const main = page.getByRole('button', { name: '主武器' });

  await expect(health).toContainText('100');
  await expect(main).toContainText('30');
  await expect(debug).toContainText('position 10.0');

  await page.keyboard.down('d');
  await expect(debug).not.toContainText('position 10.0');
  await page.keyboard.up('d');

  await page.keyboard.down('Space');
  await expect(main).not.toContainText('30');
  await page.keyboard.up('Space');

  const positionBeforeTouch = await debug.textContent();
  const backward = page.getByRole('button', { name: '後退' });
  await backward.hover();
  await page.mouse.down();
  await expect(debug).not.toHaveText(positionBeforeTouch ?? '');
  await page.mouse.up();

  await page.reload();
  await expect(health).toContainText('100');
  await expect(main).toContainText('30');
  await expect(debug).toContainText('position 10.0');
});

test('hides diagnostic UI from the product view', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.debug-panel')).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`shows battle clear then visual rewards at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.keyboard.down('e');

    const clear = page.locator('.battle-clear');
    await expect(clear).toBeVisible({ timeout: 45_000 });
    if (process.env.CAPTURE_UI_REVIEW) {
      await waitForAnimations(clear);
      await page.screenshot({
        path: `artifacts/ui/review/battle_clear_${viewport.width}x${viewport.height}.png`,
      });
    }

    const rewards = page
      .getByRole('dialog')
      .filter({ hasText: 'SALVAGE TIME!' });
    await expect(rewards).toBeVisible();
    await page.keyboard.up('e');

    await expect(page.getByRole('button', { name: '主武器' })).toHaveCount(0);
    const cards = rewards.locator('.reward-card');
    await expect(cards).toHaveCount(3);
    await expect(rewards.locator('.equipment-art')).toHaveCount(3);
    await waitForAnimations(cards.last());
    for (let index = 0; index < 3; index += 1) {
      const card = cards.nth(index);
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.width / cardBox!.height).toBeCloseTo(2 / 3, 2);
      for (const content of [
        card.locator('.equipment-visual'),
        card.locator('h2'),
        card.locator('p'),
        card.locator('.reward-actions, :scope > button'),
      ]) {
        await expectContained(content, cardBox!);
      }
    }
    if (process.env.CAPTURE_UI_REVIEW) {
      await page.screenshot({
        path: `artifacts/ui/review/reward_${viewport.width}x${viewport.height}.png`,
      });
    }
  });
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 932, height: 430 },
  { width: 844, height: 390 },
]) {
  test(`keeps thumb controls separated at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const controls = {
      forward: page.getByRole('button', { name: '前進' }),
      backward: page.getByRole('button', { name: '後退' }),
      main: page.getByRole('button', { name: '主武器' }),
      sub: page.getByRole('button', { name: '副武器' }),
      escape: page.getByRole('button', { name: '緊急離脱' }),
    };
    await expect(controls.main).toBeVisible();

    const boxes = Object.fromEntries(
      await Promise.all(
        Object.entries(controls).map(async ([name, locator]) => [
          name,
          await locator.boundingBox(),
        ]),
      ),
    );
    for (const [name, box] of Object.entries(boxes)) {
      expect(box, `${name} has a layout box`).not.toBeNull();
      expect(
        box!.x,
        `${name} stays inside the left edge`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        box!.y,
        `${name} stays inside the top edge`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `${name} stays inside the right edge`,
      ).toBeLessThanOrEqual(viewport.width);
      expect(
        box!.y + box!.height,
        `${name} stays inside the bottom edge`,
      ).toBeLessThanOrEqual(viewport.height);
    }

    expect(overlap(boxes.forward!, boxes.backward!)).toBe(false);
    expect(overlap(boxes.main!, boxes.sub!)).toBe(false);
    expect(overlap(boxes.main!, boxes.escape!)).toBe(false);
    expect(overlap(boxes.sub!, boxes.escape!)).toBe(false);
    expect(boxes.main!.width).toBeGreaterThan(boxes.sub!.width);
    expect(boxes.sub!.width).toBeGreaterThan(boxes.escape!.width);
  });
}

function overlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

async function waitForAnimations(locator: import('@playwright/test').Locator) {
  await locator.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map(async (animation) => animation.finished),
    );
  });
}

async function expectContained(
  locator: import('@playwright/test').Locator,
  container: { x: number; y: number; width: number; height: number },
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(container.x - 1);
  expect(box!.y).toBeGreaterThanOrEqual(container.y - 1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    container.x + container.width + 1,
  );
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    container.y + container.height + 1,
  );
}
