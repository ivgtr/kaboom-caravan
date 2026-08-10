import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { FixedStepLoop } from '../game/simulation/FixedStepLoop';
import { MVP_ENCOUNTERS } from '../game/data/runDefinitions';
import { WEAPON_DEFINITIONS } from '../game/data/weaponDefinitions';
import { MODULE_DEFINITIONS } from '../game/data/moduleDefinitions';
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
import { InputManager, type VirtualControl } from '../input/InputManager';
import { GameRenderer } from '../render/GameRenderer';
import { getEquipmentArt } from './equipmentAssets';

interface HudSnapshot {
  tick: number;
  position: number;
  hitPoints: number;
  maxHitPoints: number;
  heat: number;
  energy: number;
  ammo: number;
  enemies: number;
  rewardMultiplier: number;
  primaryCooldown: number;
  secondaryCooldown: number;
  skillCooldown: number;
  overheated: boolean;
}

interface SessionView {
  phase: SessionPhase;
  encounterIndex: number;
  encounterName: string;
  rewardChoices: RewardChoice[];
  primaryWeaponId: keyof typeof WEAPON_DEFINITIONS;
  secondaryWeaponId: keyof typeof WEAPON_DEFINITIONS;
  moduleNames: string[];
}

function toHudSnapshot(state: SimulationState): HudSnapshot {
  return {
    tick: state.tick,
    position: state.player.position,
    hitPoints: state.player.hitPoints,
    maxHitPoints: state.player.maxHitPoints,
    heat: state.player.heat,
    energy: state.player.energy,
    ammo: state.player.ammo,
    enemies: state.enemies.length,
    rewardMultiplier: state.frontline.rewardMultiplier,
    primaryCooldown: state.player.primaryCooldown,
    secondaryCooldown: state.player.secondaryCooldown,
    skillCooldown: state.player.skillCooldown,
    overheated: state.player.overheated,
  };
}

