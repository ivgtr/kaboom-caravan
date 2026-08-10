import { useEffect, useRef, useState } from 'react';
import { FixedStepLoop } from '../game/simulation/FixedStepLoop';
import { createSimulation } from '../game/simulation/createSimulation';
import { stepSimulation } from '../game/simulation/stepSimulation';
import type { CombatEvent, SimulationState } from '../game/simulation/types';
import { InputManager } from '../input/InputManager';
import { GameRenderer } from '../render/GameRenderer';

interface HudSnapshot {
  tick: number;
  status: SimulationState['status'];
  position: number;
  hitPoints: number;
  heat: number;
  energy: number;
  ammo: number;
  enemies: number;
  frontline: number;
  pressure: number;
  riskTier: SimulationState['frontline']['riskTier'];
  rewardMultiplier: number;
  primaryCooldown: number;
  secondaryCooldown: number;
  skillCooldown: number;
  overheated: boolean;
  nearestEnemyDistance?: number;
  nearestEnemyHitPoints?: number;
}

function toHudSnapshot(state: SimulationState): HudSnapshot {
  const nearestEnemy = state.enemies
    .map((enemy) => ({
      distance: Math.abs(enemy.position - state.player.position),
      hitPoints: enemy.hitPoints,
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  return {
    tick: state.tick,
    status: state.status,
    position: state.player.position,
    hitPoints: state.player.hitPoints,
    heat: state.player.heat,
    energy: state.player.energy,
    ammo: state.player.ammo,
    enemies: state.enemies.length,
    frontline: state.frontline.position,
    pressure: state.frontline.pressure,
    riskTier: state.frontline.riskTier,
    rewardMultiplier: state.frontline.rewardMultiplier,
    primaryCooldown: state.player.primaryCooldown,
    secondaryCooldown: state.player.secondaryCooldown,
    skillCooldown: state.player.skillCooldown,
    overheated: state.player.overheated,
    nearestEnemyDistance: nearestEnemy?.distance,
    nearestEnemyHitPoints: nearestEnemy?.hitPoints,
  };
}

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState(() => toHudSnapshot(createSimulation()));
  const [runVersion, setRunVersion] = useState(0);
  const [feedback, setFeedback] = useState(
    '戦闘開始。敵との距離を調整してください。',
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let simulation = createSimulation(1);
    let lastSnapshotTick = -1;
    const input = new InputManager();
    const renderer = new GameRenderer(canvas);
    const loop = new FixedStepLoop(
      (deltaSeconds) => {
        simulation = stepSimulation(
          simulation,
          input.readCommand(),
          deltaSeconds,
        );
        const latestEvent = simulation.events.at(-1);
        if (latestEvent) setFeedback(describeCombatEvent(latestEvent));
        if (simulation.tick - lastSnapshotTick >= 6) {
          lastSnapshotTick = simulation.tick;
          setHud(toHudSnapshot(simulation));
        }
      },
      (alpha) => renderer.render(simulation, alpha),
    );

    input.connect();
    loop.start();

    return () => {
      loop.stop();
      input.disconnect();
      renderer.dispose();
    };
  }, [runVersion]);

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} aria-label="戦闘フィールド" />
      <section className="hud" aria-label="車両状態">
        <strong>Kaboom Caravan / Combat Vertical Slice</strong>
        <Resource label="HP" value={hud.hitPoints} maximum={100} />
        <Resource
          label={hud.overheated ? 'OVERHEAT' : 'HEAT'}
          value={hud.heat}
          maximum={100}
          danger={hud.overheated}
        />
        <Resource label="ENERGY" value={hud.energy} maximum={100} />
        <span className="hud-stat">AMMO {hud.ammo}</span>
        <span className="hud-stat">ENEMY {hud.enemies}</span>
      </section>
      <section className="frontline-panel" aria-label="前線状態">
        <strong>{riskLabel(hud.riskTier)}</strong>
        <span>報酬期待値 ×{hud.rewardMultiplier.toFixed(1)}</span>
        <span>
          前線 {hud.frontline.toFixed(1)} / 圧力 {hud.pressure}
        </span>
        <span>
          最寄り敵{' '}
          {hud.nearestEnemyDistance === undefined
            ? 'なし'
            : `${hud.nearestEnemyDistance.toFixed(1)}m / HP ${hud.nearestEnemyHitPoints?.toFixed(1)}`}
        </span>
      </section>
      <section className="weapon-panel" aria-label="武器状態">
        <WeaponStatus
          keyLabel="SPACE"
          name="機関砲 12–38m"
          cooldown={hud.primaryCooldown}
        />
        <WeaponStatus
          keyLabel="E / SHIFT"
          name="レールガン 30–72m"
          cooldown={hud.secondaryCooldown}
        />
        <WeaponStatus
          keyLabel="Q"
          name="緊急ブースト"
          cooldown={hud.skillCooldown}
        />
      </section>
      <aside className="debug-panel">
        tick {hud.tick} / position {hud.position.toFixed(1)}
      </aside>
      <p className="combat-feedback" aria-live="polite">
        {feedback}
      </p>
      <p className="controls">
        A / D または ← / → 移動・Space 主武器・E / Shift 副武器・Q 緊急後退
      </p>
      {hud.status !== 'active' && (
        <section className="result-panel" role="dialog" aria-modal="true">
          <strong>{hud.status === 'victory' ? 'VICTORY!' : 'DEFEAT'}</strong>
          <span>
            {hud.status === 'victory'
              ? '前線を守り切りました。'
              : '車両または前線が崩壊しました。'}
          </span>
          <button
            type="button"
            onClick={() => {
              setFeedback('戦闘開始。敵との距離を調整してください。');
              setRunVersion((value) => value + 1);
            }}
          >
            もう一度テスト
          </button>
        </section>
      )}
    </main>
  );
}

