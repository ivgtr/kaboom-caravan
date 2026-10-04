import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RunnerApp } from './runner/RunnerApp';

const root = document.getElementById('root');
if (!root) throw new Error('Root element was not found.');
createRoot(root).render(
  <StrictMode>
    <RunnerApp />
  </StrictMode>,
);