function toSessionView(session: GameSessionState): SessionView {
  const { build } = session.run;
  return {
    phase: session.phase,
    encounterIndex: session.run.encounterIndex,
    encounterName:
      MVP_ENCOUNTERS[session.run.encounterIndex]?.displayName ?? '戦闘完了',
    rewardChoices: session.rewardChoices,
    primaryWeaponId: build.primaryWeaponId,
    secondaryWeaponId: build.secondaryWeaponId,
    moduleNames: build.moduleIds.map(
      (id) => MODULE_DEFINITIONS[id].displayName,
    ),
  };
}

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [input] = useState(() => new InputManager());
  const [initialSession] = useState(() => createGameSession(1));
  const sessionRef = useRef(initialSession);
  const [hud, setHud] = useState(() => toHudSnapshot(initialSession.combat));
  const [sessionView, setSessionView] = useState(() =>
    toSessionView(initialSession),
  );
  const [feedback, setFeedback] = useState('戦闘開始');
  const [showClear, setShowClear] = useState(false);
  const debug = new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastSnapshotTick = -1;
    let lastPhase = sessionRef.current.phase;
    let clearTimer: number | undefined;
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
        if (phaseChanged && session.phase === 'reward') {
          setShowClear(true);
          clearTimer = window.setTimeout(() => setShowClear(false), 1200);
        }
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
      if (clearTimer) window.clearTimeout(clearTimer);
      loop.stop();
      input.disconnect();
      renderer.dispose();
    };
  }, [input]);

  const setControl = (control: VirtualControl, active: boolean) =>
    input.setVirtualControl(control, active);
  const bindControl = (control: VirtualControl) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setControl(control, true);
    },
    onPointerUp: () => setControl(control, false),
    onPointerCancel: () => setControl(control, false),
    onLostPointerCapture: () => setControl(control, false),
  });

  const chooseReward = (
    rewardId: string,
    weaponSlot: WeaponSlot = 'secondary',
  ) => {
    const session = selectReward(sessionRef.current, rewardId, weaponSlot);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback(`戦闘${session.run.encounterIndex + 1}を開始`);
  };
  const restart = () => {
    const session = restartGameSession(sessionRef.current);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback('新しいランを開始');
  };

  const combatVisible = sessionView.phase === 'combat';
  return (
    <main className={`game-shell phase-${sessionView.phase}`}>
      <canvas ref={canvasRef} aria-label="戦闘フィールド" />
      {combatVisible && (
        <>
          <section className="compact-hud" aria-label="車両耐久">
            <GameIcon name="hp" />
            <div>
              <strong>CARAVAN</strong>
              <progress value={hud.hitPoints} max={hud.maxHitPoints} />
            </div>
            <b>{Math.ceil(hud.hitPoints)}</b>
          </section>
          <section className="route-hud" aria-label="前線進行">
            <span>SAFE</span>
            <div className="battle-progress">
              {MVP_ENCOUNTERS.map((encounter, index) => (
                <i
                  className={
                    index < sessionView.encounterIndex
                      ? 'cleared'
                      : index === sessionView.encounterIndex
                        ? 'current'
                        : ''
                  }
                  key={encounter.id}
                />
              ))}
            </div>
            <span>DANGER</span>
            <b>
              BATTLE {sessionView.encounterIndex + 1}/10 · ×
              {hud.rewardMultiplier.toFixed(1)}
            </b>
          </section>
          <section className="enemy-chip">
            <GameIcon name="enemy" />
            <span>MONSTER</span>
            <strong>{hud.enemies}</strong>
          </section>
          <p className="combat-feedback" aria-live="polite">
            {feedback}
          </p>
          <section className="movement-controls" aria-label="移動操作">
            <ControlButton
              label="前進"
              className="move forward"
              {...bindControl('move-right')}
            >
              <GameIcon name="forward" />
              <kbd>D</kbd>
            </ControlButton>
            <ControlButton
              label="後退"
              className="move backward"
              {...bindControl('move-left')}
            >
              <GameIcon name="backward" />
              <kbd>A</kbd>
            </ControlButton>
          </section>
          <section className="weapon-controls" aria-label="武器操作">
            <ControlButton
              label="副武器"
              className="weapon sub"
              {...bindControl('secondary')}
            >
              <EquipmentGlyph id={sessionView.secondaryWeaponId} />
              <small>SUB</small>
              <Meter value={hud.secondaryCooldown} max={2.5} />
            </ControlButton>
            <ControlButton
              label="主武器"
              className={`weapon main ${hud.overheated ? 'overheat' : hud.primaryCooldown <= 0 ? 'ready' : ''}`}
              {...bindControl('primary')}
            >
              <EquipmentGlyph id={sessionView.primaryWeaponId} />
              <small>{hud.overheated ? 'OVERHEAT' : 'MAIN'}</small>
              <span className="ammo">
                <GameIcon name="ammo" />
                {hud.ammo}
              </span>
              <Meter
                value={hud.overheated ? hud.heat : hud.primaryCooldown}
                max={hud.overheated ? 100 : 2.5}
              />
            </ControlButton>
            <ControlButton
              label="緊急離脱"
              className="weapon escape"
              {...bindControl('escape')}
            >
              <GameIcon name="escape" />
              <small>ESC</small>
              <span className="energy">{Math.floor(hud.energy)}%</span>
              <Meter value={hud.skillCooldown} max={5} />
            </ControlButton>
          </section>
        </>
      )}
      {debug && (
        <aside className="debug-panel">
          tick {hud.tick} / position {hud.position.toFixed(1)} / heat{' '}
          {hud.heat.toFixed(0)}
        </aside>
      )}
      {sessionView.phase === 'reward' && !showClear && (
        <RewardPanel
          choices={sessionView.rewardChoices}
          moduleNames={sessionView.moduleNames}
          onChoose={chooseReward}
        />
      )}
      {showClear && (
        <section className="battle-clear" role="status">
          <strong>BATTLE CLEAR!</strong>
          <span>{sessionView.encounterName} 制圧完了</span>
        </section>
      )}
      {(sessionView.phase === 'victory' || sessionView.phase === 'defeat') && (
        <section className="result-panel" role="dialog" aria-modal="true">
          <strong>
            {sessionView.phase === 'victory' ? 'RUN COMPLETE!' : 'DEFEAT'}
          </strong>
          <span>
            {sessionView.phase === 'victory'
              ? 'カワイイ・フォートレスを撃破！'
              : 'キャラバンが停止しました'}
          </span>
          <button type="button" onClick={restart}>
            新しいラン
          </button>
        </section>
      )}
    </main>
  );
}

