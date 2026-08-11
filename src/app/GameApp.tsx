import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { FixedStepLoop } from '../game/simulation/FixedStepLoop';
import { MODULE_SLOT_COUNT } from '../game/build/build';
import { MVP_ENCOUNTERS } from '../game/data/runDefinitions';
import type { ModuleId, WeaponId } from '../game/data/ids';
import { WEAPON_DEFINITIONS } from '../game/data/weaponDefinitions';
import { MODULE_DEFINITIONS } from '../game/data/moduleDefinitions';
import {
  generateRewardChoices,
  type RewardChoice,
} from '../game/reward/rewardSystem';
import {
  createGameSession,
  createGarageSession,
  rerollRewards,
  restartGameSession,
  selectRoute,
  selectReward,
  startGameSession,
  stepGameSession,
  type GameSessionState,
  type SessionPhase,
  type WeaponSlot,
} from '../game/session/GameSession';
import {
  LOADOUT_DEFINITIONS,
  LOADOUT_IDS,
  type LoadoutId,
} from '../game/data/loadoutDefinitions';
import type { RouteChoice } from '../game/data/routeDefinitions';
import type { WeaponLevel } from '../game/build/weaponUpgrade';
import type { CombatEvent, SimulationState } from '../game/simulation/types';
import { InputManager, type VirtualControl } from '../input/InputManager';
import { GameRenderer } from '../render/GameRenderer';
import { runtimeAssetUrl } from '../runtimeAssets';
import { getEquipmentArt } from './equipmentAssets';
import { AudioDirector } from '../audio/AudioDirector';
import {
  loadMetaProgression,
  recordCompletedRun,
  type MetaProgression,
} from '../game/progression/metaProgression';

const UI_ASSET_STYLES = {
  '--hud-ornament-image': `url("${runtimeAssetUrl('assets/ui/ui_hud_ornament_v001.png')}")`,
  '--control-frame-image': `url("${runtimeAssetUrl('assets/ui/ui_control_frame_v001.png')}")`,
  '--battle-clear-frame-image': `url("${runtimeAssetUrl('assets/ui/ui_battle_clear_frame_v001.png')}")`,
  '--reward-frame-image': `url("${runtimeAssetUrl('assets/ui/ui_reward_frame_v001.png')}")`,
} as CSSProperties;

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
  parryWindowSeconds: number;
  overheated: boolean;
  treasureCollected: number;
}

interface SessionView {
  phase: SessionPhase;
  encounterIndex: number;
  encounterName: string;
  rewardChoices: RewardChoice[];
  primaryWeaponId: keyof typeof WEAPON_DEFINITIONS;
  secondaryWeaponId: keyof typeof WEAPON_DEFINITIONS;
  moduleIds: ModuleId[];
  weaponLevels: Partial<Record<WeaponId, WeaponLevel>>;
  treasureCollected: number;
  lastEncounterTreasure: number;
  rewardRerolls: number;
  routeChoices: RouteChoice[];
  loadoutId: LoadoutId;
  enemiesDefeated: number;
  parries: number;
  damageDealt: number;
  elapsedCombatTicks: number;
  lastEncounterTicks: number;
}

function formatTimeScore(ticks: number): string {
  const centiseconds = Math.floor((ticks * 100) / 60);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const fraction = centiseconds % 100;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
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
    parryWindowSeconds: state.player.parryWindowSeconds,
    overheated: state.player.overheated,
    treasureCollected: state.treasureCollected,
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
    moduleIds: [...build.moduleIds],
    weaponLevels: { ...build.weaponLevels },
    treasureCollected: session.run.treasureCollected,
    lastEncounterTreasure: session.run.lastEncounterTreasure,
    rewardRerolls: session.run.rewardRerolls,
    routeChoices: session.routeChoices,
    loadoutId: session.run.loadoutId,
    enemiesDefeated: session.run.enemiesDefeated,
    parries: session.run.parries,
    damageDealt: session.run.damageDealt,
    elapsedCombatTicks: session.run.elapsedCombatTicks,
    lastEncounterTicks: session.run.lastEncounterTicks,
  };
}

