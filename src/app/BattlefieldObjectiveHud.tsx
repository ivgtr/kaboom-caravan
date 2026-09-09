import { BATTLEFIELD_OBJECTIVES } from '../game/data/routeDefinitions';
import { getObjectiveStatus } from '../game/simulation/battlefieldObjective';
import type { BattlefieldObjectiveState } from '../game/simulation/types';
import './battlefield-objective.css';

export function BattlefieldObjectiveHud({
  objective,
  position,
  contested,
}: {
  objective: BattlefieldObjectiveState;
  position: number;
  contested: boolean;
}) {
  const definition = BATTLEFIELD_OBJECTIVES[objective.kind];
  const status = getObjectiveStatus(objective, position, contested);
  const breakout = objective.kind === 'breakout';
  return (
    <section
      className="objective-hud"
      aria-label={breakout ? '封鎖線の突破状況' : '寄り道の回収状況'}
      data-state={objective.status}
      data-kind={objective.kind}
    >
      <div>
        <strong>{definition.displayName}</strong>
        <b aria-label={breakout ? '突破期限' : '回収期限'}>
          {objective.status === 'active'
            ? `${objective.remainingSeconds.toFixed(1)}秒`
            : objective.status === 'secured'
              ? breakout
                ? '突破！'
                : '回収済'
              : breakout
                ? '封鎖'
                : '終了'}
        </b>
      </div>
      <span>
        {definition.position - definition.radius}〜
        {definition.position + definition.radius}m・
        {breakout ? `ここを${definition.holdSeconds}秒こじ開けろ / 全滅不要` : `累計${definition.holdSeconds}秒`}
      </span>
      <progress
        aria-label={breakout ? '封鎖線の突破' : '拠点の確保'}
        value={objective.progressSeconds}
        max={definition.holdSeconds}
      />
      <span role="status">{status}</span>
    </section>
  );
}

export function ObjectiveSummary({
  objective,
}: {
  objective?: BattlefieldObjectiveState;
}) {
  if (!objective || objective.status === 'active') return null;
  const definition = BATTLEFIELD_OBJECTIVES[objective.kind];
  if (objective.kind === 'breakout') {
    return (
      <small className="objective-summary">
        {definition.displayName}：
        {objective.status === 'secured' ? '突破成功 / 敵を残して離脱' : '突破失敗'}
      </small>
    );
  }
  return (
    <small className="objective-summary">
      {definition.displayName}：
      {objective.status === 'secured'
        ? `回収成功 / ${definition.reward}`
        : '回収断念 / 追加報酬なし'}
    </small>
  );
}
