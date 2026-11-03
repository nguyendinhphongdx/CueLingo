/** Speech to text through Gemini's REST API with the audio sent inline (ADR 0014). */

export interface TranscribeArgs {
  model: string;
  system: string;
  prompt: string;
  /** A complete WAV file. */
  audio: Uint8Array;
  signal: AbortSignal;
}

export interface TranscribeOutput {
  /** Empty when the audio held no intelligible speech. */
  text: string;
  inputTokens?: number;
  outputTokens?: number;
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
  return async ({ model, system, prompt, audio, signal }) => {
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
          generationConfig: { temperature: 0 },
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
