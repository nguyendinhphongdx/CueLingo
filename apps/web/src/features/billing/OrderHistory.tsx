import type { BillingOrder, BillingOrderStatus } from '@cuelingo/shared';
import { ListCard } from '@cuelingo/ui/components/section';
import { formatDateVn, formatVnd, planName } from '@cuelingo/ui/lib/usage';
import Link from 'next/link';

const STATUS_LABEL: Record<BillingOrderStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
};

/** The user's own orders (AC9): plan, period, amount, status and date. A pending one links back to its QR. */
export function OrderHistory({ orders }: { orders: BillingOrder[] }) {
  if (orders.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có giao dịch nào.</p>;
  }
  return (
    <ListCard>
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
        >
          <div>
            <p className="font-medium">
              Gói {planName(order.plan)} · {order.period === 'year' ? '1 năm' : '1 tháng'}
            </p>
            <p className="text-muted-foreground text-xs">{formatDateVn(order.createdAt)}</p>
          </div>
          <div className="text-right">
            <p>{formatVnd(order.amount)}</p>
            <p className="text-muted-foreground text-xs">
              {order.byAdmin ? 'Admin tặng' : STATUS_LABEL[order.status]}
              {order.status === 'pending' ? (
                <>
                  {' · '}
                  <Link className="underline" href={`/checkout?order=${order.id}`}>
                    Tiếp tục
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ListCard>
  );
}
