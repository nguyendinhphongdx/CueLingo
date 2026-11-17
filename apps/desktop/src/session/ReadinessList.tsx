import { Button } from '@cuelingo/ui/components/button';
import { StatusRow } from '@cuelingo/ui/components/status-row';
import type { ReadinessFix, ReadinessItem } from './readiness';

/** Pure list: one StatusRow per item, each with its own fix button. */
export function ReadinessList({
  items,
  onFix,
}: {
  items: readonly ReadinessItem[];
  onFix: (item: ReadinessItem, fix: ReadinessFix) => void;
}) {
  return (
    <div
      role="list"
      aria-label="Sẵn sàng họp"
      className="divide-border divide-y rounded-lg border px-4"
    >
      {items.map((item) => (
        <div role="listitem" key={item.id}>
          <StatusRow
            status={item.status}
            title={item.title}
            detail={item.detail}
            action={
              item.fix ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => onFix(item, item.fix!)}
                >
                  {item.fix.label}
                </Button>
              ) : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
