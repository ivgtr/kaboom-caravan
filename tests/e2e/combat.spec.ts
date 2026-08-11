import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('starts a new post-MVP run from the kawaii garage', async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 689 });
  await page.goto('/');

  const garage = page
    .getByRole('dialog')
    .filter({ hasText: 'キャラバン整備庫' });
  await expect(garage).toBeVisible();
  await expect(
    garage.getByRole('button', { name: /KABOOM・キャラバン/ }),
  ).toBeDisabled();
  await garage.getByRole('button', { name: /ブレイズ・キャラバン/ }).click();
  await expect(garage).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
  await expect(page.getByRole('button', { name: '主武器' })).toContainText(
    'LV.1',
  );
});

test('navigates the garage with shared menu controls and skips locked loadouts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1184, height: 689 });
  await page.goto('/');

  const garage = page
    .getByRole('dialog')
    .filter({ hasText: 'キャラバン整備庫' });
  const standard = garage.getByRole('button', {
    name: /スタンダード・キャラバン/,
  });
  const blaze = garage.getByRole('button', {
    name: /ブレイズ・キャラバン/,
  });
  const locked = garage.getByRole('button', { name: /KABOOM・キャラバン/ });

  await expect(standard).toBeFocused();
  await page.keyboard.press('KeyD');
  await expect(blaze).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(locked).not.toBeFocused();
  await expect(standard).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(blaze).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(garage).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
});

test('uses the same navigation controls for routes and the result screen', async ({
  page,
}) => {
  await page.goto('/?debug=1&routePreview=1');
  const routes = page.getByRole('dialog').filter({ hasText: '進路選択' });
  const normalRoute = routes.getByRole('button', { name: /街道を進む/ });
  const alternateRoute = routes.getByRole('button', {
    name: /強敵の待ち伏せ/,
  });

  await expect(normalRoute).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(alternateRoute).toBeFocused();
  await page.keyboard.press('Space');
  await expect(routes).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();

  await page.goto('/?debug=1&resultPreview=defeat');
  const result = page.getByRole('dialog').filter({ hasText: 'キャラバン大破' });
  const restart = result.getByRole('button', { name: '整備庫へ戻る' });
  await expect(restart).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(result).toHaveCount(0);
  await expect(
    page.getByRole('dialog').filter({ hasText: 'キャラバン整備庫' }),
  ).toBeVisible();
});

async function enableReactiveParry(page: import('@playwright/test').Page) {
  await page.locator('.combat-feedback').waitFor({ state: 'attached' });
  await page.evaluate(() => {
    const feedback = document.querySelector('.combat-feedback');
    if (!feedback) return;
    let parryHeld = false;
    const reactToWarning = () => {
      const warningActive = feedback.textContent?.includes('攻撃が来る！');
      if (warningActive && !parryHeld) {
        parryHeld = true;
        window.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'KeyF', bubbles: true }),
        );
      } else if (!warningActive && parryHeld) {
        parryHeld = false;
        window.dispatchEvent(
          new KeyboardEvent('keyup', { code: 'KeyF', bubbles: true }),
        );
      }
    };
    new MutationObserver(reactToWarning).observe(feedback, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    reactToWarning();
  });
}

async function waitThroughWeaponCaches(
  page: import('@playwright/test').Page,
  terminal: import('@playwright/test').Locator,
  timeout: number,
) {
  const deadline = Date.now() + timeout;
  const cache = page.getByRole('dialog').filter({ hasText: '武器箱を発見！' });
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const visible = await Promise.race([
      terminal
        .waitFor({ state: 'visible', timeout: remaining })
        .then(() => 'terminal' as const),
      cache
        .waitFor({ state: 'visible', timeout: remaining })
        .then(() => 'cache' as const),
    ]);
    if (visible === 'terminal') return;

    await page.keyboard.up('c');
    await page.keyboard.up('Space');
    await page.keyboard.up('d');
    await cache.locator('.reward-card').first().click();
    await cache
      .getByLabel('武器の装着先を選択')
      .getByRole('button', { name: /副武器 副/ })
      .click();
    await page.keyboard.down('c');
    await page.keyboard.down('Space');
    await page.keyboard.down('d');
  }
  throw new Error(`Combat outcome was not visible within ${timeout}ms`);
}