function createInitialGameSession(): GameSessionState {
  const parameters = new URLSearchParams(window.location.search);
  const session =
    parameters.has('quickStart') || parameters.has('debug')
      ? createGameSession(1)
      : createGarageSession(1);
  const rewardPreview = parameters.get('rewardPreview');
  if (
    !parameters.has('debug') ||
    (rewardPreview !== 'full-modules' && rewardPreview !== 'weapon-slot')
  ) {
    return session;
  }

  if (rewardPreview === 'full-modules') {
    session.run.build.moduleIds = [
      'cooling-fan',
      'generator',
      'ammo-box',
      'armor',
    ];
  }
  session.combat.build = structuredClone(session.run.build);
  session.phase = 'reward';
  for (let rerollIndex = 0; rerollIndex < 20; rerollIndex += 1) {
    const choices = generateRewardChoices(
      session.run.seed,
      session.run.encounterIndex,
      session.run.build,
      1,
      0,
      rerollIndex,
    );
    session.rewardChoices = choices;
    if (
      rewardPreview !== 'weapon-slot' ||
      choices.some((choice) => choice.type === 'weapon' && !choice.isUpgrade)
    ) {
      break;
    }
  }
  return session;
}

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [input] = useState(() => new InputManager());
  const [audio] = useState(() => new AudioDirector());
  const [muted, setMuted] = useState(false);
  const [meta, setMeta] = useState(loadMetaProgression);
  const recordedRunRef = useRef<string | undefined>(undefined);
  const [initialSession] = useState(createInitialGameSession);
  const sessionRef = useRef(initialSession);
  const [hud, setHud] = useState(() => toHudSnapshot(initialSession.combat));
  const [sessionView, setSessionView] = useState(() =>
    toSessionView(initialSession),
  );
  const [feedback, setFeedback] = useState('戦闘開始');
  const [showClear, setShowClear] = useState(false);
  const [renderError, setRenderError] = useState<string>();
  const debug = new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastSnapshotTick = -1;
    let lastPhase = sessionRef.current.phase;
    let lastHandledEvents: readonly CombatEvent[] | undefined;
    let clearTimer: number | undefined;
    let renderer: GameRenderer;
    try {
      renderer = new GameRenderer(canvas);
    } catch {
      const errorTimer = window.setTimeout(
        () =>
          setRenderError(
            'このブラウザでは戦闘画面を初期化できませんでした。Canvas 2Dを有効にして再読み込みしてください。',
          ),
        0,
      );
      return () => window.clearTimeout(errorTimer);
    }
    const unlockAudio = () => {
      void audio.unlock().then(() => audio.setPhase(sessionRef.current.phase));
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    const loop = new FixedStepLoop(
      (deltaSeconds) => {
        const session = stepGameSession(
          sessionRef.current,
          input.readCommand(),
          deltaSeconds,
        );
        sessionRef.current = session;
        const phaseChanged = session.phase !== lastPhase;
        if (phaseChanged) audio.setPhase(session.phase);
        if (session.combat.events !== lastHandledEvents) {
          lastHandledEvents = session.combat.events;
          audio.handleEvents(session.combat.events);
          const feedbackEvent =
            session.combat.events.find(
              ({ type }) => type === 'attack-parried',
            ) ??
            session.combat.events.find(
              ({ type }) => type === 'enemy-attack-windup',
            ) ??
            session.combat.events.at(-1);
          if (feedbackEvent) setFeedback(describeCombatEvent(feedbackEvent));
        }
        if (phaseChanged && session.phase === 'reward') {
          setShowClear(true);
          clearTimer = window.setTimeout(() => setShowClear(false), 1200);
        }
        if (
          phaseChanged &&
          (session.phase === 'victory' || session.phase === 'defeat')
        ) {
          const recordKey = `${session.run.seed}:${session.phase}`;
          if (recordedRunRef.current !== recordKey) {
            recordedRunRef.current = recordKey;
            setMeta((current) => recordCompletedRun(current, session));
          }
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
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      audio.dispose();
    };
  }, [audio, input]);

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
    audio.playUiConfirm();
    const session = selectReward(sessionRef.current, rewardId, weaponSlot);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback(`戦闘${session.run.encounterIndex + 1}を開始`);
  };
  const restart = () => {
    audio.playUiConfirm();
    const session = restartGameSession(sessionRef.current);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback('新しいランを開始');
  };
  const reroll = () => {
    audio.playUiConfirm();
    const session = rerollRewards(sessionRef.current);
    sessionRef.current = session;
    setSessionView(toSessionView(session));
    setFeedback('SALVAGE REROLL!');
  };
  const startRun = (loadoutId: LoadoutId) => {
    audio.playUiConfirm();
    const session = startGameSession(sessionRef.current, loadoutId);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback('キャラバン出撃！');
  };
  const chooseRoute = (routeId: string) => {
    audio.playUiConfirm();
    const session = selectRoute(sessionRef.current, routeId);
    sessionRef.current = session;
    setHud(toHudSnapshot(session.combat));
    setSessionView(toSessionView(session));
    setFeedback('新しい区画へ進入');
  };

  const combatVisible = sessionView.phase === 'combat';
  return (
    <main
      className={`game-shell phase-${renderError ? 'error' : sessionView.phase}`}
      style={UI_ASSET_STYLES}
    >
      <canvas ref={canvasRef} aria-label="戦闘フィールド" />
      {renderError ? (
        <section className="render-error" role="alert">
          <strong>DISPLAY ERROR</strong>
          <p>{renderError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </section>
      ) : (
        combatVisible && (
          <>
            <section className="compact-hud" aria-label="車両耐久">
              <GameIcon name="hp" />
              <div>
                <strong>CARAVAN</strong>
                <progress value={hud.hitPoints} max={hud.maxHitPoints} />
              </div>
              <b>{Math.ceil(hud.hitPoints)}</b>
            </section>
            <section className="run-hud" aria-label="戦闘進行">
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
              <b>
                <span>BATTLE {sessionView.encounterIndex + 1}/10</span>
                <em>SALVAGE ×{hud.rewardMultiplier.toFixed(1)}</em>
              </b>
            </section>
            <section className="enemy-chip">
              <GameIcon name="enemy" />
              <span>MONSTER</span>
              <strong>{hud.enemies}</strong>
            </section>
            <section className="treasure-chip" aria-label="回収したお宝">
              <span>✦</span>
              <b>TREASURE</b>
              <strong>{hud.treasureCollected}</strong>
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
                <b className="weapon-level">
                  LV.
                  {sessionView.weaponLevels[sessionView.secondaryWeaponId] ?? 1}
                </b>
                <kbd>E</kbd>
                <Meter value={hud.secondaryCooldown} max={2.5} />
              </ControlButton>
              <ControlButton
                label="主武器"
                className={`weapon main ${hud.overheated ? 'overheat' : hud.primaryCooldown <= 0 ? 'ready' : ''}`}
                {...bindControl('primary')}
              >
                <EquipmentGlyph id={sessionView.primaryWeaponId} />
                <small>{hud.overheated ? 'OVERHEAT' : 'MAIN'}</small>
                <b className="weapon-level">
                  LV.
                  {sessionView.weaponLevels[sessionView.primaryWeaponId] ?? 1}
                </b>
                <kbd>SPACE</kbd>
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
                label="迎撃パリィ"
                className={`weapon escape parry ${hud.parryWindowSeconds > 0 ? 'active' : ''}`}
                {...bindControl('escape')}
              >
                <GameIcon name="escape" />
                <small>PARRY</small>
                <kbd>Q</kbd>
                <span className="energy">{Math.floor(hud.energy)}%</span>
                <Meter
                  value={
                    hud.parryWindowSeconds > 0
                      ? hud.parryWindowSeconds
                      : hud.skillCooldown
                  }
                  max={hud.parryWindowSeconds > 0 ? 0.42 : 4}
                />
              </ControlButton>
            </section>
          </>
        )
      )}
      {debug && (
        <aside className="debug-panel">
          tick {hud.tick} / position {hud.position.toFixed(1)} / heat{' '}
          {hud.heat.toFixed(0)}
        </aside>
      )}
      <button
        type="button"
        className="audio-toggle"
        aria-label={muted ? '音をオン' : '音をオフ'}
        onClick={() => {
          const next = !muted;
          setMuted(next);
          audio.setMuted(next);
        }}
      >
        {muted ? 'SOUND OFF' : 'SOUND ON'}
      </button>
      {sessionView.phase === 'garage' && (
        <GaragePanel meta={meta} onStart={startRun} />
      )}
      {sessionView.phase === 'reward' && !showClear && (
        <RewardPanel
          choices={sessionView.rewardChoices}
          moduleIds={sessionView.moduleIds}
          primaryWeaponId={sessionView.primaryWeaponId}
          secondaryWeaponId={sessionView.secondaryWeaponId}
          rerolls={sessionView.rewardRerolls}
          onChoose={chooseReward}
          onReroll={reroll}
        />
      )}
      {showClear && (
        <section className="battle-clear" role="status">
          <strong>BATTLE CLEAR!</strong>
          <span>{sessionView.encounterName} 制圧完了</span>
          <em>TREASURE +{sessionView.lastEncounterTreasure}</em>
          <b>TIME {formatTimeScore(sessionView.lastEncounterTicks)}</b>
        </section>
      )}
      {sessionView.phase === 'route' && (
        <RoutePanel choices={sessionView.routeChoices} onChoose={chooseRoute} />
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
          <b className="run-time-score">
            {sessionView.phase === 'victory' ? 'RUN TIME' : 'SURVIVAL TIME'}{' '}
            {formatTimeScore(sessionView.elapsedCombatTicks)}
          </b>
          <div className="run-record-grid">
            <span>
              MONSTERS <b>{sessionView.enemiesDefeated}</b>
            </span>
            <span>
              PARRIES <b>{sessionView.parries}</b>
            </span>
            <span>
              DAMAGE <b>{Math.round(sessionView.damageDealt)}</b>
            </span>
            <span>
              TREASURE <b>{sessionView.treasureCollected}</b>
            </span>
          </div>
          <div className="result-build" aria-label="最終ビルド">
            <span>FINAL BUILD</span>
            <b>
              MAIN {WEAPON_DEFINITIONS[sessionView.primaryWeaponId].displayName}{' '}
              LV.{sessionView.weaponLevels[sessionView.primaryWeaponId] ?? 1}
            </b>
            <b>
              SUB{' '}
              {WEAPON_DEFINITIONS[sessionView.secondaryWeaponId].displayName}{' '}
              LV.{sessionView.weaponLevels[sessionView.secondaryWeaponId] ?? 1}
            </b>
            <small>
              {sessionView.moduleIds.length > 0
                ? sessionView.moduleIds
                    .map((id) => MODULE_DEFINITIONS[id].displayName)
                    .join(' / ')
                : 'MODULEなし'}
            </small>
          </div>
          {meta.bestVictoryTicks !== undefined && (
            <small>BEST RUN {formatTimeScore(meta.bestVictoryTicks)}</small>
          )}
          <button type="button" onClick={restart}>
            新しいラン
          </button>
        </section>
      )}
    </main>
  );
}