function describeCombatEvent(event: CombatEvent): string {
  switch (event.type) {
    case 'weapon-fired':
      return event.weaponId === 'railgun' ? 'レールガン発射。' : '機関砲発射。';
    case 'projectile-hit':
      return `命中：${event.damage.toFixed(1)} damage`;
    case 'enemy-killed':
      return '敵を撃破。前線を押し上げました。';
    case 'vehicle-hit':
      return `被弾：${event.damage.toFixed(1)} damage`;
    case 'overheated':
      return 'OVERHEAT：Heat 60まで冷却するか緊急ブーストを使用してください。';
    case 'cooled':
      return '冷却完了。武器を再使用できます。';
    case 'skill-activated':
      return '緊急ブースト：12m後退し、Heatを35排出しました。';
    case 'enemy-attacked':
      return '敵の遠距離攻撃を確認。';
    case 'wave-started':
      return 'Wave開始。';
    case 'wave-completed':
      return 'Wave完了。';
    case 'boss-phase-changed':
      return `Boss Phase ${event.phase}へ移行。`;
    case 'combat-ended':
      return event.result === 'victory' ? '戦闘勝利。' : '戦闘敗北。';
  }
}

function Resource({
  label,
  value,
  maximum,
  danger = false,
}: {
  label: string;
  value: number;
  maximum: number;
  danger?: boolean;
}) {
  return (
    <span className={`resource ${danger ? 'resource-danger' : ''}`}>
      <span>
        {label} {value.toFixed(0)}
      </span>
      <progress value={value} max={maximum} aria-label={label} />
    </span>
  );
}

function WeaponStatus({
  keyLabel,
  name,
  cooldown,
}: {
  keyLabel: string;
  name: string;
  cooldown: number;
}) {
  return (
    <span className={cooldown > 0 ? 'weapon-cooldown' : 'weapon-ready'}>
      <kbd>{keyLabel}</kbd> {name}{' '}
      {cooldown > 0 ? `${cooldown.toFixed(1)}s` : 'READY'}
    </span>
  );
}

function riskLabel(riskTier: HudSnapshot['riskTier']): string {
  switch (riskTier) {
    case 'safe':
      return '安全圏';
    case 'frontline':
      return '前線';
    case 'danger':
      return '危険圏';
    case 'enemy-territory':
      return '敵陣付近';
  }
}
