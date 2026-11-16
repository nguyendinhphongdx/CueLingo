import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OFFERS, overview } from './fixtures';
import { PlanPicker } from './PlanPicker';

const render = (o = overview(), onSelect = vi.fn()) =>
  renderToStaticMarkup(<PlanPicker overview={o} onSelect={onSelect} />);

describe('PlanPicker', () => {
  it('shows Pro and Ultra with VND prices per period and the allowances from the offers (AC1)', () => {
    const markup = render();
    expect(markup).toContain('data-plan="pro"');
    expect(markup).toContain('data-plan="ultra"');
    for (const price of ['99.000 ₫/tháng', '990.000 ₫/năm', '249.000 ₫/tháng', '2.490.000 ₫/năm']) {
      expect(markup).toContain(price);
    }
    expect(markup).toContain('20 giờ');
    expect(markup).toContain('60 giờ');
    expect(markup).toContain('100 lần');
    expect(markup).toContain('Không giới hạn');
  });

  it('says a year is 10 months only when the prices are', () => {
    expect(render()).toContain('chỉ tính 10 tháng');
    const odd = OFFERS.map((o) =>
      o.plan === 'pro' && o.period === 'year' ? { ...o, amount: 1_000_000 } : o,
    );
    const markup = render(overview({}, odd));
    // Ultra still qualifies, so exactly one note remains.
    expect(markup.match(/chỉ tính 10 tháng/g)).toHaveLength(1);
  });

  it('explains the Pro to Ultra conversion only for someone who has Pro left', () => {
    const note = 'quy đổi thành ngày Ultra';
    expect(render(overview({ plan: 'free' }))).not.toContain(note);
    expect(
      render(overview({ plan: 'pro', expiresAt: '2026-12-01T00:00:00.000Z', source: 'payment' })),
    ).toContain(note);
  });

  it('lists only what the server offers (a lower plan is already filtered out)', () => {
    const ultraOnly = OFFERS.filter((o) => o.plan === 'ultra');
    const markup = render(
      overview({ plan: 'pro', expiresAt: '2026-12-01T00:00:00.000Z' }, ultraOnly),
    );
    expect(markup).not.toContain('data-plan="pro"');
    expect(markup).toContain('data-plan="ultra"');
  });

  it('disables the buttons while an order is being created', () => {
    const markup = renderToStaticMarkup(
      <PlanPicker overview={overview()} busy="pro:month" onSelect={() => {}} />,
    );
    expect(markup.match(/disabled=""/g)?.length).toBe(4);
  });

  it('calls onSelect with the plan and period chosen', () => {
    const onSelect = vi.fn();
    const tree = PlanPicker({ overview: overview(), onSelect }) as {
      props: { children: unknown[] };
    };
    // Find the Ultra year button by walking the element tree.
    const buttons: Array<{ props: { onClick: () => void; children: unknown } }> = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const element = node as {
        type?: unknown;
        props?: { children?: unknown; onClick?: () => void };
      };
      if (element.props?.onClick) buttons.push(element as never);
      walk(element.props?.children);
    };
    walk(tree);
    buttons[3]!.props.onClick();
    expect(onSelect).toHaveBeenCalledWith('ultra', 'year');
  });

  it('says so when nothing can be bought', () => {
    expect(render(overview({}, []))).toContain('chưa có gói nào');
  });
});
