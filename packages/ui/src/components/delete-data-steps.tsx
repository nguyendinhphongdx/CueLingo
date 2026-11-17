'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';

export const DELETE_DATA_PHRASE = 'XOA DU LIEU';
export const canConfirmDeleteData = (value: string) => value === DELETE_DATA_PHRASE;

/** What "delete all my data" removes. Keep in step with `deleteMyData` in the API privacy repository. */
export const DELETE_DATA_ITEMS: readonly string[] = [
  'Cuộc họp, transcript và debrief',
  'Cụm từ đã lưu, lịch ôn tập và lịch sử ôn',
  'Thuật ngữ của bạn',
  'Hội thoại với trợ lý AI',
  'Số liệu tiến độ và lượng dùng đã ghi',
];

export interface DeleteDataStepsProps {
  /** What will be lost, one line each (step 1). */
  items: readonly string[];
  pending: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Deleting everything takes two steps. Step 1 lists what goes; step 2 asks for the phrase, keeps the
 * delete button off until it matches exactly, and puts the focus on Huỷ so a stray Enter refuses.
 */
export function DeleteDataSteps({ items, pending, onConfirm, onCancel }: DeleteDataStepsProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [value, setValue] = useState('');
  const inputId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (step === 2) cancelRef.current?.focus();
  }, [step]);

  const frame = 'border-destructive/30 mt-4 max-w-md space-y-3 rounded-lg border p-4';
  if (step === 1) {
    return (
      <div className={frame} role="region" aria-label="Xoá toàn bộ dữ liệu">
        <p className="text-body-sm font-medium">Bước 1 trên 2: những gì sẽ bị xoá</p>
        <ul className="text-muted-foreground text-body-sm list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-body-sm">Tài khoản đăng nhập được giữ lại. Không thể hoàn tác.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => setStep(2)}>
            Tiếp tục
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Huỷ
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className={frame} role="region" aria-label="Xác nhận xoá toàn bộ dữ liệu">
      <p className="text-body-sm font-medium">Bước 2 trên 2: xác nhận</p>
      <label htmlFor={inputId} className="text-body-sm block">
        Gõ <span className="font-mono font-medium">{DELETE_DATA_PHRASE}</span> để xác nhận. Dữ liệu
        sẽ mất vĩnh viễn.
      </label>
      <Input
        id={inputId}
        value={value}
        disabled={pending}
        autoComplete="off"
        aria-invalid={value.length > 0 && !canConfirmDeleteData(value)}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={!canConfirmDeleteData(value) || pending}
          onClick={onConfirm}
        >
          {pending ? 'Đang xoá…' : 'Xác nhận xoá'}
        </Button>
        <Button ref={cancelRef} variant="outline" disabled={pending} onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
