import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DOWNLOAD_URL, PATHS } from './config';
import { SiteDownload } from './pages';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteDownload paths={PATHS} downloadUrl={DOWNLOAD_URL} />
  </StrictMode>,
);
