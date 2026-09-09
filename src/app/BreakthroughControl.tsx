import {
  BREAKTHROUGH,
  getBreakthroughHitCharge,
} from '../game/simulation/breakthrough';
import type { BreakthroughState } from '../game/simulation/types';
import './breakthrough.css';

interface BreakthroughControlProps {
  state: BreakthroughState;
  position: number;
  hasThreat: boolean;
  onActivate: () => void;
}

export function BreakthroughControl({
  state,
  position,
  hasThreat,
  onActivate,
}: BreakthroughControlProps) {
  const active = state.remainingSeconds > 0;
  const committed = Boolean(state.committed);
  const ready =
    !active && !committed && state.charge >= BREAKTHROUGH.maximumCharge;
  const hitCharge = getBreakthroughHitCharge(position);
  const hint = active
    ? '火器3.25倍速・排熱5倍。追加4体は残る。4秒で全部壊せ！'
    : committed
      ? `この戦闘では再発動不可。再充填した${Math.floor(state.charge)}%は次戦へ持越し`
      : ready
        ? hasThreat
          ? 'ALL-IN：敵4体が即乱入。弾幕は消えない。勝てる瞬間だけ押せ'
          : '100%を温存中。敵がいる間だけDEATH RIDE可能'
        : hitCharge > 0
          ? `命中 +${hitCharge} ／ パリィ +25 ・危険地帯ほど早く貯まる`
          : '25mより前で命中、またはパリィで蓄積';
  return (
    <section
      className="breakthrough-panel"
      data-state={
        active
          ? 'active'
          : ready
            ? 'ready'
            : committed
              ? 'spent'
              : 'charging'
      }
      aria-label="DEATH RIDE状況"
    >
      <button
        type="button"
        className="breakthrough-button"
        aria-label="DEATH RIDEを発動"
        aria-describedby="breakthrough-hint"
        disabled={!ready || !hasThreat}
        onClick={onActivate}
        onKeyDown={(event) => {
          // Keep native keyboard activation without also firing the main gun.
          if (event.code === 'Space' || event.code === 'Enter') {
            event.stopPropagation();
            if (event.repeat) event.preventDefault();
          }
        }}
      >
        <span className="breakthrough-title">
          <kbd>E</kbd>
          <strong>{active ? 'DEATH RIDE' : '決死突破'}</strong>
          <b>
            {active
              ? `${state.remainingSeconds.toFixed(1)}s`
              : `${Math.floor(state.charge)}%`}
          </b>
        </span>
        <progress
          aria-label={active ? 'DEATH RIDEの残り時間' : '決死突破ゲージ'}
          value={active ? state.remainingSeconds : state.charge}
          max={
            active ? BREAKTHROUGH.durationSeconds : BREAKTHROUGH.maximumCharge
          }
        />
        <span className="breakthrough-action">
          {active
            ? '追加4体乱入済み｜倒し切れ'
            : committed
              ? 'COMMITTED｜次戦まで再使用不可'
              : ready
                ? hasThreat
                  ? 'ALL-IN：敵4体を追加して発動'
                  : '敵を待つ'
                : `現在 ${Math.floor(position)}m ／ 前で戦ってチャージ`}
        </span>
      </button>
      <small id="breakthrough-hint">{hint}</small>
      <span className="breakthrough-announcement" role="status">
        {active
          ? 'DEATH RIDE発動。追加敵を4体確認'
          : ready
            ? 'DEATH RIDEが使用可能です'
            : ''}
      </span>
    </section>
  );
}
