import { runtimeAssetUrl } from '../runtimeAssets';
import type { RivalKind, WeaponId } from './types';

const root = (path: string) => runtimeAssetUrl(`assets/${path}`);
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
  rivals: Record<RivalKind, HTMLCanvasElement[]>;
  weapons: Record<WeaponId, HTMLCanvasElement>;
  shield: HTMLCanvasElement;
  magnet: HTMLCanvasElement;
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
): HTMLCanvasElement {
  const width = image.width / cells;
  const height = image.height / cells;
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

export async function loadRunnerArt(): Promise<RunnerArt> {
  const [player, background, rivals, weapons, shield, magnet] =
    await Promise.all([
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
    ]);
  return { player, background, rivals, weapons, shield, magnet };
}
