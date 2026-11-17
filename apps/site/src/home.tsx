import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { followColorScheme } from './color-scheme';
import { DOWNLOADS, PATHS } from './config';
import { SiteHome } from './pages';
import './styles.css';

followColorScheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteHome paths={PATHS} downloads={DOWNLOADS} />
  </StrictMode>,
);
