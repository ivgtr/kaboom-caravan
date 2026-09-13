import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ARMY_LIMIT,
  BASE_HP,
  PROFILES,
  RELICS,
  STAGES,
  STEP,
  TROOPS,
  type Relic,
} from '../../game/siege/definitions';
import {
  armySize,
  chooseRelic,
  createSiegeRun,
  deployBlock,
  income,
  investmentCost,
  stepSiege,
  troopProfile,
  wallet,
  type SiegeCommand,
  type SiegeState,
  type Unit,
} from '../../game/siege/simulation';
import { CombatPauseController } from '../../input/CombatPauseController';
import { runtimeAssetUrl } from '../../runtimeAssets';
import {
  requestImmersiveFullscreen,
  useImmersiveViewport,
} from '../ImmersiveShell';
import { SiegeAudio } from './audio';
import './siege.css';

const freshSeed = () => Math.floor(Math.random() * 0xffffffff) || 1;
function initialState(): SiegeState {
  const value = new URLSearchParams(window.location.search).get('seed');
  return createSiegeRun(value === null ? freshSeed() : Number(value));
}
function Modal({
  open,
  title,
  children,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onCancel?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="siege-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onCancel?.();
      }}
    >
      {children}
    </dialog>
  );
}
function Actor({ unit }: { unit: Unit }) {
  const isAlly = unit.side === 'ally';
  return (
    <div
      className={`siege-actor ${unit.side} kind-${unit.kind}${unit.windup > 0 ? ' is-winding' : ''}${unit.flash > 0 ? ' is-hit' : ''}${unit.stagger > 0 ? ' is-staggered' : ''}`}
      style={{ left: `${unit.x}%`, '--rank': unit.id % 3 } as CSSProperties}
      title={`${unit.name} ${Math.ceil(unit.hp)}/${unit.maxHp}`}
    >
      <div className="siege-unit-meter">
        <i style={{ width: `${Math.max(0, unit.hp / unit.maxHp) * 100}%` }} />
      </div>
      {unit.kind === 'commander' && (
        <b className="siege-commander-label">
          {unit.windup > 0 ? '大攻撃！' : '守備隊長'}
        </b>
      )}
      <div className="siege-unit-body">
        <img src={runtimeAssetUrl(unit.art)} alt="" draggable={false} />
        {isAlly && <span className="siege-wheels" />}
      </div>
      {unit.windup > 0 && (
        <span className="siege-aim" aria-hidden="true">
          !
        </span>
      )}
    </div>
  );
}
function Battlefield({ state }: { state: SiegeState }) {
  const cannon = state.effects.some((e) => e.type === 'cannon');
  const allyFront = Math.max(
    13,
    ...state.units.filter((u) => u.side === 'ally').map((u) => u.x),
  );
  const enemyFront = Math.min(
    87,
    ...state.units.filter((u) => u.side === 'enemy').map((u) => u.x),
  );
  return (
    <section
      className={`siege-field${cannon ? ' is-cannon' : ''}`}
      aria-label="左の母艦から出撃し、右の敵拠点を攻め落とす戦場"
    >
      <div className="siege-horizon" aria-hidden="true" />
      <div className="siege-lane" aria-hidden="true" />
      <div
        className="siege-front"
        style={{ left: `${(allyFront + enemyFront) / 2}%` }}
        aria-hidden="true"
      >
        <span>FRONT</span>
      </div>
      <div className="siege-base ally-base">
        <span>CARAVAN</span>
        <img
          src={runtimeAssetUrl('assets/world/veh_player_base_v001.png')}
          alt="味方の母艦"
        />
      </div>
      <div
        className={`siege-base enemy-base${state.counterattack === 'warning' ? ' is-warning' : ''}`}
      >
        <span>{state.stage === 5 ? 'FINAL FORT' : 'ENEMY FORT'}</span>
        <img
          src={runtimeAssetUrl('assets/world/enm_kawaii_fortress_v001.png')}
          alt="敵拠点"
        />
      </div>
      {state.units.map((unit) => (
        <Actor key={unit.id} unit={unit} />
      ))}
      {state.effects
        .filter((e) => e.type !== 'cannon')
        .map((e) => (
          <i
            key={e.id}
            className={`siege-fx fx-${e.type}`}
            style={{ left: `${e.x}%` }}
            aria-hidden="true"
          />
        ))}
      {cannon && <div className="siege-cannon-beam" aria-hidden="true" />}
      <div className="siege-field-caption">
        壁を切らすな。火力を貯めろ。城を壊せ。
      </div>
    </section>
  );
}
export function SiegeApp() {
  const [view, setView] = useState(initialState);
  const state = useRef(view);
  const queue = useRef<SiegeCommand[]>([]);
  const audio = useRef<SiegeAudio | null>(null);
  const controller = useRef<CombatPauseController | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const viewport = useImmersiveViewport();
  const blocked = useRef(viewport.blocked);

  const choose = useCallback((id: Relic) => {
    if (blocked.current || document.hidden) return;
    void audio.current?.unlock();
    const next = chooseRelic(state.current, id);
    if (next === state.current) return;
    queue.current = [];
    state.current = next;
    setView(next);
  }, []);
  const issue = useCallback((command: SiegeCommand) => {
    if (
      pausedRef.current ||
      blocked.current ||
      document.hidden ||
      state.current.phase !== 'combat'
    )
      return;
    void audio.current?.unlock();
    if (queue.current.length < 12) queue.current.push(command);
  }, []);
  const restart = (seed: number) => {
    controller.current?.resume();
    queue.current = [];
    const next = createSiegeRun(seed);
    state.current = next;
    setView(next);
  };

  useEffect(() => {
    blocked.current = viewport.blocked;
    if (viewport.blocked) {
      queue.current = [];
      controller.current?.pause();
    }
  }, [viewport.blocked, view.phase]);

  useEffect(() => {
    audio.current?.setMuted(
      muted || paused || viewport.blocked || view.phase !== 'combat',
    );
  }, [muted, paused, viewport.blocked, view.phase]);

  useEffect(() => {
    const synth = new SiegeAudio();
    audio.current = synth;
    let last = 0;
    let accumulator = 0;
    let frame = 0;
    let lastEffect = 0;
    const pause = new CombatPauseController({
      canPause: () => state.current.phase === 'combat',
      onPause: () => {
        pausedRef.current = true;
        queue.current = [];
        accumulator = 0;
        last = 0;
        setPaused(true);
        synth.setMuted(true);
      },
      onResume: () => {
        if (blocked.current) {
          pause.pause();
          return;
        }
        pausedRef.current = false;
        accumulator = 0;
        last = 0;
        setPaused(false);
      },
    });
    controller.current = pause;
    pause.connect();
    const update = (now: number) => {
      if (
        !pausedRef.current &&
        !blocked.current &&
        !document.hidden &&
        state.current.phase === 'combat'
      ) {
        if (last) accumulator += Math.min((now - last) / 1000, 0.1);
        while (accumulator >= STEP && state.current.phase === 'combat') {
          state.current = stepSiege(state.current, queue.current.splice(0));
          accumulator -= STEP;
        }
        const effects = state.current.effects.filter((e) => e.id > lastEffect);
        const sound =
          effects.find((e) => e.type === 'cannon') ??
          effects.find((e) => e.type === 'blast') ??
          effects[0];
        if (sound) synth.play(sound.type);
        if (effects.length) lastEffect = Math.max(...effects.map((e) => e.id));
        setView(state.current);
      } else {
        accumulator = 0;
        queue.current = [];
      }
      if (state.current.phase === 'draft') lastEffect = 0;
      last = now;
      frame = requestAnimationFrame(update);
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        blocked.current ||
        pausedRef.current ||
        document.hidden
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.matches('input,textarea,select'))
      )
        return;
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(
        event.code,
      );
      if (
        state.current.phase === 'draft' &&
        index >= 0 &&
        state.current.choices[index]
      ) {
        event.preventDefault();
        choose(state.current.choices[index]!);
      } else if (state.current.phase === 'combat') {
        const command: SiegeCommand | undefined =
          index >= 0
            ? { type: 'deploy', troop: TROOPS[index]! }
            : event.code === 'KeyQ'
              ? { type: 'invest' }
              : event.code === 'KeyE'
                ? { type: 'cannon' }
                : undefined;
        if (command) {
          event.preventDefault();
          issue(command);
        }
      }
    };
    window.addEventListener('keydown', key);
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      pause.disconnect();
      synth.dispose();
      window.removeEventListener('keydown', key);
      queue.current = [];
    };
  }, [choose, issue]);

  const phase = view.phase;
  const stageTitle = STAGES[view.stage];
  const notice =
    view.noticeUntil > view.tick
      ? view.notice
      : '拠点耐久50%で守備隊長が反撃。母艦砲を温存する？';
  const enemyPresent = view.units.some((u) => u.side === 'enemy');
  return (
    <main
      className={`siege-shell${paused || phase !== 'combat' || viewport.blocked ? ' is-paused' : ''}`}
      style={
        {
          '--siege-background': `url("${runtimeAssetUrl('assets/world/env_background_integrated_2x1_v005.webp')}")`,
        } as CSSProperties
      }
      data-testid="siege-game"
      data-tick={view.tick}
      data-phase={phase}
    >
      <header className="siege-topbar">
        <div className="siege-brand">
          <b>
            KABOOM<span>CARAVAN</span>
          </b>
          <small>ROGUE SIEGE / 軍団攻城戦</small>
        </div>
        <div className="siege-stage-title">
          <span>FORT {String(view.stage + 1).padStart(2, '0')} / 06</span>
          <strong>{stageTitle}</strong>
        </div>
        <div className="siege-system">
          <button
            type="button"
            onClick={() => {
              void audio.current?.unlock();
              setMuted((value) => !value);
            }}
            aria-label={muted ? '音をオン' : '音をオフ'}
          >
            {muted ? '音 OFF' : '音 ON'}
          </button>
          <button
            type="button"
            disabled={phase !== 'combat'}
            onClick={() => controller.current?.pause()}
            aria-label="一時停止と操作ガイド"
          >
            Ⅱ <span>PAUSE</span>
          </button>
        </div>
      </header>
      <div className="siege-health-row">
        <label>
          母艦{' '}
          <b>
            {Math.ceil(view.baseHp)} / {BASE_HP}
          </b>
          <progress aria-label="母艦耐久" value={view.baseHp} max={BASE_HP} />
        </label>
        <div className="siege-wave">
          <b>{Math.floor(view.battleTick * STEP)}s</b>
          <span>
            次の増援{' '}
            {Math.max(0, Math.ceil((view.waveAt - view.battleTick) * STEP))}秒
          </span>
          <small>
            {view.nextWave.map((k) => PROFILES[k].role).join(' / ')}
          </small>
        </div>
        <label className="enemy-health">
          敵拠点{' '}
          <b>
            {Math.ceil(view.fortHp)} / {view.fortMaxHp}
          </b>
          <progress
            aria-label="敵拠点耐久"
            value={view.fortHp}
            max={view.fortMaxHp}
          />
        </label>
      </div>
      <div className="siege-notice" role="status" aria-live="polite">
        {notice}
      </div>
      <Battlefield state={view} />
      <div className="siege-build-strip">
        <b>BUILD</b>
        {view.relics.length ? (
          view.relics.map((id) => (
            <span key={id} title={RELICS[id].text}>
              {RELICS[id].tag}
            </span>
          ))
        ) : (
          <span>最初から戦い方を変える改造を選ぼう</span>
        )}
        <small>
          出撃中 {armySize(view)} / {ARMY_LIMIT}
        </small>
      </div>
      <footer className="siege-dock">
        <div className="siege-economy">
          <div className="siege-cash">
            <span>物資</span>
            <strong data-testid="siege-gold">{Math.floor(view.gold)}</strong>
            <small>
              / {wallet(view)}
              <br />+{income(view).toFixed(1)}/秒
            </small>
          </div>
          <button
            type="button"
            disabled={
              phase !== 'combat' ||
              view.economy >= 4 ||
              view.gold < investmentCost(view)
            }
            onClick={() => issue({ type: 'invest' })}
            aria-label="補給に増資"
          >
            <kbd>Q</kbd> 補給 Lv.{view.economy + 1}
            <b>{view.economy >= 4 ? 'MAX' : `増資 ${investmentCost(view)}`}</b>
          </button>
        </div>
        <div className="siege-troops">
          {TROOPS.map((troop, index) => {
            const p = troopProfile(view, troop);
            const block = deployBlock(view, troop);
            return (
              <button
                key={troop}
                type="button"
                className={`siege-troop-card card-${troop}`}
                disabled={Boolean(block)}
                onClick={() => issue({ type: 'deploy', troop })}
                aria-label={`${p.name}を出撃`}
                title={`${p.role} / 耐久${p.hp} 威力${p.damage} / ${block ?? '出撃可能'}`}
              >
                <kbd>{index + 1}</kbd>
                <span className="siege-price">{p.cost}</span>
                <img src={runtimeAssetUrl(p.art)} alt="" draggable={false} />
                <b>{p.name}</b>
                <small>
                  {block ?? (p.batch > 1 ? `${p.batch}台 出撃！` : p.role)}
                </small>
                <i
                  className="siege-recharge"
                  style={{
                    width: `${100 * Math.min(1, view.cooldowns[troop] / p.recharge)}%`,
                  }}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={`siege-cannon${view.cannon >= 100 ? ' is-ready' : ''}`}
          disabled={phase !== 'combat' || view.cannon < 100 || !enemyPresent}
          onClick={() => issue({ type: 'cannon' })}
          aria-label="母艦砲を発射"
        >
          <kbd>E</kbd>
          <span>母艦砲</span>
          <strong>
            {view.cannon >= 100 ? 'FIRE' : `${Math.floor(view.cannon)}%`}
          </strong>
          <small>押し戻す・溜め中断</small>
          <progress aria-label="母艦砲充填" value={view.cannon} max={100} />
        </button>
      </footer>
      <Modal
        open={phase === 'draft' && !viewport.blocked}
        title={view.stage === 0 ? '軍団の改造を選ぶ' : '勝利報酬の改造を選ぶ'}
      >
        <div className="siege-draft-heading">
          <span>
            ROGUE SIEGE /{' '}
            {view.stage === 0
              ? '遠征の最初から、壊れた軍団へ'
              : `拠点${view.stage} 陥落 → 次は ${stageTitle}`}
          </span>
          <h1>
            {view.stage === 0 ? (
              <>
                軍団をつくれ。
                <br />
                城を壊せ。
              </>
            ) : (
              <>
                勝った。その軍団を
                <br />
                もっと壊そう。
              </>
            )}
          </h1>
          <p>
            {view.stage === 0
              ? '自分で撃たない。物資で部隊を送り出す、全6拠点のローグライク攻城戦。'
              : '改造は重なり、遠征中ずっと残る。次戦前に母艦を100補修。部隊・物資・補給Lvはリセット。'}
          </p>
        </div>
        <div className="siege-draft-cards">
          {view.choices.map((id, index) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className={`siege-relic relic-${id}`}
            >
              <span>
                <kbd>{index + 1}</kbd> {RELICS[id].tag}
              </span>
              <img src={runtimeAssetUrl(RELICS[id].art)} alt="" />
              <h2>{RELICS[id].name}</h2>
              <p>{RELICS[id].text}</p>
              <b>この改造で出撃 →</b>
            </button>
          ))}
        </div>
        <div className="siege-draft-foot">
          <span>1〜4：部隊 / Q：増資 / E：母艦砲 / Esc：停止</span>
          <small>SEED {view.seed} ・遠征の途中保存なし</small>
        </div>
      </Modal>
      <Modal
        open={paused && !viewport.blocked && phase === 'combat'}
        title="一時停止中"
        onCancel={() => controller.current?.resume()}
      >
        <div className="siege-pause-content">
          <span>COMMAND PAUSED</span>
          <h1>一時停止中</h1>
          <p>
            母艦は動かしません。安い壁で前線を維持し、その後ろに火力を積んで、右側の敵拠点を壊してください。
          </p>
          <div className="siege-help">
            <p>
              <b>1〜4 / タップ</b>{' '}
              部隊を1回出撃。物資を消費し、再出撃待ちが発生。砲車は近距離に撃てないため、前衛で守る。
            </p>
            <p>
              <b>Q / 補給に増資</b>{' '}
              今出せる部隊を我慢し、自然収入と物資上限を増やす。
            </p>
            <p>
              <b>E / 母艦砲</b>{' '}
              全敵を押し戻して溜め攻撃を中断。敵拠点には当たらない。
            </p>
            <p>
              <b>敵拠点50%</b> 3秒後に守備隊長が反撃。90秒から増援が激化。
            </p>
          </div>
          {view.relics.map((id) => (
            <p key={id} className="siege-owned-relic">
              <b>{RELICS[id].name}</b> — {RELICS[id].text}
            </p>
          ))}
          <div className="siege-menu-actions">
            <button type="button" onClick={() => controller.current?.resume()}>
              戦闘を再開
            </button>
            {viewport.fullscreenAvailable && !viewport.fullscreen && (
              <button
                type="button"
                onClick={() => void requestImmersiveFullscreen()}
              >
                全画面表示
              </button>
            )}
          </div>
          <small>
            タブ離脱・縦持ちでも停止します。戻っただけでは再開しません。遠征の途中保存はありません。
          </small>
        </div>
      </Modal>
      <Modal
        open={(phase === 'won' || phase === 'lost') && !viewport.blocked}
        title={phase === 'won' ? '全拠点制圧' : '母艦陥落'}
      >
        <div className="siege-result">
          <span>{phase === 'won' ? 'ALL FORTS DOWN' : 'CARAVAN LOST'}</span>
          <h1>
            {phase === 'won'
              ? 'その軍団は、伝説になった。'
              : '軍団が崩れた。次はどう壊す？'}
          </h1>
          <p>
            {phase === 'won' ? '全6拠点制圧' : `${view.stage + 1}拠点目で敗北`}{' '}
            / 遠征 {Math.floor(view.tick * STEP)}秒 / SEED {view.seed}
          </p>
          <div className="siege-result-stats">
            <div>
              <b>{view.stats.deployed}</b>総出撃
            </div>
            <div>
              <b>{view.stats.peakArmy}</b>最大同時部隊
            </div>
            <div>
              <b>{view.stats.maxBurst}</b>一斉撃破
            </div>
            <div>
              <b>{view.stats.cannons}</b>母艦砲
            </div>
          </div>
          <p>{view.relics.map((id) => RELICS[id].name).join(' × ')}</p>
          <div className="siege-menu-actions">
            <button type="button" onClick={() => restart(freshSeed())}>
              新しい遠征
            </button>
            <button type="button" onClick={() => restart(view.seed)}>
              同じSEEDで再挑戦
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
