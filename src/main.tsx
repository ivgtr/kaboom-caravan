import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './app/GameApp';
import { ImmersiveShell } from './app/ImmersiveShell';
import './app/game.css';
import './app/immersive.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <ImmersiveShell>
      <GameApp />
    </ImmersiveShell>
  </StrictMode>,
);
