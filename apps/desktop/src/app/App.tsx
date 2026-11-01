import { PermissionsStep } from '../onboarding';
import { SessionPanel } from '../session';
import { AssistSettings } from '../settings';

export function App() {
  return (
    <main className="bg-background text-foreground min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">CueLingo</h1>
          <p className="text-muted-foreground mt-2">
            Trợ lý caption song ngữ cho cuộc họp của bạn.
          </p>
        </header>
        <PermissionsStep />
        <AssistSettings />
        <SessionPanel />
      </div>
    </main>
  );
}
