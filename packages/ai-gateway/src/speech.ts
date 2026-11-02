/** Text to speech through Gemini's REST API, and the audio plumbing around it. */

export interface SpeakArgs {
  model: string;
  text: string;
  voice: string;
  signal: AbortSignal;
}

export interface SpeakOutput {
  audio: Uint8Array;
  mimeType: 'audio/wav';
  inputTokens?: number;
  outputTokens?: number;
}

export type SpeakFn = (args: SpeakArgs) => Promise<SpeakOutput>;

export const DEFAULT_VOICE = 'Kore';

/** 16-bit mono PCM wrapped in a WAV header, so any browser or `<audio>` element can play it. */
export function wrapPcmAsWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new DataView(new ArrayBuffer(44));
  const write = (offset: number, text: string) =>
    [...text].forEach((char, i) => header.setUint8(offset + i, char.charCodeAt(0)));
  write(0, 'RIFF');
  header.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  write(36, 'data');
  header.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header.buffer), 0);
  wav.set(pcm, 44);
  return wav;
}

const isWav = (bytes: Uint8Array) =>
  bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF';

/** Gemini returns either a ready WAV or raw PCM (`audio/L16;rate=24000`); give back a WAV either way. */
export function toWav(bytes: Uint8Array, mimeType: string): Uint8Array {
  if (isWav(bytes)) return bytes;
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24_000);
  return wrapPcmAsWav(bytes, rate);
}

interface GeminiSpeechResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

export function createGeminiSpeak(apiKey: string, request: typeof fetch = fetch): SpeakFn {
  return async ({ model, text, voice, signal }) => {
    const response = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        // The key goes in a header, not the URL, so it never lands in a log line.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
        signal,
      },
    );
    const body = (await response.json().catch(() => ({}))) as GeminiSpeechResponse;
    if (!response.ok) {
      throw new Error(`speech request failed (${response.status}): ${body.error?.message ?? ''}`);
    }
    const inline = body.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    )?.inlineData;
    if (!inline?.data) throw new Error('speech response had no audio');
    return {
      audio: toWav(new Uint8Array(Buffer.from(inline.data, 'base64')), inline.mimeType ?? ''),
      mimeType: 'audio/wav',
      inputTokens: body.usageMetadata?.promptTokenCount,
      outputTokens: body.usageMetadata?.candidatesTokenCount,
    };
  };
}
