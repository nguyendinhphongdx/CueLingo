import { Button } from '@cuelingo/ui/components/button';
import { Input } from '@cuelingo/ui/components/input';
import { Section } from '@cuelingo/ui/components/section';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { privacyApi } from './privacy-api';

export const canConfirmDelete = (value: string) => value === 'XOA DU LIEU';

export function PrivacyPanel() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const exportData = useMutation({
    mutationFn: () => privacyApi.exportData(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cuelingo-data-${data.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
  });
  const deleteData = useMutation({
    mutationFn: () => privacyApi.deleteMyData({ confirm: 'XOA DU LIEU' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setConfirming(false);
      setConfirmation('');
      setSuccess('Đã xoá toàn bộ dữ liệu. Tài khoản của bạn vẫn được giữ lại.');
    },
  });
  const error = exportData.error ?? deleteData.error;

  return (
    <Section title="Dữ liệu của bạn">
      <div className="bg-card space-y-4 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Bản sao dữ liệu</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Tải cuộc họp, transcript, debrief, cụm từ và thuật ngữ dưới dạng JSON.
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            {exportData.isPending ? 'Đang chuẩn bị…' : 'Tải dữ liệu (JSON)'}
          </Button>
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-medium">Xoá toàn bộ dữ liệu</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Dữ liệu học và cuộc họp sẽ bị xoá vĩnh viễn; tài khoản đăng nhập được giữ lại.
          </p>
          {!confirming ? (
            <Button
              variant="destructive"
              className="mt-3 min-h-11"
              onClick={() => setConfirming(true)}
            >
              Xoá toàn bộ dữ liệu
            </Button>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg border p-4">
              <label
                htmlFor="desktop-delete-data-confirmation"
                className="block text-sm font-medium"
              >
                Gõ XOA DU LIEU để xác nhận
              </label>
              <Input
                id="desktop-delete-data-confirmation"
                autoFocus
                value={confirmation}
                disabled={deleteData.isPending}
                aria-invalid={confirmation.length > 0 && !canConfirmDelete(confirmation)}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={!canConfirmDelete(confirmation) || deleteData.isPending}
                  onClick={() => deleteData.mutate()}
                >
                  {deleteData.isPending ? 'Đang xoá…' : 'Xác nhận xoá'}
                </Button>
                <Button
                  variant="outline"
                  disabled={deleteData.isPending}
                  onClick={() => {
                    setConfirming(false);
                    setConfirmation('');
                  }}
                >
                  Huỷ
                </Button>
              </div>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            Không thể hoàn tất yêu cầu. Vui lòng thử lại.
          </p>
        )}
        {success && (
          <p role="status" className="text-sm">
            {success}
          </p>
        )}
      </div>
    </Section>
  );
}
