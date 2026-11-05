import type { ModelEvent, ModelPort, ModelStepInput } from './model';

/** A fake model: each call of `step` plays the next scripted list of events and records its input. */
export function scriptedModel(steps: Array<ModelEvent[] | Error>): ModelPort & {
  inputs: ModelStepInput[];
} {
  const inputs: ModelStepInput[] = [];
  return {
    inputs,
    step(input) {
      inputs.push({ ...input, messages: [...input.messages] });
      const script = steps[inputs.length - 1] ?? [{ type: 'finish', reason: 'stop' }];
      return (async function* () {
        if (script instanceof Error) throw script;
        for (const event of script) yield event;
      })();
    },
  };
}

export const finish: Extract<ModelEvent, { type: 'finish' }> = {
  type: 'finish',
  reason: 'stop',
  inputTokens: 10,
  outputTokens: 5,
};
export const text = (t: string): ModelEvent => ({ type: 'text_delta', text: t });
export const call = (name: string, input: unknown = {}): ModelEvent => ({
  type: 'tool_call',
  call: { id: 'model-id', name, input },
});
