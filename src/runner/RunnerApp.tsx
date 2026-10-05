import { useEffect, useRef, useState } from 'react';
import { loadRunnerArt, WEAPON_ART } from './assets';
import { RunnerAudio } from './audio';
import { WEAPONS } from './definitions';
import { renderRunner, runnerViewport } from './render';
import {
  clearJumpInput,
  createRunner,
  pauseRunner,
  releaseJump,
  requestJump,
  resumeRunner,
  startRunner,
  stepRunner,
} from './simulation';
import { FIXED_DT, PIXELS_PER_METRE, type RunnerState } from './types';
import './runner.css';

const RECORD_KEY = 'kaboom-score-fever-best-v1';
const SOUND_KEY = 'kaboom-runner-sound-v1';
function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private mode can still play. */
  }
}
function newSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
function initialSeed() {
  const value = new URLSearchParams(location.search).get('seed');
  return value !== null && /^\d{1,10}$/.test(value)
    ? Number(value) >>> 0
    : newSeed();
}
function snapshot(state: RunnerState) {
  return {
    status: state.status,
    score: Math.floor(state.score),
    scoreParts: {
      combat: Math.floor(state.scoreParts.combat),
      loot: Math.floor(state.scoreParts.loot),
      landing: Math.floor(state.scoreParts.landing),
      // Put display-rounding remainder in travel so the visible parts add up.
      travel:
        Math.floor(state.score) -
        Math.floor(state.scoreParts.combat) -
        Math.floor(state.scoreParts.loot) -
        Math.floor(state.scoreParts.landing),
    },
    chain: state.fever.chain,
    bestChain: state.bestChain,
    multiplier: state.fever.multiplier,
    maxMultiplier: state.maxMultiplier,
    peakSpeed: state.peakSpeed,
    chestsOpened: state.chestsOpened,
    abilities: { ...state.fever.abilities },
    freeze: state.fever.freeze,
    rushTime: state.fever.rushTime,
    hyperTime: state.fever.hyperTime,
    reel: state.fever.reel
      ? {
          id: state.fever.reel.id,
          revealed: state.fever.reel.revealed,
          count: state.fever.reel.rewards.length,
        }
      : null,
    feverClock: state.fever.clock,
    distance: Math.floor(state.distance / PIXELS_PER_METRE),
    worldX: state.distance,
    y: state.player.y,
    grounded: state.player.grounded,
    speed: state.speed,
    scrap: state.scrap,
    shield: state.shield,
    guardFlash: state.effects.some((effect) => effect.kind === 'guard'),
    jumps: state.jumps,
    passed: state.passed,
    defeated: state.defeated,
    weapon: state.weapon ? { ...state.weapon } : null,
    magnet: state.magnet,
    notice: state.noticeTime > 0 ? state.notice : '',
    reason: state.reason,
    deathFeedback: state.deathFeedback,
    holding: state.player.holding,
    airHops: state.player.airHops,
    runLevel: state.runLevel,
    nextScrapLevel: state.nextScrapLevel,
    time: state.time,
    seed: state.seed,
  };
}
interface Controls {
  jump(): void;
  start(): void;
  tap(): void;
  pointerDown(id: number): void;
  pause(): void;
  resume(): void;
  retry(fresh?: boolean): void;
  sound(): void;
}
const EMPTY: Controls = {
  jump() {},
  start() {},
  tap() {},
  pointerDown() {},
  pause() {},
  resume() {},
  retry() {},
  sound() {},
};
let artPromise: ReturnType<typeof loadRunnerArt> | null = null;

