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
  return (
    <section
      className="objective-hud"
      aria-label="寄り道の回収状況"
      data-state={objective.status}
    >
      <div>
        <strong>{definition.displayName}</strong>
        <b aria-label="回収期限">
          {objective.status === 'active'
            ? `${objective.remainingSeconds.toFixed(1)}秒`
            : objective.status === 'secured'
              ? '回収済'
              : '終了'}
        </b>
      </div>
      <span>
        {definition.position - definition.radius}〜
        {definition.position + definition.radius}m・累計{definition.holdSeconds}
        秒
      </span>
      <progress
        aria-label="拠点の確保"
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
  return (
    <small className="objective-summary">
      {definition.displayName}：
      {objective.status === 'secured'
        ? `回収成功 / ${definition.reward}`
        : '回収断念 / 追加報酬なし'}
    </small>
  );
}
