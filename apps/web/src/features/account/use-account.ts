import {
  DELETE_ACCOUNT_CONFIRMATION,
  type DeleteAccountRequest,
  type UpdateMeRequest,
} from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const ACCOUNT_KEY = ['account'] as const;
const DEVICE_TOKENS_KEY = ['device-tokens'] as const;

/** Account profile and signed-in devices. Presentation state stays in AccountSettingsPage. */
export function useAccount() {
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: ACCOUNT_KEY, queryFn: () => client.me.get() });
  const devices = useQuery({
    queryKey: DEVICE_TOKENS_KEY,
    queryFn: () => client.device.listTokens(),
  });
  const update = useMutation({
    mutationFn: (input: UpdateMeRequest) => client.me.update(input),
    onSuccess: (me) => queryClient.setQueryData(ACCOUNT_KEY, me),
  });
  const revokeDevice = useMutation({
    mutationFn: (id: string) => client.device.revokeToken(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DEVICE_TOKENS_KEY });
    },
  });
  const closeAccount = useMutation({
    mutationFn: (input: DeleteAccountRequest) => client.me.remove(input),
  });

  return {
    me: account.data ?? null,
    devices: devices.data?.devices ?? [],
    loading: account.isPending || devices.isPending,
    updating: update.isPending,
    revokingDeviceId: revokeDevice.isPending ? revokeDevice.variables : null,
    closing: closeAccount.isPending,
    error:
      describeError(account.error) ??
      describeError(devices.error) ??
      describeError(update.error) ??
      describeError(revokeDevice.error) ??
      describeError(closeAccount.error),
    updateName: (name: string) => update.mutateAsync({ name: name.trim() }),
    revokeDevice: (id: string) => revokeDevice.mutateAsync(id),
    closeAccount: () => closeAccount.mutateAsync({ confirm: DELETE_ACCOUNT_CONFIRMATION }),
  };
}
