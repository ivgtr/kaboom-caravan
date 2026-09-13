import { lazy } from 'react';
import { SiegeApp } from './siege/SiegeApp';
const LegacyGame = lazy(() =>
  import('./GameApp').then(({ GameApp }) => ({ default: GameApp })),
);
/** The army siege is the normal game; the former shooter is comparison-only. */
export function GameEntry() {
  const legacy = new URLSearchParams(window.location.search).has(
    'legacyCombat',
  );
  // The boundary lives above ImmersiveShell so its initial pause request cannot
  // run before the lazy combat controller has mounted.
  return legacy ? <LegacyGame /> : <SiegeApp />;
}
