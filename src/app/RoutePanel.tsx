import { useCallback, useEffect, useRef } from 'react';
import { MVP_ENCOUNTERS } from '../game/data/runDefinitions';
import { WAVE_DEFINITIONS } from '../game/data/waveDefinitions';
import { ENEMY_DEFINITIONS } from '../game/data/enemyDefinitions';
import type { RouteChoice } from '../game/data/routeDefinitions';
import type { CombatCoreId } from '../game/data/combatCoreDefinitions';
import type { InputManager } from '../input/InputManager';
import { useMenuNavigation } from '../input/useMenuNavigation';
import { CoreBuildHint } from './CombatCorePanel';
import './battlefield-objective.css';

export function RoutePanel({
  input,
  choices,
  encounterIndex,
  coreId,
  hitPoints,
  maxHitPoints,
  onChoose,
}: {
  input: InputManager;
  choices: RouteChoice[];
  encounterIndex: number;
  coreId?: CombatCoreId;
  hitPoints: number;
  maxHitPoints: number;
  onChoose: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const choose = useCallback(
    (index: number) => {
      const choice = choices[index];
      if (choice) onChoose(choice.id);
    },
    [choices, onChoose],
  );
  const navigation = useMenuNavigation({
    input,
    itemCount: choices.length,
    onConfirm: choose,
  });
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    const card = dialog?.querySelector<HTMLElement>(
      `[data-route="${choices[navigation.selectedIndex]?.type}"]`,
    );
    if (!dialog || !card) return;
    if (navigation.selectedIndex === 0) {
      dialog.scrollTop = 0;
      return;
    }
    const bounds = dialog.getBoundingClientRect();
    const item = card.getBoundingClientRect();
    if (item.top < bounds.top + 8)
      dialog.scrollTop += item.top - bounds.top - 8;
    else if (item.bottom > bounds.bottom - 8)
      dialog.scrollTop += item.bottom - bounds.bottom + 8;
  }, [choices, navigation.selectedIndex]);
  const encounter = MVP_ENCOUNTERS[encounterIndex]!;
  const counts = new Map<string, number>();
  for (const spawn of WAVE_DEFINITIONS[encounter.waveId].spawns) {
    const name = ENEMY_DEFINITIONS[spawn.enemyTypeId].displayName;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return (
    <dialog
      ref={dialogRef}
      className="route-briefing"
      aria-labelledby="route-title"
      aria-describedby="route-rules"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        navigation.select(
          (navigation.selectedIndex +
            (event.shiftKey ? -1 : 1) +
            choices.length) %
            choices.length,
        );
      }}
    >
      <header>
        <span>
          進路選択 / 第{encounterIndex + 1}戦・{encounter.displayName}
        </span>
        <h1 id="route-title">次に進む区画を選ぼう</h1>
        <p>
          次戦開始時の耐久{' '}
          <b>
            {Math.ceil(Math.min(maxHitPoints, hitPoints + 15))} / {maxHitPoints}
          </b>
          （共通の耐久+15を含む）
        </p>
        <p className="route-scout">
          敵偵察：
          {[...counts].map(([name, count]) => `${name} ×${count}`).join(' / ')}
          {encounter.isBoss ? '（形態変化で増援あり）' : ''}
        </p>
        <CoreBuildHint id={coreId} />
        <p id="route-rules">
          寄り道は前方の拠点を確保して回収。敵がいる間は進まないが、退いても進捗は残る。期限内に敵部隊と敵弾を全て片付けても回収成功。失敗しても通常の戦闘は続く。
        </p>
        <small>
          A・D / ←・→ / TAB 選択・SPACE / ENTER 決定。スクロールして比較。
        </small>
      </header>
      <div className="route-choice-grid">
        {choices.map((choice, index) => (
          <button
            type="button"
            key={choice.id}
            data-route={choice.type}
            className={`route-choice route-${choice.accent}${navigation.selectedIndex === index ? ' selected' : ''}`}
            {...navigation.bindItem(index)}
            onPointerEnter={undefined}
            onClick={() => onChoose(choice.id)}
          >
            <strong>{choice.displayName}</strong>
            <span>{choice.description}</span>
            <span className="route-risk">負担：{choice.risk}</span>
            <b className="route-reward">獲得：{choice.reward}</b>
          </button>
        ))}
      </div>
    </dialog>
  );
}
