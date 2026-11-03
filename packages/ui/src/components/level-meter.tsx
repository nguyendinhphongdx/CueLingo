import { cn } from '../lib/utils';

export const LEVEL_METER_BARS = 24;
/** Share of the height a bar never drops below, so the meter never looks dead. */
export const LEVEL_METER_MIN = 0.12;

export interface LevelMeterProps {
  /** Recent levels in 0..1, oldest first; the newest is drawn on the right. */
  levels: number[];
  label: string;
  /** False while nothing is being captured: bars rest at the minimum and look dimmed. */
  active?: boolean;
  className?: string;
}

/** Quiet speech sits near 0.01..0.1 RMS, so the scale is a square root to stay readable. */
export function barHeight(level: number): number {
  const safe = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  return LEVEL_METER_MIN + (1 - LEVEL_METER_MIN) * Math.sqrt(safe);
}

/** A small waveform of the latest audio levels; inherits the text colour. */
export function LevelMeter({ levels, label, active = true, className }: LevelMeterProps) {
  const recent = levels.slice(-LEVEL_METER_BARS);
  const bars = [...Array<number>(LEVEL_METER_BARS - recent.length).fill(0), ...recent];
  const latest = recent.length > 0 ? recent[recent.length - 1]! : 0;
  const heights = bars.map((level) => (active ? barHeight(level) : LEVEL_METER_MIN));
  const simple = active ? barHeight(latest) : LEVEL_METER_MIN;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={active ? Math.round(Math.min(1, Math.max(0, latest)) * 100) / 100 : 0}
      data-active={active}
      className={cn('h-6 w-full max-w-48', !active && 'opacity-40', className)}
    >
      <div className="flex h-full items-center gap-0.5 motion-reduce:hidden" aria-hidden="true">
        {heights.map((height, index) => (
          <span
            key={index}
            data-bar=""
            className="w-full rounded-full bg-current opacity-80 transition-[height] duration-75"
            style={{ height: `${Math.round(height * 100)}%` }}
          />
        ))}
      </div>
      <div className="hidden h-full items-center motion-reduce:flex" aria-hidden="true">
        <span
          data-simple-bar=""
          className="h-1.5 rounded-full bg-current opacity-80"
          style={{ width: `${Math.round(simple * 100)}%` }}
        />
      </div>
    </div>
  );
}
