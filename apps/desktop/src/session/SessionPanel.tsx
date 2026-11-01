import { useMutation } from '@tanstack/react-query';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { useState } from 'react';
import { useSettings } from '../settings';
import { describeNativeError, startSession, stopSession, toggleOverlay } from './session-actions';

export function SessionPanel() {
  const assistLevel = useSettings((state) => state.assistLevel);
  const [running, setRunning] = useState(false);
  const start = useMutation({
    mutationFn: () => startSession(assistLevel),
    onSuccess: () => setRunning(true),
  });
  const stop = useMutation({
    mutationFn: stopSession,
    onSuccess: () => setRunning(false),
  });
  const overlay = useMutation({ mutationFn: toggleOverlay });
  const error = describeNativeError(start.error ?? stop.error ?? overlay.error);
  const busy = start.isPending || stop.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phiên họp</CardTitle>
        <CardDescription>Bắt đầu caption hoặc điều khiển cửa sổ overlay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button variant="destructive" disabled={busy} onClick={() => stop.mutate()}>
              Dừng
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => start.mutate()}>
              Bắt đầu
            </Button>
          )}
          <Button variant="outline" disabled={overlay.isPending} onClick={() => overlay.mutate()}>
            Hiện/ẩn overlay
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="sr-only">Hiện hoặc ẩn overlay</dt>
            <dd>⌘⇧L · Overlay</dd>
          </div>
          <div>
            <dt className="sr-only">Tóm tắt</dt>
            <dd>⌘⇧W · Tóm tắt</dd>
          </div>
          <div>
            <dt className="sr-only">Nói giúp</dt>
            <dd>⌘⇧S · Nói giúp</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
