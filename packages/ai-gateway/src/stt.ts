/** Speech to text through Gemini's REST API with the audio sent inline (ADR 0014). */

export interface TranscribeArgs {
  model: string;
  system: string;
  prompt: string;
  /** A complete WAV file. */
  audio: Uint8Array;
  /** Ask the model for a JSON object `{text, speaker, hint?}` (prompt stt/v4) instead of plain text. */
  json?: boolean;
  signal: AbortSignal;
}

export interface TranscribeOutput {
  /** Empty when the audio held no intelligible speech. */
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type SpeakerLabel =
  | 'speaker_1'
  | 'speaker_2'
  | 'speaker_3'
  | 'speaker_4'
  | 'speaker_5'
  | 'speaker_6'
  | 'speaker_7'
  | 'speaker_8'
  | 'new'
  | 'unknown';

export interface SpeakerGuess {
  label: SpeakerLabel;
  /** A short description of the voice; only the model's own words, cut and cleaned. */
  hint?: string;
}

const SPEAKER_LABELS = new Set<string>([
  'new',
  'unknown',
  ...Array.from({ length: 8 }, (_, i) => `speaker_${i + 1}`),
]);
const MAX_HINT_CHARS = 60;
const stripControl = (text: string): string => text.replace(/[\p{Cc}\u2028\u2029]/gu, ' ');

/**
 * Reads the JSON answer of stt/v4 defensively. Broken JSON keeps the raw words as the text with an
 * `unknown` speaker; a label outside the valid set becomes `unknown`; the hint is cleaned and cut.
 */
export function parseSpeakerOutput(raw: string): { text: string; speaker: SpeakerGuess } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = undefined;
  }
  const record =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  if (!record || typeof record.text !== 'string') {
    return { text: stripControl(raw).replace(/\s+/g, ' ').trim(), speaker: { label: 'unknown' } };
  }
  const label: SpeakerLabel =
    typeof record.speaker === 'string' && SPEAKER_LABELS.has(record.speaker)
      ? (record.speaker as SpeakerLabel)
      : 'unknown';
  const hint =
    typeof record.hint === 'string'
      ? stripControl(record.hint).replace(/\s+/g, ' ').trim().slice(0, MAX_HINT_CHARS).trim()
      : '';
  return { text: record.text, speaker: hint ? { label, hint } : { label } };
}

export type TranscribeFn = (args: TranscribeArgs) => Promise<TranscribeOutput>;

interface GeminiTranscribeResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export function createGeminiTranscribe(
  apiKey: string,
  request: typeof fetch = fetch,
): TranscribeFn {
  return async ({ model, system, prompt, audio, json, signal }) => {
    const response = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        // The key goes in a header, not the URL, so it never lands in a log line.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: Buffer.from(audio).toString('base64'),
                  },
                },
              ],
            },
          ],
          generationConfig: json
            ? {
                temperature: 0,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    text: { type: 'STRING' },
                    speaker: { type: 'STRING' },
                    hint: { type: 'STRING' },
                  },
                  required: ['text', 'speaker'],
                },
              }
            : { temperature: 0 },
        }),
        signal,
      },
    );
    // Only the status goes into the error: provider bodies may echo what was said.
    if (!response.ok) throw new Error(`transcribe request failed (${response.status})`);
    const body = (await response.json().catch(() => ({}))) as GeminiTranscribeResponse;
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    return {
      text,
      inputTokens: body.usageMetadata?.promptTokenCount,
      outputTokens: body.usageMetadata?.candidatesTokenCount,
    };
  };
}
