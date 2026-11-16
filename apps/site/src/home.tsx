import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DOWNLOADS, PATHS } from './config';
import { SiteHome } from './pages';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteHome paths={PATHS} downloads={DOWNLOADS} />
  </StrictMode>,
);
