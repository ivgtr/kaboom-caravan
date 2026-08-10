import { useEffect, useRef, useState } from 'react';
import { FixedStepLoop } from '../game/simulation/FixedStepLoop';
import { MVP_ENCOUNTERS } from '../game/data/runDefinitions';
import { WEAPON_DEFINITIONS } from '../game/data/weaponDefinitions';
import type { RewardChoice } from '../game/reward/rewardSystem';
import {
  createGameSession,
  restartGameSession,
  selectReward,
  stepGameSession,
  type GameSessionState,
  type SessionPhase,
  type WeaponSlot,
} from '../game/session/GameSession';
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

interface SessionView {
  phase: SessionPhase;
  encounterIndex: number;
  rewardChoices: RewardChoice[];
  primaryWeaponName: string;
  secondaryWeaponName: string;
  moduleNames: string[];
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

function toSessionView(session: GameSessionState): SessionView {
  const { build } = session.run;
  return {
    phase: session.phase,
    encounterIndex: session.run.encounterIndex,
    rewardChoices: session.rewardChoices,
    primaryWeaponName: WEAPON_DEFINITIONS[build.primaryWeaponId].displayName,
    secondaryWeaponName:
      WEAPON_DEFINITIONS[build.secondaryWeaponId].displayName,
    moduleNames: [...build.moduleIds],
  };
}

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialSession] = useState(() => createGameSession(1));
  const sessionRef = useRef(initialSession);
  const [hud, setHud] = useState(() => toHudSnapshot(initialSession.combat));
  const [sessionView, setSessionView] = useState(() =>
    toSessionView(initialSession),
  );
  const [feedback, setFeedback] = useState(
    '戦闘開始。敵との距離を調整してください。',
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastSnapshotTick = -1;
    let lastPhase = sessionRef.current.phase;
    const input = new InputManager();
    const renderer = new GameRenderer(canvas);
    const loop = new FixedStepLoop(
      (deltaSeconds) => {
        const session = stepGameSession(
          sessionRef.current,
          input.readCommand(),
          deltaSeconds,
        );
        sessionRef.current = session;
        const latestEvent = session.combat.events.at(-1);
        if (latestEvent) setFeedback(describeCombatEvent(latestEvent));
        const phaseChanged = session.phase !== lastPhase;
        if (phaseChanged || session.combat.tick - lastSnapshotTick >= 6) {
          lastSnapshotTick = session.combat.tick;
          lastPhase = session.phase;
          setHud(toHudSnapshot(session.combat));
          setSessionView(toSessionView(session));
        }
      },
      (alpha) => renderer.render(sessionRef.current.combat, alpha),
    );

    input.connect();
    loop.start();

    return () => {
      loop.stop();
      input.disconnect();
      renderer.dispose();
    };
  }, []);

  const chooseReward = (
    rewardId: string,
    weaponSlot: WeaponSlot = 'secondary',
  ) => {
    const session = selectReward(sessionRef.current, rewardId, weaponSlot);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback(`戦闘${session.run.encounterIndex + 1}を開始。`);
  };

  const restart = () => {
    const session = restartGameSession(sessionRef.current);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback('新しいSeedでランを開始しました。');
  };

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} aria-label="戦闘フィールド" />
      <section className="hud" aria-label="車両状態">
        <strong>
          Kaboom Caravan / Battle {sessionView.encounterIndex + 1} of{' '}
          {MVP_ENCOUNTERS.length}
        </strong>
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
          name={`${sessionView.primaryWeaponName} MAIN`}
          cooldown={hud.primaryCooldown}
        />
        <WeaponStatus
          keyLabel="E / SHIFT"
          name={`${sessionView.secondaryWeaponName} SUB`}
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
      {sessionView.phase === 'reward' && (
        <RewardPanel
          choices={sessionView.rewardChoices}
          moduleNames={sessionView.moduleNames}
          onChoose={chooseReward}
        />
      )}
      {(sessionView.phase === 'victory' || sessionView.phase === 'defeat') && (
        <section className="result-panel" role="dialog" aria-modal="true">
          <strong>
            {sessionView.phase === 'victory' ? 'RUN COMPLETE!' : 'DEFEAT'}
          </strong>
          <span>
            {sessionView.phase === 'victory'
              ? 'カワイイ・フォートレスを撃破しました。'
              : '車両または前線が崩壊しました。'}
          </span>
          <button type="button" onClick={restart}>
            新しいラン
          </button>
        </section>
      )}
    </main>
  );
}

function RewardPanel({
  choices,
  moduleNames,
  onChoose,
}: {
  choices: RewardChoice[];
  moduleNames: string[];
  onChoose: (rewardId: string, weaponSlot?: WeaponSlot) => void;
}) {
  return (
    <section className="reward-panel" role="dialog" aria-modal="true">
      <header>
        <strong>戦闘報酬：1つ選択</strong>
        <span>
          Module {moduleNames.length}/4
          {moduleNames.length >= 4 ? '（次の取得で最古を交換）' : ''}
        </span>
      </header>
      <div className="reward-grid">
        {choices.map((choice) => (
          <article className="reward-card" key={choice.id}>
            <span className="reward-type">
              {choice.type === 'weapon' ? 'WEAPON' : 'MODULE'}
            </span>
            <strong>{choice.displayName}</strong>
            <p>{choice.description}</p>
            {choice.type === 'weapon' ? (
              <div className="reward-actions">
                <button
                  type="button"
                  onClick={() => onChoose(choice.id, 'primary')}
                >
                  主武器へ
                </button>
                <button
                  type="button"
                  onClick={() => onChoose(choice.id, 'secondary')}
                >
                  副武器へ
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => onChoose(choice.id)}>
                Module取得
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
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