test('supports keyboard and thumb controls while keeping debug opt-in', async ({
  page,
}) => {
  await page.goto('/?debug=1');

  const health = page.getByRole('region', { name: '車両耐久' });
  const debug = page.locator('.debug-panel');
  const main = page.getByRole('button', { name: '主武器' });
  const sub = page.getByRole('button', { name: '副武器' });
  const parry = page.getByRole('button', { name: '迎撃パリィ' });
  const boost = page.getByRole('button', { name: '急加速' });

  await expect(health).toContainText('100');
  const progress = page.getByRole('region', { name: '戦闘進行' });
  await expect(progress).toContainText('第1戦 / 全10戦');
  await expect(progress).toContainText('戦利品 ×1.0');
  await expect(progress).not.toContainText('SAFE');
  await expect(progress).not.toContainText('DANGER');
  await expect(main).toContainText('50');
  await expect(main.locator('kbd')).toHaveText('SPACE');
  await expect(sub.locator('kbd')).toHaveText('C');
  await expect(parry.locator('kbd')).toHaveText('F');
  await expect(boost.locator('kbd')).toHaveText('SHIFT');
  await expect(debug).toContainText('position 10.0');

  await page.keyboard.down('d');
  await expect(debug).not.toContainText('position 10.0');
  const energyMeterBefore = await boost
    .locator('.control-meter')
    .getAttribute('style');
  await page.keyboard.down('ShiftLeft');
  await expect(boost).toHaveClass(/active/);
  await expect(boost.locator('.control-meter')).not.toHaveAttribute(
    'style',
    energyMeterBefore ?? '',
  );
  await page.keyboard.up('ShiftLeft');
  await expect(boost).not.toHaveClass(/active/);
  await page.keyboard.up('d');

  await page.keyboard.down('Space');
  await expect(main).not.toContainText('50');
  await page.keyboard.up('Space');

  const positionBeforeTouch = await debug.textContent();
  const backward = page.getByRole('button', { name: '後退' });
  await backward.hover();
  await page.mouse.down();
  await expect(debug).not.toHaveText(positionBeforeTouch ?? '');
  await page.mouse.up();

  await page.reload();
  await expect(health).toContainText('100');
  await expect(main).toContainText('50');
  await expect(debug).toContainText('position 10.0');
});

test('hides diagnostic UI from the product view', async ({ page }) => {
  await page.goto('/?quickStart=1');
  await expect(page.locator('.debug-panel')).toHaveCount(0);
});

test('keeps rolling with inertia after movement input is released', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const rigAsset = page.waitForResponse((response) =>
    response.url().endsWith('/assets/animation/veh_player_rig_parts_v003.png'),
  );
  const chassisAsset = page.waitForResponse((response) =>
    response.url().endsWith('/assets/animation/veh_player_chassis_v005.png'),
  );
  await page.goto('/?debug=1');
  expect((await rigAsset).ok()).toBe(true);
  expect((await chassisAsset).ok()).toBe(true);

  const debug = page.locator('.debug-panel');
  const readPosition = async () => {
    const text = await debug.textContent();
    return Number(text?.match(/position ([\d.]+)/)?.[1] ?? 0);
  };

  await page.keyboard.down('d');
  await expect.poll(readPosition).toBeGreaterThan(10.5);
  await page.keyboard.up('d');
  const positionAtRelease = await readPosition();
  await expect.poll(readPosition).toBeGreaterThan(positionAtRelease);

  if (process.env.CAPTURE_MOTION_REVIEW) {
    await page.screenshot({
      path: 'artifacts/animation/review/caravan_battery_1440x900_v005.png',
    });
    await page.goto('/?debug=motion');
    await expect(debug).toContainText('position 10.0');
    await page.screenshot({
      path: 'artifacts/animation/review/caravan_wheel_axes_1440x900_v005.png',
    });
  }
});

test('renders an acquired module on the physical caravan mounts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1&rewardPreview=full-modules');

  const rewards = page.getByRole('dialog').filter({ hasText: '戦利品選択' });
  const moduleCard = rewards.locator('.reward-module').first();
  await expect(moduleCard).toBeVisible();
  await moduleCard.getByRole('button', { name: /を選択/ }).click();

  await expect(rewards).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
  if (process.env.CAPTURE_MOTION_REVIEW) {
    await page.screenshot({
      path: 'artifacts/animation/review/caravan_module_mounted_1440x900_v005.png',
    });
  }
});

