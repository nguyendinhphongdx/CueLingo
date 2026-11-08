import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { ServerDialog } from '@cuelingo/ui/components/server-dialog';
import { Button } from '@cuelingo/ui/components/button';
import { Section } from '@cuelingo/ui/components/section';
import { useState, useSyncExternalStore } from 'react';
import { revokeThisDevice, useAuthStore } from '../auth';
import { native } from '../lib/native';
import {
  checkServer,
  defaultServer,
  isDevBuild,
  resetServer,
  saveServer,
  serverConfig,
  validateServerUrl,
  type ServerChoice,
} from '../server';
import { sessionController } from '../session/use-session';
import { changeServer, MEETING_BLOCK_TEXT, type ChangeServerDeps } from './change-server';

export const REOPEN_TEXT = 'Đã đổi máy chủ. Hãy đóng và mở lại CueLingo để áp dụng.';

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const meetingActive = () => sessionController.getSnapshot().status !== 'idle';

const sameChoice = (a: ServerChoice, b: ServerChoice) => a.api === b.api && a.web === b.web;

function realDeps(): ChangeServerDeps {
  return {
    meetingActive,
    token: () => useAuthStore.getState().token,
    revoke: (token) => revokeThisDevice(token),
    clearToken: () => native.authTokenClear(),
    persist: (choice) => (sameChoice(choice, defaultServer()) ? resetServer() : saveServer(choice)),
    relaunch: () => native.relaunchApp(),
  };
}

/** The dialog with its real wiring. Mount it where a button opens it; it renders nothing while closed. */
export function ServerPickerDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const signedIn = useAuthStore((state) => state.status === 'signedIn' && state.token !== null);
  const [error, setError] = useState<string | null>(null);
  const [reopen, setReopen] = useState(false);
  const inMeeting = useSyncExternalStore(
    sessionController.subscribe,
    () => sessionController.getSnapshot().status !== 'idle',
  );

  if (reopen) {
    // The app kept running with the old address in its clients, so nothing else may be used.
    return (
      <div className="bg-background/95 fixed inset-0 z-[60] flex items-center justify-center p-6">
        <p role="alert" className="max-w-sm text-center text-sm font-medium">
          {REOPEN_TEXT}
        </p>
      </div>
    );
  }

  if (open && inMeeting) {
    return (
      <ConfirmDialog
        open
        title="Chưa đổi được máy chủ"
        confirmLabel="Đã hiểu"
        cancelLabel="Đóng"
        onConfirm={onClose}
        onCancel={onClose}
      >
        {MEETING_BLOCK_TEXT}
      </ConfirmDialog>
    );
  }

  const config = serverConfig();
  return (
    <ServerDialog
      open={open}
      current={{ api: config.apiUrl, web: config.webUrl }}
      defaultChoice={defaultServer()}
      devMode={isDevBuild()}
      signedIn={signedIn}
      validate={(url) => validateServerUrl(url, { dev: isDevBuild() })}
      onCheck={(apiUrl) => checkServer(apiUrl)}
      saveError={error}
      onClose={() => {
        setError(null);
        onClose();
      }}
      onSave={async (choice) => {
        setError(null);
        const result = await changeServer(choice, realDeps());
        if (result.status === 'blocked' || result.status === 'failed') setError(result.reason);
        if (result.status === 'reopen') setReopen(true);
      }}
    />
  );
}

/** Settings → Nâng cao: which server this app talks to. Pure markup. */
export function ServerSettingsView({
  host,
  custom,
  onOpen,
}: {
  host: string;
  custom: boolean;
  onOpen(): void;
}) {
  return (
    <Section title="Nâng cao">
      <div className="bg-card flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Máy chủ</p>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">
            {custom ? `Tuỳ chỉnh: ${host}` : `CueLingo Beta (mặc định): ${host}`}
          </p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={onOpen}>
          Đổi máy chủ
        </Button>
      </div>
    </Section>
  );
}

export function ServerSettings() {
  const [open, setOpen] = useState(false);
  const config = serverConfig();
  return (
    <>
      <ServerSettingsView
        host={hostOf(config.apiUrl)}
        custom={config.custom}
        onOpen={() => setOpen(true)}
      />
      <ServerPickerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The small "Máy chủ" link on the sign-in screen. Pure markup. */
export function ServerLinkView({ onOpen }: { onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-muted-foreground hover:text-foreground cursor-pointer text-xs underline underline-offset-2"
    >
      Máy chủ
    </button>
  );
}

export function ServerLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ServerLinkView onOpen={() => setOpen(true)} />
      <ServerPickerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