function ControlButton({
  children,
  label,
  className,
  ...events
}: { children: ReactNode; label: string; className: string } & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'
>) {
  return (
    <button
      type="button"
      className={`control-button ${className}`}
      aria-label={label}
      {...events}
    >
      {children}
    </button>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  const amount = Math.max(0, Math.min(1, value / max));
  return (
    <span
      className="control-meter"
      style={{ '--meter': `${amount * 360}deg` } as CSSProperties}
    />
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
        <div>
          <span>SALVAGE TIME!</span>
          <strong>欲しい装備をひとつ選ぼう</strong>
        </div>
        <b>MODULE {moduleNames.length}/4</b>
      </header>
      <div className="reward-grid">
        {choices.map((choice) => (
          <article
            className={`reward-card reward-${choice.type}`}
            key={choice.id}
          >
            <span className="reward-type">
              <GameIcon name={choice.type === 'weapon' ? 'weapon' : 'module'} />
              {choice.type.toUpperCase()}
            </span>
            <div className="equipment-visual">
              <EquipmentGlyph
                id={
                  choice.type === 'weapon' ? choice.weaponId : choice.moduleId
                }
              />
            </div>
            <h2>{choice.displayName}</h2>
            <p>{choice.description}</p>
            {choice.type === 'weapon' ? (
              <div className="reward-actions">
                <button onClick={() => onChoose(choice.id, 'primary')}>
                  MAINへ
                </button>
                <button onClick={() => onChoose(choice.id, 'secondary')}>
                  SUBへ
                </button>
              </div>
            ) : (
              <button onClick={() => onChoose(choice.id)}>装着する</button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function EquipmentGlyph({ id }: { id: string }) {
  const equipmentArt = getEquipmentArt(id);
  if (equipmentArt) {
    return <img className="equipment-art" src={equipmentArt} alt="" />;
  }
  const shape =
    id.includes('rocket') || id.includes('explosive')
      ? 'rocket'
      : id.includes('fan')
        ? 'fan'
        : id.includes('shield') || id.includes('armor')
          ? 'shield'
          : id.includes('railgun') ||
              id.includes('capacitor') ||
              id.includes('generator')
            ? 'energy'
            : id.includes('flame') || id.includes('heat')
              ? 'flame'
              : id.includes('radar')
                ? 'radar'
                : 'cannon';
  return (
    <svg
      className={`equipment-glyph ${shape}`}
      viewBox="0 0 160 100"
      aria-hidden="true"
    >
      <path className="body" d="M27 35h76l22 15-22 15H27Q14 50 27 35Z" />
      <path className="barrel" d="M92 43h55v14H92Z" />
      <circle cx="48" cy="50" r="17" />
      <path className="detail" d="M40 50h16M48 42v16M72 40h18v20H72Z" />
    </svg>
  );
}

function GameIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    hp: 'M12 38 4 29C-8 16 9-4 24 10 39-4 56 16 44 29L24 49Z',
    enemy: 'M7 16 16 7l8 8 8-8 9 9-4 26H11Z',
    ammo: 'M12 4h12l4 9v30H8V13Z',
    escape: 'M8 25h25l-8-8 7-7 20 20-20 20-7-7 8-8H8Z',
    forward: 'M8 14h22V4l22 22-22 22V38H8Z',
    backward: 'M52 14H30V4L8 26l22 22V38h22Z',
    weapon: 'M5 19h32l12 8-12 8H5Z',
    module: 'M9 9h38v38H9ZM2 17h7m38 0h7M2 29h7m38 0h7M2 41h7m38 0h7',
  };
  return (
    <svg
      className={`game-icon icon-${name}`}
      viewBox="0 0 56 56"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.module} />
    </svg>
  );
}

function describeCombatEvent(event: CombatEvent): string {
  switch (event.type) {
    case 'weapon-fired':
      return 'KABOOM!';
    case 'projectile-hit':
      return `${event.damage.toFixed(0)} DAMAGE!`;
    case 'enemy-killed':
      return 'MONSTER DOWN!';
    case 'vehicle-hit':
      return `OUCH! -${event.damage.toFixed(0)}`;
    case 'overheated':
      return 'OVERHEAT!';
    case 'cooled':
      return 'READY!';
    case 'skill-activated':
      return 'EMERGENCY ESCAPE!';
    case 'enemy-attacked':
      return 'INCOMING!';
    case 'wave-started':
      return 'WAVE START!';
    case 'wave-completed':
      return 'WAVE CLEAR!';
    case 'boss-phase-changed':
      return `BOSS PHASE ${event.phase}`;
    case 'combat-ended':
      return event.result === 'victory' ? 'BATTLE CLEAR!' : 'CARAVAN DOWN';
  }
}
