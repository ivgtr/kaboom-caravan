import { runtimeAssetUrl } from '../runtimeAssets';
import type { AbilityId, RivalKind, WeaponId } from './types';

const root = (path: string) => runtimeAssetUrl(`assets/${path}`);
export const SCRAP_ART = root('runner-pickups/scrap-metal_v001.png');
export const ABILITY_ART: Record<AbilityId, string> = {
  boost: root('score-fever/boost.webp'),
  slam: root('score-fever/slam.webp'),
  gold: root('score-fever/gold.webp'),
  magnet: root('score-fever/magnet.webp'),
};
export const WEAPON_ART: Record<WeaponId, string> = {
  machine: root('equipment/wpn_machine_cannon_v001.png'),
  scatter: root('equipment/wpn_scatter_cannon_v001.png'),
  rocket: root('equipment/wpn_rocket_launcher_v001.png'),
  rail: root('equipment/wpn_railgun_v001.png'),
  flame: root('equipment/wpn_flamethrower_v001.png'),
  mine: root('equipment/wpn_mine_launcher_v001.png'),
};
const rivalNames: Record<RivalKind, string> = {
  basic: 'basic',
  rusher: 'rusher',
  heavy: 'heavy',
  bomber: 'bomber',
  artillery: 'artillery',
  fortress: 'kawaii_fortress',
};
export interface RunnerArt {
  player: HTMLCanvasElement;
  background: HTMLImageElement;
  terrain: {
    body: HTMLImageElement;
    cap: HTMLImageElement;
  };
  rivals: Record<RivalKind, HTMLCanvasElement[]>;
  weapons: Record<WeaponId, HTMLCanvasElement>;
  shield: HTMLCanvasElement;
  magnet: HTMLCanvasElement;
  scrap: HTMLCanvasElement;
  crate: HTMLCanvasElement;
  fever: {
    cabinet: HTMLCanvasElement;
    chest: HTMLCanvasElement;
    goldenChest: HTMLCanvasElement;
    openChest: HTMLCanvasElement;
    burst: HTMLCanvasElement;
    trail: HTMLCanvasElement;
    abilities: Record<AbilityId, HTMLCanvasElement>;
    goldenRivals: Record<RivalKind, HTMLCanvasElement[]>;
    goldenCrate: HTMLCanvasElement;
  };
  effects: {
    guard: HTMLCanvasElement;
    hit: HTMLCanvasElement;
    burst: HTMLCanvasElement;
  };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

// Trim transparent margins once, keeping the original artwork and crisp contact line.
function trim(
  image: HTMLImageElement,
  column = 0,
  row = 0,
  cells = 1,
  rows = cells,
): HTMLCanvasElement {
  const width = image.width / cells;
  const height = image.height / rows;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(
    image,
    column * width,
    row * height,
    width,
    height,
    0,
    0,
    width,
    height,
  );
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) > 20) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const cropped = document.createElement('canvas');
  cropped.width = Math.max(1, right - left + 1);
  cropped.height = Math.max(1, bottom - top + 1);
  cropped
    .getContext('2d')!
    .drawImage(
      canvas,
      left,
      top,
      cropped.width,
      cropped.height,
      0,
      0,
      cropped.width,
      cropped.height,
    );
  return cropped;
}

/** Cache a high-density pickup once, rather than resampling its large source every frame. */
function compact(image: HTMLCanvasElement, maxEdge = 96): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Tint the actual painted sprite once; retain its silhouette and shaded details. */
function gild(image: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.filter = 'sepia(1) saturate(2.9) hue-rotate(350deg) brightness(1.17)';
  context.drawImage(image, 0, 0);
  return canvas;
}

export async function loadRunnerArt(): Promise<RunnerArt> {
  const [
    player,
    background,
    rivals,
    weapons,
    shield,
    magnet,
    scrap,
    crate,
    guard,
    hit,
    burst,
    body,
    cap,
    feverImages,
  ] = await Promise.all([
    loadImage(root('animation/veh_player_chassis_v005.png')).then((image) =>
      trim(image),
    ),
    loadImage(root('world/env_background_integrated_2x1_v005.webp')),
    Promise.all(
      Object.entries(rivalNames).map(async ([kind, name]) => {
        const image = await loadImage(
          root(`animation/enm_${name}_motion_v002.png`),
        );
        return [
          kind,
          [
            trim(image, 0, 0, 2),
            trim(image, 1, 0, 2),
            trim(image, 0, 1, 2),
            trim(image, 1, 1, 2),
          ],
        ];
      }),
    ).then((entries) => Object.fromEntries(entries) as RunnerArt['rivals']),
    Promise.all(
      Object.entries(WEAPON_ART).map(async ([id, url]) => [
        id,
        trim(await loadImage(url)),
      ]),
    ).then((entries) => Object.fromEntries(entries) as RunnerArt['weapons']),
    loadImage(root('equipment/mod_shield_generator_v001.png')).then((image) =>
      trim(image),
    ),
    loadImage(root('equipment/mod_magnetic_armor_v001.png')).then((image) =>
      trim(image),
    ),
    loadImage(SCRAP_ART).then((image) => compact(trim(image))),
    loadImage(root('supply/supply_ammo_crate_v001.png')).then((image) =>
      trim(image),
    ),
    loadImage(root('vfx/vfx_parry_deflect_success_v002.png')).then((image) =>
      trim(image),
    ),
    loadImage(root('vfx/vfx_ballistic_pair_v001.png')).then((image) =>
      trim(image, 1, 0, 2, 1),
    ),
    loadImage(root('vfx/vfx_explosive_pair_v001.png')).then((image) =>
      trim(image, 1, 0, 2, 1),
    ),
    loadImage(root('runner-terrain/rock-body.webp')),
    loadImage(root('runner-terrain/road-cap.webp')),
    Promise.all(
      [
        'cabinet',
        'chest',
        'chest-gold',
        'chest-open',
        'burst',
        'trail',
        'boost',
        'slam',
        'gold',
        'magnet',
      ].map(async (name) =>
        trim(await loadImage(root(`score-fever/${name}.webp`))),
      ),
    ),
  ]);
  return {
    player,
    background,
    terrain: { body, cap },
    rivals,
    weapons,
    shield,
    magnet,
    scrap,
    crate,
    fever: {
      cabinet: feverImages[0]!,
      chest: feverImages[1]!,
      goldenChest: feverImages[2]!,
      openChest: feverImages[3]!,
      burst: feverImages[4]!,
      trail: feverImages[5]!,
      abilities: {
        boost: feverImages[6]!,
        slam: feverImages[7]!,
        gold: feverImages[8]!,
        magnet: feverImages[9]!,
      },
      goldenRivals: Object.fromEntries(
        Object.entries(rivals).map(([kind, poses]) => [kind, poses.map(gild)]),
      ) as RunnerArt['rivals'],
      goldenCrate: gild(crate),
    },
    effects: { guard, hit, burst },
  };
}
