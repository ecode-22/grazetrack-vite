import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initSync } from '@/lib/sync';

// No server/client boundary to worry about here — this just runs once
// on app boot, in the browser, same as the rest of the app.
initSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
