// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalPicker, type PickerGoal } from './goal-picker';

afterEach(cleanup);

const catalog: PickerGoal[] = [
  { key: 'standup', titleVi: 'Họp stand-up hằng ngày', summaryVi: 'Báo việc.', fits: ['a2', 'b2'] },
  { key: 'demo', titleVi: 'Demo và trình bày tính năng', summaryVi: 'Mở đầu.', fits: ['b1', 'c1'] },
];

describe('GoalPicker (AC1)', () => {
  it('lists the goals, says they are made by AI and cannot save before one is picked', () => {
    render(<GoalPicker catalog={catalog} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Họp stand-up hằng ngày/)).toBeTruthy();
    expect(screen.getByText(/Bài học do AI soạn, có thể sai/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Đặt mục tiêu' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('submits the goal, the level and the optional deadline', () => {
    const onSubmit = vi.fn();
    render(<GoalPicker catalog={catalog} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText(/Demo và trình bày/));
    fireEvent.change(screen.getByLabelText('Trình độ'), { target: { value: 'b2' } });
    fireEvent.change(screen.getByLabelText('Hạn chót (không bắt buộc)'), {
      target: { value: '2026-12-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt mục tiêu' }));
    expect(onSubmit).toHaveBeenCalledWith({ goalKey: 'demo', level: 'b2', deadline: '2026-12-01' });
  });

  it('sends no level and no deadline when both are left alone', () => {
    const onSubmit = vi.fn();
    render(<GoalPicker catalog={catalog} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText(/Họp stand-up/));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt mục tiêu' }));
    // Left on automatic: no level is sent, so the server uses the listening level.
    expect(onSubmit).toHaveBeenCalledWith({ goalKey: 'standup', level: null, deadline: null });
  });

  it('does not let a goal be picked twice, nor a fourth goal', () => {
    const { unmount } = render(
      <GoalPicker catalog={catalog} taken={['demo']} onSubmit={vi.fn()} />,
    );
    expect((screen.getByLabelText(/Demo và trình bày/) as HTMLInputElement).disabled).toBe(true);
    unmount();
    render(<GoalPicker catalog={catalog} atLimit onSubmit={vi.fn()} />);
    expect(screen.getByText(/Bạn đã có 3 mục tiêu/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Đặt mục tiêu' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('edits the level and the deadline of one goal without changing the goal', () => {
    const onSubmit = vi.fn();
    render(
      <GoalPicker
        catalog={catalog}
        initial={{ goalKey: 'demo', level: 'b1', deadline: '2026-12-01' }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.change(screen.getByLabelText('Trình độ'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Hạn chót (không bắt buộc)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(onSubmit).toHaveBeenCalledWith({ goalKey: 'demo', level: 'c1', deadline: null });
  });

  it('shows a save error in Vietnamese', () => {
    render(<GoalPicker catalog={catalog} error="Chưa lưu được mục tiêu." onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('Chưa lưu được mục tiêu');
  });
});
