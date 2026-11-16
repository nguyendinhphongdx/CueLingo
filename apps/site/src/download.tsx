import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DOWNLOADS, PATHS } from './config';
import { SiteDownload } from './pages';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteDownload paths={PATHS} downloads={DOWNLOADS} />
  </StrictMode>,
);
