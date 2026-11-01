import { DownloadPage } from '../../../features/landing';
import { DOWNLOAD_URL } from '../../../lib/config';

export default function Page() {
  return <DownloadPage downloadUrl={DOWNLOAD_URL} />;
}