export function RunnerApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef<Controls>(EMPTY);
  const [initial] = useState(() => {
    const state = createRunner(initialSeed());
    return { state, view: snapshot(state) };
  });
  const stateRef = useRef<RunnerState>(initial.state);
  const [view, setView] = useState(initial.view);
  const [best, setBest] = useState(() =>
    Math.max(0, Number(stored(RECORD_KEY)) || 0),
  );
  const [sound, setSound] = useState(() => stored(SOUND_KEY) !== 'off');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      setError(true);
      setLoading(false);
      return;
    }
    let alive = true,
      frame = 0,
      previousTime = 0,
      accumulator = 0,
      uiTime = 0,
      lastCut = false;
    let width = 0,
      height = 0,
      lastEffect = 0;
    let bestValue = Math.max(0, Number(stored(RECORD_KEY)) || 0);
    const keys = new Set<string>();
    const pointers = new Set<number>();
    const audio = new RunnerAudio();
    audio.enabled = stored(SOUND_KEY) !== 'off';
    const reducedMotion = matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const sync = () => setView(snapshot(stateRef.current!));
    const clearInput = () => {
      keys.clear();
      pointers.clear();
      clearJumpInput(stateRef.current!);
    };
    const focusGame = () => canvas.focus({ preventScroll: true });
    const pause = () => {
      pauseRunner(stateRef.current!);
      audio.update(stateRef.current!);
      clearInput();
      accumulator = 0;
      sync();
    };
    const jump = () => {
      const state = stateRef.current!;
      audio.unlock();
      if (state.status === 'ready') startRunner(state);
      if (state.status === 'running') requestJump(state);
      sync();
      focusGame();
    };
    const retry = (fresh = false) => {
      clearInput();
      stateRef.current = createRunner(
        fresh ? newSeed() : stateRef.current!.seed,
      );
      startRunner(stateRef.current);
      audio.update(stateRef.current);
      lastEffect = 0;
      accumulator = 0;
      previousTime = performance.now();
      audio.unlock();
      sync();
      focusGame();
    };
    controls.current = {
      jump,
      start() {
        audio.unlock();
        startRunner(stateRef.current!);
        clearInput();
        sync();
        focusGame();
      },
      tap() {
        jump();
        releaseJump(stateRef.current!);
      },
      pointerDown(id) {
        if (pointers.size || keys.size) return;
        pointers.add(id);
        jump();
      },
      pause,
      retry,
      resume() {
        clearInput();
        resumeRunner(stateRef.current!);
        accumulator = 0;
        previousTime = performance.now();
        audio.unlock();
        sync();
        focusGame();
      },
      sound() {
        audio.enabled = !audio.enabled;
        audio.update(stateRef.current!);
        save(SOUND_KEY, audio.enabled ? 'on' : 'off');
        setSound(audio.enabled);
        audio.unlock();
        focusGame();
      },
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        if (event.repeat) return;
        if (stateRef.current!.status === 'running') pause();
        else if (stateRef.current!.status === 'paused')
          controls.current.resume();
        return;
      }
      if (!['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(event.code)) return;
      if (
        event.target instanceof HTMLButtonElement &&
        event.target.getAttribute('aria-label') !== 'ジャンプ'
      )
        return;
      event.preventDefault();
      if (event.repeat || keys.has(event.code)) return;
      const alreadyHeld = keys.size > 0 || pointers.size > 0;
      keys.add(event.code);
      if (alreadyHeld) return;
      const status = stateRef.current!.status;
      if (status === 'over') retry();
      else if (status !== 'paused') jump();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const released = keys.delete(event.code);
      if (released && !keys.size && !pointers.size)
        releaseJump(stateRef.current!);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      controls.current.pointerDown(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      const released = pointers.delete(event.pointerId);
      if (released && !keys.size && !pointers.size)
        releaseJump(stateRef.current!);
    };
    const onBlur = () => {
      if (stateRef.current!.status === 'running') pause();
      else clearInput();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (width && width < height !== rect.width < rect.height) onBlur();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const bindInput = () => {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);
    };
    artPromise ??= loadRunnerArt();
    void Promise.all([artPromise, audio.preload()])
      .then(([art, soundReady]) => {
        if (!soundReady) throw new Error('Freeze audio failed to load');
        if (!alive) return;
        setLoading(false);
        bindInput();
        const tick = (now: number) => {
          if (!alive) return;
          const state = stateRef.current!;
          const elapsed = previousTime ? (now - previousTime) / 1000 : 0;
          previousTime = now;
          if (elapsed > 0.3 && state.status === 'running') pause();
          if (state.status === 'running') {
            accumulator += Math.min(elapsed, 0.1);
            while (accumulator >= FIXED_DT) {
              stepRunner(state, FIXED_DT);
              accumulator -= FIXED_DT;
            }
          } else accumulator = 0;
          audio.update(state);
          for (const effect of state.effects) {
            if (effect.id > lastEffect) {
              audio.play(effect.kind);
              lastEffect = effect.id;
            }
          }
          if (state.status === 'over') {
            const score = Math.floor(state.score);
            if (score > bestValue) {
              bestValue = score;
              save(RECORD_KEY, String(score));
              setBest(score);
            }
          }
          const viewport = runnerViewport(width, height, state.speed);
          context.setTransform(
            canvas.width / viewport.width,
            0,
            0,
            canvas.height / viewport.height,
            0,
            0,
          );
          renderRunner(context, state, art, viewport, reducedMotion);
          const cut = state.status === 'running' && state.fever.freeze > 0;
          if (cut !== lastCut || now - uiTime >= 60) {
            sync();
            uiTime = now;
            lastCut = cut;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (alive) {
          artPromise = null;
          setLoading(false);
          setError(true);
        }
      });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      audio.close();
      controls.current = EMPTY;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // All live game state and input are owned by this mount, never by a render closure.
  }, [attempt]);

  const weapon = view.weapon ? WEAPONS[view.weapon.id] : null;
  const playable = !loading && !error;
  return (
    <main
      className="runner"
      data-testid="runner"
      data-status={view.status}
      data-cut={view.status === 'running' && view.freeze > 0}
      data-distance={view.distance}
      data-score={view.score}
      data-chain={view.chain}
      data-multiplier={view.multiplier.toFixed(2)}
      data-chests={view.chestsOpened}
      data-freeze={view.freeze.toFixed(3)}
      data-rush={view.rushTime.toFixed(2)}
      data-hyper={view.hyperTime.toFixed(2)}
      data-reel-id={view.reel?.id ?? 0}
      data-reel-revealed={view.reel?.revealed ?? 0}
      data-reel-count={view.reel?.count ?? 0}
      data-fever-clock={view.feverClock.toFixed(3)}
      data-boost={view.abilities.boost}
      data-slam={view.abilities.slam}
      data-gold={view.abilities.gold}
      data-magnet={view.abilities.magnet}
      data-world-x={view.worldX.toFixed(2)}
      data-speed={view.speed.toFixed(2)}
      data-y={view.y.toFixed(1)}
      data-grounded={view.grounded}
      data-jumps={view.jumps}
      data-holding={view.holding}
      data-air-hops={view.airHops}
      data-run-level={view.runLevel}
      data-scrap={view.scrap}
      data-shield={view.shield}
      data-guard-flash={view.guardFlash}
      data-defeated={view.defeated}
      data-art-ready={playable}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="ゲーム画面"
        tabIndex={0}
        onContextMenu={(event) => event.preventDefault()}
      />
      <header className="runner-hud">
        <div className="runner-distance runner-score" aria-label="スコア">
          <span className="runner-eyebrow">SCORE</span>
          <strong
            style={{
              fontSize: `clamp(${Math.max(20, 48 - String(view.score).length * 2)}px, ${Math.min(5, 40 / String(view.score).length)}vw, 72px)`,
            }}
          >
            {view.score.toLocaleString()}
          </strong>
          <span className="runner-best">BEST {best.toLocaleString()}</span>
          <div className="runner-chain" data-active={view.chain > 0}>
            <b>×{view.multiplier.toFixed(1)}</b>
            <span>
              {view.chain > 0 ? `${view.chain} CHAIN` : '壊して、つなげ！'}
            </span>
          </div>
        </div>
        <div className="runner-top-right">
          <span className="runner-distance-secondary">
            {view.distance.toLocaleString()}m
          </span>
          <button
            className="runner-icon"
            aria-label={`サウンド${sound ? 'をオフ' : 'をオン'}`}
            aria-pressed={sound}
            onClick={() => controls.current.sound()}
          >
            {sound ? '♪' : '♩'}
          </button>
          <button
            className="runner-icon"
            aria-label="一時停止"
            disabled={!playable || view.status !== 'running'}
            onClick={() => controls.current.pause()}
          >
            Ⅱ
          </button>
        </div>
      </header>
      {playable && (view.status === 'running' || view.status === 'paused') && (
        <>
          <div className="runner-loadout" aria-label="現在の装備">
            <div className="runner-abilities" aria-label="重ねた能力">
              {(
                [
                  ['boost', '加速'],
                  ['slam', '着地爆弾'],
                  ['gold', '黄金感染'],
                  ['magnet', '宝箱磁石'],
                ] as const
              ).map(([key, label]) => (
                <span key={key} data-active={view.abilities[key] > 0}>
                  {label} <b>{view.abilities[key]}</b>
                </span>
              ))}
            </div>
            <div className="runner-equipment-line">
              {view.weapon && weapon && (
                <>
                  <img src={WEAPON_ART[view.weapon.id]} alt="" />
                  <span>
                    {weapon.label} Lv.{view.weapon.level}
                  </span>
                </>
              )}
              <span>{view.shield ? 'ガード 1' : 'ガード 0'}</span>
              <span>↑ 空中 {view.airHops} 回</span>
              <span>{Math.round(view.speed)} px/s</span>
            </div>
          </div>
          {view.notice && !view.reel && (
            <p className="runner-notice" role="status">
              {view.notice}
            </p>
          )}
          {view.status === 'running' && (
            <div className="runner-bottom">
              <p
                className={view.time > 12 ? 'runner-hint faded' : 'runner-hint'}
              >
                跳んで、宝箱をつなげ！
                <br />
                <span>短押し・長押し・空中でもう一度</span>
              </p>
              <button
                className="runner-jump"
                aria-label="ジャンプ"
                onPointerDown={(event) => {
                  if (!event.isPrimary || event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  controls.current.pointerDown(event.pointerId);
                }}
                onClick={(event) => {
                  if (event.detail === 0) controls.current.tap();
                }}
              >
                <span>↑</span>ジャンプ
              </button>
            </div>
          )}
        </>
      )}
      {(loading || error) && (
        <section className="runner-overlay runner-loading">
          <h1>
            KABOOM
            <br />
            <span>CARAVAN</span>
          </h1>
          {error ? (
            <>
              <p>素材を読み込めませんでした</p>
              <button
                className="runner-primary"
                onClick={() => {
                  setError(false);
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }}
              >
                読み込み直す
              </button>
            </>
          ) : (
            <p role="status">道をつないでいます…</p>
          )}
        </section>
      )}
      {playable && view.status === 'ready' && (
        <section className="runner-overlay runner-title">
          <p className="runner-kicker">その当たりで、記録を壊せ。</p>
          <h1>
            KABOOM
            <br />
            <span>CARAVAN</span>
          </h1>
          <p className="runner-title-copy">
            跳ぶ。壊す。当てる。スコアが暴れ出す。
          </p>
          <button
            className="runner-primary"
            aria-label="スタート"
            onClick={() => controls.current.start()}
          >
            スタート <span>→</span>
          </button>
          <p className="runner-instructions">
            タップ / SPACE / ↑ ・ 長押しで高く
            <br />
            離すと低く、空中でもう一度で立て直す。
            <br />
            宝箱は自動で1〜3抽選。加速 × 破壊連鎖でスコア爆増。
          </p>
        </section>
      )}
      {playable && view.status === 'paused' && (
        <section
          className="runner-overlay runner-modal"
          aria-label="一時停止中"
        >
          <p className="runner-kicker">ひと息ついたら、続きへ</p>
          <h2>ひと休み</h2>
          <p>再開するまで、走行も演出も止まっています</p>
          <button
            className="runner-primary"
            aria-label="再開"
            onClick={() => controls.current.resume()}
          >
            再開 <span>→</span>
          </button>
          <button
            className="runner-secondary"
            onClick={() => controls.current.retry()}
          >
            最初から
          </button>
          <small>ESC / P で再開</small>
        </section>
      )}
      {playable && view.status === 'over' && (
        <section
          className="runner-overlay runner-modal runner-result"
          aria-label="ラン結果"
        >
          <p className="runner-kicker">
            {view.score >= best && view.score > 0
              ? '自己ベスト更新'
              : '次は、このスコアを超えろ'}
          </p>
          <h2>
            {view.score.toLocaleString()}
            <small>pts</small>
          </h2>
          <p className="runner-cause">{view.deathFeedback}</p>
          <div className="runner-stats">
            <span>
              <b>{view.bestChain}</b>最大CHAIN
            </span>
            <span>
              <b>×{view.maxMultiplier.toFixed(1)}</b>最大倍率
            </span>
            <span>
              <b>{view.chestsOpened}</b>宝箱
            </span>
            <span>
              <b>{Math.round(view.peakSpeed)}</b>最高px/s
            </span>
          </div>
          <p className="runner-score-recipe">
            加速 × 破壊連鎖 × 能力の組み合わせ × RUSH / HYPER
          </p>
          <div className="runner-score-parts" aria-label="スコア内訳">
            {(
              [
                ['combat', '破壊'],
                ['loot', '宝箱・回収'],
                ['landing', '着地'],
                ['travel', '走行'],
              ] as const
            ).map(([key, label]) => (
              <span key={key}>
                {label}{' '}
                <b>{Math.floor(view.scoreParts[key]).toLocaleString()}</b>
              </span>
            ))}
          </div>
          <p className="runner-result-secondary">
            {view.distance.toLocaleString()}m 走行 ・ {view.defeated} 撃破 ・{' '}
            {view.jumps} ジャンプ
          </p>
          <button
            className="runner-primary"
            aria-label="もう一度"
            onClick={() => controls.current.retry()}
          >
            もう一度 <span>↻</span>
          </button>
          <button
            className="runner-secondary"
            onClick={() => controls.current.retry(true)}
          >
            新しい道
          </button>
          <small>同じ道でもう一度 ・ 道の番号 {view.seed}</small>
        </section>
      )}
    </main>
  );
}
