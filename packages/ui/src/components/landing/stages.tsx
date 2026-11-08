'use client';

import { useState, type ReactNode } from 'react';
import styles from './landing.module.css';

export type Stage = { name: string; clause: string; note: string; visual: ReactNode };

/** One range input drives both fields: the clause on the left, a fragment of the product on the right. */
export function Stages({ stages }: { stages: readonly Stage[] }) {
  const [index, setIndex] = useState(0);
  const stage = stages[index] ?? stages[0];
  if (!stage) return null;

  return (
    <>
      <div className={styles.stagesFields}>
        <div className={styles.stageClause} aria-live="polite">
          <h3>{stage.clause}</h3>
          <p>{stage.note}</p>
        </div>
        <div className={styles.stageVisual}>{stage.visual}</div>
      </div>
      <div className={styles.stageControl}>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={stages.length - 1}
          step={1}
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-label="Chọn giai đoạn của cuộc họp"
          aria-valuetext={stage.name}
        />
        <div className={styles.stageNames}>
          {stages.map((item, i) => (
            <button
              key={item.name}
              type="button"
              className={`${styles.stageName} ${i === index ? styles.stageNameActive : ''}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
