'use client';

import type { BillingOrder, CreateOrderRequest } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const BILLING_ROOT = ['billing'] as const;

/** How often the open order is asked for while the QR is shown (AC5). */
export const ORDER_POLL_MS = 3000;

/** Poll only while the order waits for money: `paid`, `expired` and `cancelled` are final, so polling stops. */
export function orderRefetchInterval(order: BillingOrder | undefined): number | false {
  return order?.status === 'pending' ? ORDER_POLL_MS : false;
}

/** What can be bought and the plan in force. `enabled: false` means the upgrade button stays hidden. */
export function useBillingOverview() {
  const query = useQuery({
    queryKey: [...BILLING_ROOT, 'overview'],
    queryFn: () => client.billing.overview(),
  });
  return { overview: query.data, loading: query.isPending, error: describeError(query.error) };
}

/** The signed-in user's own orders, newest first. */
export function useOrders() {
  const query = useQuery({
    queryKey: [...BILLING_ROOT, 'orders'],
    queryFn: () => client.billing.listOrders(),
  });
  return { orders: query.data ?? [], loading: query.isPending, error: describeError(query.error) };
}

/** Starts (or resumes) a purchase. The price is never sent: only the plan and period. */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (input: CreateOrderRequest) => client.billing.createOrder(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...BILLING_ROOT, 'orders'] }),
  });
  return {
    create: create.mutateAsync,
    creating: create.isPending,
    error: describeError(create.error),
  };
}

/** One order, polled while it is pending. When it turns paid the plan and allowances are read again. */
export function useOrder(id: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...BILLING_ROOT, 'order', id],
    queryFn: ({ signal }) => client.billing.getOrder(id as string, { signal }),
    enabled: id !== null,
    staleTime: 0,
    refetchInterval: (q) => orderRefetchInterval(q.state.data),
  });
  const status = query.data?.status;
  useEffect(() => {
    if (status !== 'paid') return;
    void queryClient.invalidateQueries({ queryKey: [...BILLING_ROOT, 'overview'] });
    void queryClient.invalidateQueries({ queryKey: [...BILLING_ROOT, 'orders'] });
    void queryClient.invalidateQueries({ queryKey: ['usage'] });
  }, [status, queryClient]);
  return {
    order: query.data,
    loading: query.isPending && id !== null,
    error: describeError(query.error),
  };
}
