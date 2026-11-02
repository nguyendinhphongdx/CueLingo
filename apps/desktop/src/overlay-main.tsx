import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuthSync } from './auth';
import { CaptionOverlay } from './overlay';
import './styles.css';

/** The overlay is its own window with its own JS context: it signs itself in from the Keychain. */
function OverlayRoot() {
  useAuthSync();
  return <CaptionOverlay />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayRoot />
  </StrictMode>,
);
