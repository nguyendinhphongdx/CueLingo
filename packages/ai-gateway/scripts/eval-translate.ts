/* Live eval for translate.realtime: pnpm --filter @cuelingo/api exec tsx ../../packages/ai-gateway/scripts/eval-translate.ts
   Model under test comes from AI_TRANSLATE_MODEL; key from GEMINI_API_KEY. */
import { translateFixtures } from '@cuelingo/prompts';
import { createAiGateway } from '../src/gateway';
import { TASKS } from '../src/tasks';

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error('GEMINI_API_KEY is not set');
const gateway = createAiGateway({ googleApiKey: key });
const RUNS = 3;

const latencies: number[] = [];
let passed = 0;
let total = 0;
for (const fixture of translateFixtures) {
  for (let i = 0; i < RUNS; i += 1) {
    const out = await gateway.llm('translate.realtime', fixture.input);
    latencies.push(out.latencyMs);
    const ok = fixture.mustContain.every((s) =>
      s.split('|').some((alt) => out.text.toLowerCase().includes(alt.toLowerCase())),
    );
    total += 1;
    if (ok) passed += 1;
    if (i === 0)
      console.warn(
        `${ok ? 'PASS' : 'FAIL'} [${out.fallback ? 'fallback ' : ''}${out.latencyMs}ms] ${fixture.name}: ${out.text}`,
      );
  }
}
latencies.sort((a, b) => a - b);
const pct = (p: number) =>
  latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))];
console.warn(
  `model=${TASKS['translate.realtime'].model} pass=${passed}/${total} p50=${pct(0.5)}ms p95=${pct(0.95)}ms`,
);