test('reaches battle clear through live combat', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1184, height: 689 });
  await page.goto('/?quickStart=1');
  await enableReactiveParry(page);
  await page.keyboard.down('c');
  await page.keyboard.down('Space');
  await page.keyboard.down('d');

  const clear = page.locator('.battle-clear');
  await waitThroughWeaponCaches(page, clear, 45_000);
  await expect(clear).toContainText(/討伐時間 \d{2}:\d{2}\.\d{2}/);
  if (process.env.CAPTURE_UI_REVIEW) {
    await waitForAnimations(clear);
    await page.screenshot({
      path: 'artifacts/ui/review/battle_clear_1184x689.png',
    });
  }
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`previews the oldest module replacement at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?debug=1&rewardPreview=full-modules');

    const rewards = page.getByRole('dialog').filter({ hasText: '戦利品選択' });
    const oldestModuleName = '冷却ファン';
    await expect(rewards).toBeVisible();
    await expect(rewards).toContainText('モジュール 4/4');
    const moduleCards = rewards.locator('.reward-module');
    const moduleCardCount = await moduleCards.count();
    expect(moduleCardCount).toBeGreaterThan(0);
    for (let index = 0; index < moduleCardCount; index += 1) {
      const moduleCard = moduleCards.nth(index);
      const swap = moduleCard.locator('.reward-module-swap');
      await expect(swap).toContainText(`${oldestModuleName}と交換`);
      await expect(
        moduleCard.getByRole('button', {
          name: new RegExp(`${oldestModuleName}と交換`),
        }),
      ).toBeVisible();
      const cardBox = await moduleCard.boundingBox();
      const descriptionBox = await moduleCard.locator('p').boundingBox();
      const swapBox = await swap.boundingBox();
      const actionBox = await moduleCard
        .locator('.reward-card-action')
        .boundingBox();
      expect(cardBox).not.toBeNull();
      await expectContained(swap, cardBox!);
      expect(overlap(descriptionBox!, actionBox!)).toBe(false);
      expect(swapBox!.y).toBeGreaterThanOrEqual(actionBox!.y);
      expect(swapBox!.y + swapBox!.height).toBeLessThanOrEqual(
        actionBox!.y + actionBox!.height,
      );
    }
    if (process.env.CAPTURE_UI_REVIEW) {
      await page.screenshot({
        path: `artifacts/ui/review/reward_module_swap_${viewport.width}x${viewport.height}.png`,
      });
    }
  });
}

for (const viewport of [
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`renders the grounded mine VFX at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const mineAsset = page.waitForResponse((response) =>
      response.url().endsWith('/assets/vfx/vfx_mine_deployable_v001.png'),
    );
    await page.goto('/?debug=1&mineVfx=armed');
    expect((await mineAsset).ok()).toBe(true);
    if (process.env.CAPTURE_VFX_REVIEW) {
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `artifacts/vfx/review/mine_deployable_${viewport.width}x${viewport.height}_v001.png`,
      });
    }
  });
}

for (const viewport of [
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`renders generated boost and parry VFX at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const boostAsset = page.waitForResponse((response) =>
      response.url().endsWith('/assets/vfx/vfx_boost_trail_pair_v001.png'),
    );
    const parryAsset = page.waitForResponse((response) =>
      response.url().endsWith('/assets/vfx/vfx_parry_pair_v001.png'),
    );
    await page.goto('/?quickStart=1');
    expect((await boostAsset).ok()).toBe(true);
    expect((await parryAsset).ok()).toBe(true);
    await page.keyboard.down('d');
    await page.keyboard.down('ShiftLeft');
    await expect(page.getByRole('button', { name: '急加速' })).toHaveClass(
      /active/,
    );
    if (process.env.CAPTURE_VFX_REVIEW) {
      await page.waitForTimeout(160);
      await page.screenshot({
        path: `artifacts/vfx/review/boost_trail_${viewport.width}x${viewport.height}_v001.png`,
      });
    }
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('d');
    for (const pose of ['ready', 'success'] as const) {
      await page.goto(`/?quickStart=1&parryVfx=${pose}`);
      await expect(
        page.getByRole('button', { name: '迎撃パリィ' }),
      ).toBeVisible();
      if (process.env.CAPTURE_VFX_REVIEW) {
        await page.waitForTimeout(100);
        await page.screenshot({
          path: `artifacts/vfx/review/parry_${pose}_${viewport.width}x${viewport.height}_v001.png`,
        });
      }
    }
  });
}

for (const viewport of [
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`renders generated combat VFX at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?quickStart=1');
    const main = page.getByRole('button', { name: '主武器' });
    await expect(main).toContainText('50');
    await page.keyboard.down('Space');
    await expect(main).not.toContainText('50');
    if (process.env.CAPTURE_VFX_REVIEW) {
      await page.screenshot({
        path: `artifacts/vfx/review/combat_ballistic_${viewport.width}x${viewport.height}_v001.png`,
      });
    }
    await page.keyboard.up('Space');
  });
}

