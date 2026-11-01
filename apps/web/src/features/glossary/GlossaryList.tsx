import type { GlossaryTerm } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';

/** Pure presentation of the user's terms: no data fetching, easy to test. */
export function GlossaryList({
  items,
  onRemove,
}: {
  items: GlossaryTerm[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Chưa có thuật ngữ nào. Thêm tên khách hàng, sản phẩm hoặc từ chuyên ngành ở trên.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {items.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2">
          <span>
            <strong>{t.term}</strong>
            {t.translation && <span className="text-muted-foreground"> — {t.translation}</span>}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => onRemove(t.id)}
            aria-label={`Xoá ${t.term}`}
          >
            Xoá
          </Button>
        </li>
      ))}
    </ul>
  );
}
