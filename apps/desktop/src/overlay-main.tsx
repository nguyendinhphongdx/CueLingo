import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaptionOverlay } from './overlay';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptionOverlay />
  </StrictMode>,
);
