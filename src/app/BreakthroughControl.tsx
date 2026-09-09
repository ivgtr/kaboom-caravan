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
  const ready = !active && state.charge >= BREAKTHROUGH.maximumCharge;
  const hitCharge = getBreakthroughHitCharge(position);
  const hint = active
    ? '連射・排熱が加速。無敵ではない！'
    : ready
      ? hasThreat
        ? '敵弾一掃＋排熱。今使う？ 温存する？'
        : 'ゲージを温存中。敵が来たら発動可能'
      : hitCharge > 0
        ? `命中 +${hitCharge} ／ パリィ +25 ・さらに前で加速`
        : '25mより前で命中、またはパリィで蓄積';
  return (
    <section
      className="breakthrough-panel"
      data-state={active ? 'active' : ready ? 'ready' : 'charging'}
      aria-label="突破状況"
    >
      <button
        type="button"
        className="breakthrough-button"
        aria-label="前線突破"
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
          <strong>{active ? '前線突破中！' : '前線突破'}</strong>
          <b>
            {active
              ? `${state.remainingSeconds.toFixed(1)}s`
              : `${Math.floor(state.charge)}%`}
          </b>
        </span>
        <progress
          aria-label={active ? '突破の残り時間' : '突破ゲージ'}
          value={active ? state.remainingSeconds : state.charge}
          max={
            active ? BREAKTHROUGH.durationSeconds : BREAKTHROUGH.maximumCharge
          }
        />
        <span className="breakthrough-action">
          {active
            ? '押し込むか、立て直すか'
            : ready
              ? hasThreat
                ? '発動する'
                : '敵を待つ'
              : `現在 ${Math.floor(position)}m ／ 前進してチャージ`}
        </span>
      </button>
      <small id="breakthrough-hint">{hint}</small>
      <span className="breakthrough-announcement" role="status">
        {active
          ? '前線突破を発動しました'
          : ready
            ? '前線突破が使用可能です'
            : ''}
      </span>
    </section>
  );
}