for (const viewport of [
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`previews all boss phase auras at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const phase of [1, 2, 3] as const) {
      await page.goto(`/?debug=1&bossPhase=${phase}`);
      await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
      await page.evaluate(async () => {
        const image = new Image();
        const loaded = new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener(
            'error',
            () => reject(new Error('boss aura asset failed to load')),
            {
              once: true,
            },
          );
        });
        image.src = '/assets/animation/boss_phase_aura_v001.png';
        await loaded;
      });
      if (process.env.CAPTURE_BOSS_REVIEW) {
        await page.screenshot({
          path: `artifacts/animation/review/boss_phase_${phase}_${viewport.width}x${viewport.height}_v001.png`,
        });
      }
    }
  });
}

for (const viewport of [
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`previews generated enemy attack VFX at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const visualId of ['spore', 'boss-core', 'boss-burst'] as const) {
      await page.goto(`/?debug=1&enemyVfx=${visualId}`);
      await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
      await page.evaluate(async (id) => {
        const image = new Image();
        const loaded = new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener(
            'error',
            () => reject(new Error('enemy VFX asset failed to load')),
            { once: true },
          );
        });
        image.src = `/assets/vfx/vfx_enemy_${id.replace('-', '_')}_pair_v001.png`;
        await loaded;
      }, visualId);
      if (process.env.CAPTURE_ENEMY_VFX_REVIEW) {
        await page.screenshot({
          path: `artifacts/vfx/review/enemy_${visualId}_${viewport.width}x${viewport.height}_v001.png`,
        });
      }
    }
  });
}