function GaragePanel({
  meta,
  onStart,
}: {
  meta: MetaProgression;
  onStart: (id: LoadoutId) => void;
}) {
  return (
    <section className="garage-panel" role="dialog" aria-modal="true">
      <header>
        <span>KAWAII GARAGE</span>
        <strong>出撃するキャラバンを選ぼう</strong>
      </header>
      <div className="garage-loadouts">
        {LOADOUT_IDS.map((id) => {
          const loadout = LOADOUT_DEFINITIONS[id];
          const unlocked = meta.unlockedLoadouts.includes(id);
          return (
            <button
              type="button"
              key={id}
              disabled={!unlocked}
              onClick={() => onStart(id)}
            >
              <div className="garage-weapon-pair">
                <EquipmentGlyph id={loadout.primaryWeaponId} />
                <EquipmentGlyph id={loadout.secondaryWeaponId} />
              </div>
              <strong>{loadout.displayName}</strong>
              <span>{loadout.tagline}</span>
              <small>
                MAIN {WEAPON_DEFINITIONS[loadout.primaryWeaponId].displayName}
                {' / '}SUB{' '}
                {WEAPON_DEFINITIONS[loadout.secondaryWeaponId].displayName}
              </small>
              {!unlocked && (
                <em>LOCKED — Victory またはTreasure累計15で解禁</em>
              )}
            </button>
          );
        })}
      </div>
      <footer>
        <span>
          RUNS {meta.totalRuns} / TOTAL TREASURE {meta.totalTreasure}
        </span>
        {meta.history[0] && (
          <small>
            LAST {meta.history[0].result.toUpperCase()} —{' '}
            {LOADOUT_DEFINITIONS[meta.history[0].loadoutId].displayName} /{' '}
            {formatTimeScore(meta.history[0].elapsedCombatTicks)} / TREASURE{' '}
            {meta.history[0].treasureCollected}
          </small>
        )}
      </footer>
    </section>
  );
}

