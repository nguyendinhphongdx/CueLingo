'use client';

import type { AdminAgentPlugin, AdminAgentStatus } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Badge } from '@cuelingo/ui/components/badge';
import { EmptyState } from '@cuelingo/ui/components/empty-state';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { notFound } from 'next/navigation';
import { useAdminAgent } from './use-admin-agent';

const time = new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' });

/** One line saying why a plugin is not serving, in words an admin can act on. */
export function pluginStateLabel(plugin: AdminAgentPlugin): string {
  if (plugin.state === 'loaded') return 'Đang bật';
  if (plugin.state === 'failed') return 'Lỗi khi nạp, cần xem log và triển khai lại';
  if (plugin.disabledBy === 'breaker') {
    return plugin.retryAt
      ? `Tự tắt do lỗi liên tiếp, thử lại lúc ${time.format(new Date(plugin.retryAt))}`
      : 'Tự tắt do lỗi liên tiếp';
  }
  return 'Đã tắt bởi admin';
}

export function AdminAgentView({
  status,
  saving = false,
  onToggleAll,
  onTogglePlugin,
}: {
  status: AdminAgentStatus;
  saving?: boolean;
  onToggleAll(enabled: boolean): void;
  onTogglePlugin(id: string, enabled: boolean): void;
}) {
  return (
    <>
      <Section title="Trợ lý AI">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {status.enabled ? 'Công tắc đang bật' : 'Công tắc đang tắt'}
              </p>
              <p className="text-muted-foreground text-sm">
                {status.available
                  ? 'Tắt thì mọi lượt mới trả "trợ lý đang tắt"; lượt đang chạy không bị cắt. Khởi động lại API thì công tắc về bật.'
                  : 'Triển khai hiện tắt trợ lý (AGENT_ENABLED hoặc thiếu khoá AI), nên công tắc này chưa có tác dụng.'}
              </p>
            </div>
            <Button
              type="button"
              variant={status.enabled ? 'outline' : 'default'}
              disabled={saving}
              onClick={() => onToggleAll(!status.enabled)}
            >
              {status.enabled ? 'Tắt trợ lý' : 'Bật trợ lý'}
            </Button>
          </CardContent>
        </Card>
      </Section>
      <Section title="Plugin">
        {status.plugins.length === 0 ? (
          <EmptyState title="Chưa có plugin nào" />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto px-0 py-0">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">Plugin của trợ lý AI và trạng thái</caption>
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th scope="col" className="px-5 py-3 font-medium">
                      Plugin
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Công cụ
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Quyền
                    </th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      Trạng thái
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {status.plugins.map((plugin) => (
                    <tr key={plugin.id} className="border-b align-top last:border-0">
                      <th scope="row" className="px-5 py-3 text-left font-medium">
                        {plugin.id}
                        <span className="text-muted-foreground ml-2 font-normal">
                          v{plugin.version}
                        </span>
                      </th>
                      <td className="px-5 py-3">{plugin.tools.join(', ') || '—'}</td>
                      <td className="px-5 py-3">{plugin.permissions.join(', ') || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            plugin.state === 'loaded'
                              ? 'success'
                              : plugin.state === 'failed'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {pluginStateLabel(plugin)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {plugin.state !== 'failed' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={saving}
                            onClick={() => onTogglePlugin(plugin.id, plugin.state === 'disabled')}
                          >
                            {plugin.state === 'disabled' ? 'Bật' : 'Tắt'}
                            <span className="sr-only"> plugin {plugin.id}</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </Section>
    </>
  );
}

export function AdminAgentPage() {
  const { status, loading, hidden, error, saving, setEnabled, setPlugin } = useAdminAgent();
  if (hidden) notFound();
  return (
    <>
      <PageHeader
        title="Trợ lý AI"
        description="Bật hoặc tắt trợ lý và từng plugin. Thay đổi có hiệu lực từ lượt trò chuyện kế tiếp."
      />
      {error && (
        <NoticeStrip tone="error" className="mb-4">
          {error}
        </NoticeStrip>
      )}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        status && (
          <AdminAgentView
            status={status}
            saving={saving}
            onToggleAll={setEnabled}
            onTogglePlugin={setPlugin}
          />
        )
      )}
    </>
  );
}