for (const viewport of [
  { width: 1184, height: 689 },
  { width: 844, height: 390 },
]) {
  test(`previews contact and death VFX at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const preview of [
      'basic',
      'rusher',
      'heavy',
      'bomber',
      'normal',
      'boss',
    ] as const) {
      await page.goto(`/?debug=1&deathVfx=${preview}`);
      await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
      await page.evaluate(async () => {
        const image = new Image();
        const loaded = new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener(
            'error',
            () => reject(new Error('enemy death VFX asset failed to load')),
            { once: true },
          );
        });
        image.src = '/assets/vfx/vfx_enemy_death_pair_v001.png';
        await loaded;
      });
      if (process.env.CAPTURE_DEATH_VFX_REVIEW) {
        await page.screenshot({
          path: `artifacts/vfx/review/enemy_${preview}_${viewport.width}x${viewport.height}_v001.png`,
        });
      }
    }
  });
}

test('shows a recoverable message when Canvas 2D is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto('/?quickStart=1');

  const error = page.getByRole('alert');
  await expect(error).toContainText('表示エラー');
  await expect(error.getByRole('button', { name: '再読み込み' })).toBeVisible();
  await expect(page.getByRole('button', { name: '主武器' })).toHaveCount(0);
});

for (const viewport of [
  { width: 844, height: 390 },
  { width: 1184, height: 689 },
  { width: 1440, height: 900 },
]) {
  test(`keeps visual rewards aligned at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?debug=1&rewardPreview=weapon-slot');

    const rewards = page.getByRole('dialog').filter({ hasText: '戦利品選択' });
    await expect(rewards).toBeVisible();

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
        card.locator('.reward-type'),
        card.locator('.equipment-visual'),
        card.locator('h2'),
        card.locator('p'),
        card.locator('.reward-card-action'),
      ]) {
        await expectContained(content, cardBox!);
      }
      const selectBox = await card.locator('.reward-card-select').boundingBox();
      expect(selectBox).not.toBeNull();
      expect(selectBox!.width).toBeCloseTo(cardBox!.width, 0);
      expect(selectBox!.height).toBeCloseTo(cardBox!.height, 0);
      const regions = await Promise.all(
        [
          card.locator('.reward-type'),
          card.locator('.equipment-visual'),
          card.locator('h2'),
          card.locator('p'),
          card.locator('.reward-card-action'),
        ].map((region) => region.boundingBox()),
      );
      for (
        let regionIndex = 0;
        regionIndex < regions.length - 1;
        regionIndex += 1
      ) {
        expect(
          overlap(regions[regionIndex]!, regions[regionIndex + 1]!),
          `card ${index + 1} regions ${regionIndex + 1} and ${regionIndex + 2} overlap`,
        ).toBe(false);
      }
    }
    const weaponCard = rewards
      .locator('.reward-card.reward-weapon:not(.reward-upgrade)')
      .first();
    const weaponIndex = await cards.evaluateAll((items) =>
      items.findIndex((item) =>
        item.matches('.reward-weapon:not(.reward-upgrade)'),
      ),
    );
    const navigationIndex = weaponIndex >= 0 ? weaponIndex : 0;
    await page.keyboard.press(`Digit${navigationIndex + 1}`);

    if (weaponIndex < 0) {
      await expect(rewards).toHaveCount(0);
      await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
      return;
    }

    const slotPicker = rewards.getByLabel('武器の装着先を選択');
    await expect(slotPicker).toBeVisible();
    await expect(
      slotPicker.getByRole('button', { name: /主武器 主/ }),
    ).toBeVisible();
    await expect(
      slotPicker.getByRole('button', { name: /副武器 副/ }),
    ).toBeVisible();
    if (process.env.CAPTURE_UI_REVIEW) {
      await waitForAnimations(slotPicker);
      await page.screenshot({
        path: `artifacts/ui/review/reward_slot_${viewport.width}x${viewport.height}.png`,
      });
    }
    await page.keyboard.press('Escape');
    await expect(slotPicker).toHaveCount(0);
    await expect(weaponCard).toHaveClass(/selected/);
    const nextIndex = (weaponIndex + 1) % 3;
    await page.keyboard.press('KeyD');
    await expect(cards.nth(nextIndex)).toHaveClass(/selected/);
    await page.keyboard.press('KeyA');
    await expect(weaponCard).toHaveClass(/selected/);
    if (process.env.CAPTURE_UI_REVIEW) {
      await page.screenshot({
        path: `artifacts/ui/review/reward_${viewport.width}x${viewport.height}.png`,
      });
    }
    await page.keyboard.press('Space');
    await expect(slotPicker).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(
      slotPicker.getByRole('button', { name: /副武器 副/ }),
    ).toHaveClass(/selected/);
    await page.keyboard.press('ArrowLeft');
    await expect(
      slotPicker.getByRole('button', { name: /主武器 主/ }),
    ).toHaveClass(/selected/);
    await page.keyboard.press('Space');
    await expect(rewards).toHaveCount(0);
    await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
  });
}

test('uses a slot confirmation step for a newly acquired weapon', async ({
  page,
}) => {
  await page.goto('/?debug=1&rewardPreview=weapon-slot');
  const rewards = page.getByRole('dialog').filter({ hasText: '戦利品選択' });
  const newWeapon = rewards
    .locator('.reward-card.reward-weapon:not(.reward-upgrade)')
    .first();

  await expect(newWeapon).toBeVisible();
  await newWeapon.click();
  const slotPicker = rewards.getByLabel('武器の装着先を選択');
  await expect(slotPicker).toBeVisible();
  await slotPicker.getByRole('button', { name: /副武器 副/ }).click();
  await expect(rewards).toHaveCount(0);
  await expect(page.getByRole('button', { name: '副武器' })).toBeVisible();
});

