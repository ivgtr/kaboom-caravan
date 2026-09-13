import { lazy, Suspense } from 'react';
import { SiegeApp } from './siege/SiegeApp';
const LegacyGame = lazy(() =>
  import('./GameApp').then(({ GameApp }) => ({ default: GameApp })),
);
/** The army siege is the normal game; the former shooter is comparison-only. */
export function GameEntry() {
  const legacy = new URLSearchParams(window.location.search).has(
    'legacyCombat',
  );
  return (
    <Suspense fallback={<p role="status">戦場を読み込み中…</p>}>
      {legacy ? <LegacyGame /> : <SiegeApp />}
    </Suspense>
  );
}