function RoutePanel({
  choices,
  onChoose,
}: {
  choices: RouteChoice[];
  onChoose: (id: string) => void;
}) {
  return (
    <section className="route-panel" role="dialog" aria-modal="true">
      <header>
        <span>CHOOSE THE ROAD</span>
        <strong>次の進行先を選ぼう</strong>
      </header>
      <div>
        {choices.map((choice) => (
          <button
            type="button"
            className={`route-${choice.accent}`}
            key={choice.id}
            onClick={() => onChoose(choice.id)}
          >
            <i>
              {choice.type === 'elite'
                ? '⚠'
                : choice.type === 'repair'
                  ? '✚'
                  : '✦'}
            </i>
            <strong>{choice.displayName}</strong>
            <span>{choice.description}</span>
          </button>
        ))}
      </div>
    </section>
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
  moduleIds,
  primaryWeaponId,
  secondaryWeaponId,
  rerolls,
  onChoose,
  onReroll,
}: {
  choices: RewardChoice[];
  moduleIds: ModuleId[];
  primaryWeaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  rerolls: number;
  onChoose: (rewardId: string, weaponSlot?: WeaponSlot) => void;
  onReroll: () => void;
}) {
  const [pendingWeapon, setPendingWeapon] = useState<
    Extract<RewardChoice, { type: 'weapon' }> | undefined
  >();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<WeaponSlot>('primary');
  const cardButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const slotButtonRefs = useRef<Record<WeaponSlot, HTMLButtonElement | null>>({
    primary: null,
    secondary: null,
  });
  const replacedModuleId =
    moduleIds.length >= MODULE_SLOT_COUNT ? moduleIds[0] : undefined;
  const replacedModuleName = replacedModuleId
    ? MODULE_DEFINITIONS[replacedModuleId].displayName
    : undefined;

  const beginEquip = useCallback(
    (choice: RewardChoice) => {
      if (choice.type === 'weapon') {
        if (choice.isUpgrade) {
          onChoose(choice.id);
          return;
        }
        setSelectedSlot('primary');
        setPendingWeapon(choice);
        return;
      }
      onChoose(choice.id);
    },
    [onChoose],
  );

  const focusCard = useCallback(
    (index: number) => {
      if (choices.length === 0) return;
      const nextIndex = (index + choices.length) % choices.length;
      setSelectedIndex(nextIndex);
      cardButtonRefs.current[nextIndex]?.focus();
    },
    [choices.length],
  );

  const focusSlot = useCallback((slot: WeaponSlot) => {
    setSelectedSlot(slot);
    slotButtonRefs.current[slot]?.focus();
  }, []);

  const closeSlotPicker = useCallback(() => {
    cardButtonRefs.current[selectedIndex]?.focus();
    setPendingWeapon(undefined);
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const digitMatch = /^(?:Digit|Numpad)([1-3])$/.exec(event.code);
      const digitIndex = digitMatch ? Number(digitMatch[1]) - 1 : undefined;

      if (pendingWeapon) {
        if (
          event.code === 'ArrowLeft' ||
          event.code === 'KeyA' ||
          digitIndex === 0
        ) {
          event.preventDefault();
          focusSlot('primary');
          return;
        }
        if (
          event.code === 'ArrowRight' ||
          event.code === 'KeyD' ||
          digitIndex === 1
        ) {
          event.preventDefault();
          focusSlot('secondary');
          return;
        }
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          if (!event.repeat) onChoose(pendingWeapon.id, selectedSlot);
          return;
        }
        if (event.code === 'Escape') {
          event.preventDefault();
          closeSlotPicker();
        }
        return;
      }

      if (digitIndex !== undefined && choices[digitIndex]) {
        event.preventDefault();
        setSelectedIndex(digitIndex);
        if (!event.repeat) beginEquip(choices[digitIndex]);
        return;
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        focusCard(selectedIndex - 1);
        return;
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        focusCard(selectedIndex + 1);
        return;
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        const choice = choices[selectedIndex];
        if (choice && !event.repeat) beginEquip(choice);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    beginEquip,
    choices,
    closeSlotPicker,
    focusCard,
    focusSlot,
    onChoose,
    pendingWeapon,
    selectedIndex,
    selectedSlot,
  ]);

  return (
    <section className="reward-panel" role="dialog" aria-modal="true">
      <header>
        <div>
          <span>SALVAGE TIME!</span>
          <strong>欲しい装備をひとつ選ぼう</strong>
          <small className="reward-keyboard-hint">
            A D / ← → + SPACE / 1・2・3
          </small>
        </div>
        <b>
          MODULE {moduleIds.length}/{MODULE_SLOT_COUNT}
        </b>
        <button
          className="reward-reroll"
          type="button"
          disabled={rerolls <= 0}
          onClick={onReroll}
        >
          REROLL ×{rerolls}
        </button>
      </header>
      <div className="reward-grid">
        {choices.map((choice, index) => (
          <article
            className={`reward-card reward-${choice.type} rarity-${choice.rarity}${choice.type === 'weapon' && choice.isUpgrade ? ' reward-upgrade' : ''}${selectedIndex === index ? ' selected' : ''}`}
            key={choice.id}
          >
            <span className="reward-type">
              <GameIcon name={choice.type === 'weapon' ? 'weapon' : 'module'} />
              {choice.type.toUpperCase()}
            </span>
            <span className="reward-rarity">{choice.rarity.toUpperCase()}</span>
            <kbd className="reward-shortcut">{index + 1}</kbd>
            <div className="equipment-visual">
              <EquipmentGlyph
                id={
                  choice.type === 'weapon' ? choice.weaponId : choice.moduleId
                }
              />
            </div>
            <h2>{choice.displayName}</h2>
            {choice.type === 'weapon' && (
              <strong className="reward-weapon-level">
                {choice.isUpgrade
                  ? `LV.${choice.currentLevel} → LV.${choice.nextLevel}`
                  : `NEW / LV.${choice.nextLevel}`}
              </strong>
            )}
            <p>{choice.description}</p>
            <button
              className="reward-card-select"
              type="button"
              aria-label={`${choice.displayName}を選択${choice.type === 'module' && replacedModuleName ? `、${replacedModuleName}と交換` : ''}`}
              aria-current={selectedIndex === index ? 'true' : undefined}
              ref={(element) => {
                cardButtonRefs.current[index] = element;
              }}
              onClick={() => {
                setSelectedIndex(index);
                beginEquip(choice);
              }}
              onFocus={() => setSelectedIndex(index)}
            >
              <span
                className={`reward-card-action${choice.type === 'module' && replacedModuleName ? ' has-swap' : ''}`}
              >
                {choice.type === 'weapon' && choice.isUpgrade ? (
                  <small>POWER UP</small>
                ) : choice.type === 'module' && replacedModuleName ? (
                  <small className="reward-module-swap">
                    ↻ {replacedModuleName}と交換
                  </small>
                ) : (
                  <small>SELECT</small>
                )}
                {choice.type === 'weapon' && choice.isUpgrade
                  ? '強化する'
                  : '選択する'}
              </span>
            </button>
          </article>
        ))}
      </div>
      {pendingWeapon && (
        <section className="slot-picker" aria-label="武器の装着先を選択">
          <div className="slot-picker-visual">
            <EquipmentGlyph id={pendingWeapon.weaponId} />
          </div>
          <div className="slot-picker-copy">
            <span>WEAPON SLOT</span>
            <strong>{pendingWeapon.displayName}</strong>
            <p>どちらの操作ボタンへ装着しますか？</p>
            <small>
              CURRENT: MAIN {WEAPON_DEFINITIONS[primaryWeaponId].displayName} /
              SUB {WEAPON_DEFINITIONS[secondaryWeaponId].displayName}
            </small>
          </div>
          <div className="slot-picker-actions">
            <button
              className={selectedSlot === 'primary' ? 'selected' : undefined}
              type="button"
              ref={(element) => {
                slotButtonRefs.current.primary = element;
              }}
              onFocus={() => setSelectedSlot('primary')}
              onClick={() => onChoose(pendingWeapon.id, 'primary')}
            >
              <small>主武器</small>
              <span>MAIN</span>
              <kbd>1</kbd>
            </button>
            <button
              className={selectedSlot === 'secondary' ? 'selected' : undefined}
              type="button"
              ref={(element) => {
                slotButtonRefs.current.secondary = element;
              }}
              onFocus={() => setSelectedSlot('secondary')}
              onClick={() => onChoose(pendingWeapon.id, 'secondary')}
            >
              <small>副武器</small>
              <span>SUB</span>
              <kbd>2</kbd>
            </button>
          </div>
          <button
            className="slot-picker-cancel"
            type="button"
            onClick={closeSlotPicker}
          >
            戻る
          </button>
        </section>
      )}
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
    escape:
      'M28 3 49 11v15c0 14-9 23-21 28C16 49 7 40 7 26V11Zm0 9-12 5v9c0 8 4 14 12 18 8-4 12-10 12-18v-9Z',
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
    case 'loot-dropped':
      return 'TREASURE DROP!';
    case 'loot-collected':
      return `SALVAGE +${event.value}`;
    case 'vehicle-hit':
      return `OUCH! -${event.damage.toFixed(0)}`;
    case 'overheated':
      return 'OVERHEAT!';
    case 'cooled':
      return 'READY!';
    case 'skill-activated':
      return 'PARRY READY!';
    case 'attack-parried':
      return `PERFECT PARRY! ${event.counterDamage} COUNTER`;
    case 'enemy-attack-windup':
      return 'WATCH OUT!';
    case 'enemy-contact-released':
      return 'IMPACT!';
    case 'enemy-attacked':
      return 'INCOMING!';
    case 'enemy-projectile-fired':
      return 'INCOMING!';
    case 'enemy-projectile-hit':
      return `${event.damage.toFixed(0)} DAMAGE!`;
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
