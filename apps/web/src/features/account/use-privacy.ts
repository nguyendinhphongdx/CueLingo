import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export function usePrivacy() {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);
  const exportData = useMutation({
    mutationFn: () => client.privacy.export(),
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
    mutationFn: () => client.privacy.deleteMyData({ confirm: 'XOA DU LIEU' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSuccess('Đã xoá toàn bộ dữ liệu của bạn. Tài khoản vẫn được giữ lại.');
    },
  });

  return {
    exporting: exportData.isPending,
    deleting: deleteData.isPending,
    error: describeError(exportData.error) ?? describeError(deleteData.error),
    success,
    exportData: () => exportData.mutate(),
    deleteData: () => deleteData.mutate(),
  };
}
