import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEntry } from './app/GameEntry';
import { ImmersiveShell } from './app/ImmersiveShell';
import './app/game.css';
import './app/immersive.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p role="status">戦場を読み込み中…</p>}>
      <ImmersiveShell>
        <GameEntry />
      </ImmersiveShell>
    </Suspense>
  </StrictMode>,
);
