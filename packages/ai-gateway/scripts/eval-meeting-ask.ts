/**
 * Eval of `meeting.ask@v1` against the real model: AC7 (short), AC12 (not found), AC13 (injection), citing.
 *
 *   GEMINI_API_KEY=… pnpm --filter @cuelingo/ai-gateway exec tsx scripts/eval-meeting-ask.ts
 *
 * Prints fixture ids, pass/fail and timings; answers only with `--show` (fixtures hold no personal data).
 */
import { meetingAskFixtures } from '@cuelingo/prompts';
import { stripSourceTags } from '@cuelingo/shared';
import { createAiGateway } from '../src';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

const gateway = createAiGateway({ googleApiKey: key });
let failed = 0;
for (const fixture of meetingAskFixtures) {
  const started = performance.now();
  let first = 0;
  let answer = '';
  for await (const part of gateway.ask(fixture.input)) {
    if (part.type !== 'text_delta') continue;
    first ||= Math.round(performance.now() - started);
    answer += part.text;
  }
  const words = stripSourceTags(answer).split(/\s+/).filter(Boolean).length;
  const problems = [
    ...(fixture.mustMatch ?? []).filter((p) => !p.test(answer)).map((p) => `missing ${p}`),
    ...(fixture.mustNotMatch ?? []).filter((p) => p.test(answer)).map((p) => `has ${p}`),
    // 80 words or 5 bullets; bullets may run a little over, so the check allows a margin.
    ...(words > 110 ? [`too long (${words} words)`] : []),
  ];
  if (problems.length) failed += 1;
  console.warn(
    `${problems.length ? 'FAIL' : 'ok  '} ${fixture.id} first=${first}ms words=${words} ${problems.join('; ')}`,
  );
  if (process.argv.includes('--show')) console.warn(answer);
}
console.warn(`${meetingAskFixtures.length - failed}/${meetingAskFixtures.length} passed`);
process.exit(failed ? 1 : 0);
