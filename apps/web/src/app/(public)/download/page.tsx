import { DownloadPage } from '../../../features/landing';
import { DOWNLOADS } from '../../../lib/config';

export default function Page() {
  return <DownloadPage downloads={DOWNLOADS} />;
}