test('pauses combat and offers three weapons when a weapon cache is opened', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?debug=1&weaponCachePreview=1');
  const cache = page.getByRole('dialog').filter({ hasText: '武器箱を発見！' });

  await expect(cache).toBeVisible();
  await expect(cache.locator('.reward-card.reward-weapon')).toHaveCount(3);
  await expect(cache.locator('.reward-module')).toHaveCount(0);
  await expect(cache).toContainText('武器 3択');
  const cards = cache.locator('.reward-card');
  await waitForAnimations(cards.last());
  await cache.locator('.reward-grid').evaluate((grid) => {
    grid.dataset.animationStarts = '0';
    for (const card of grid.querySelectorAll('.reward-card')) {
      card.addEventListener('animationstart', () => {
        grid.dataset.animationStarts = String(
          Number(grid.dataset.animationStarts ?? 0) + 1,
        );
      });
    }
  });

  await cards.nth(1).hover();
  await expect(cards.nth(1)).toHaveClass(/selected/);
  await expect(cache.locator('.reward-card.selected')).toHaveCount(1);
  expect(
    await cards
      .nth(0)
      .evaluate((card) => new DOMMatrix(getComputedStyle(card).transform).m42),
  ).toBe(0);
  await page.keyboard.press('d');
  await expect(cards.nth(2)).toHaveClass(/selected/);
  await expect(cache.locator('.reward-card.selected')).toHaveCount(1);
  await expect(cache.locator('.reward-grid')).toHaveAttribute(
    'data-animation-starts',
    '0',
  );

  const cardBoxes = await cards.evaluateAll((cardElements) =>
    cardElements.map((card) => {
      const { left, right, top, bottom, width, height } =
        card.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    }),
  );
  expect(cardBoxes).toHaveLength(3);
  for (const [index, box] of cardBoxes.entries()) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(844);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(390);
    expect(box.width / box.height).toBeCloseTo(2 / 3, 2);
    if (index > 0)
      expect(box.left).toBeGreaterThan(cardBoxes[index - 1]!.right);
    const shortcutBox = await cards.nth(index).locator('kbd').boundingBox();
    expect(shortcutBox).not.toBeNull();
    expect(shortcutBox!.y + shortcutBox!.height / 2).toBeGreaterThanOrEqual(
      box.bottom,
    );
  }
  if (process.env.CAPTURE_UI_REVIEW) {
    await page.screenshot({
      path: 'artifacts/ui/review/weapon_cache_844x390.png',
    });
  }
  await cards.first().click();
  const slotPicker = cache.getByLabel('武器の装着先を選択');
  await expect(slotPicker).toBeVisible();
  await expect(slotPicker.locator('.slot-picker-actions strong')).toHaveCount(
    2,
  );
  if (process.env.CAPTURE_UI_REVIEW) {
    await waitForAnimations(slotPicker);
    await page.screenshot({
      path: 'artifacts/ui/review/weapon_slot_844x390.png',
    });
  }
  await slotPicker.getByRole('button', { name: /副武器 副/ }).click();
  await expect(cache).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
});

test('renders repair, ammo and weapon-cache supplies as separate drops', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1184, height: 689 });
  const supplyAssets = Promise.all(
    [
      'supply_repair_kit_v001.png',
      'supply_ammo_crate_v001.png',
      'supply_weapon_cache_v001.png',
    ].map((filename) =>
      page.waitForResponse((response) => response.url().endsWith(filename)),
    ),
  );
  await page.goto('/?debug=1&supplyPreview=1');
  for (const response of await supplyAssets) expect(response.ok()).toBe(true);

  await expect(page.getByRole('button', { name: '主武器' })).toBeVisible();
  if (process.env.CAPTURE_UI_REVIEW) {
    await page.screenshot({
      path: 'artifacts/ui/review/supply_drops_1184x689.png',
    });
  }
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 932, height: 430 },
  { width: 844, height: 390 },
]) {
  test(`keeps thumb controls separated at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?quickStart=1');

    const controls = {
      forward: page.getByRole('button', { name: '前進' }),
      backward: page.getByRole('button', { name: '後退' }),
      main: page.getByRole('button', { name: '主武器' }),
      sub: page.getByRole('button', { name: '副武器' }),
      parry: page.getByRole('button', { name: '迎撃パリィ' }),
      boost: page.getByRole('button', { name: '急加速' }),
    };
    await expect(controls.main).toBeVisible();
    if (process.env.CAPTURE_WORLD_REVIEW && viewport.width === 844) {
      await page.screenshot({
        path: 'artifacts/world/review/road_risk_zones_844x390_v002.png',
      });
    }

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
    expect(overlap(boxes.forward!, boxes.boost!)).toBe(false);
    expect(overlap(boxes.backward!, boxes.boost!)).toBe(false);
    expect(overlap(boxes.main!, boxes.sub!)).toBe(false);
    expect(overlap(boxes.main!, boxes.parry!)).toBe(false);
    expect(overlap(boxes.sub!, boxes.parry!)).toBe(false);
    expect(boxes.main!.width).toBeGreaterThan(boxes.sub!.width);
    expect(boxes.sub!.width).toBeGreaterThan(boxes.parry!.width);
    expect(boxes.main!.x).toBeGreaterThan(boxes.sub!.x);
    expect(boxes.parry!.y).toBeLessThan(boxes.main!.y);
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
