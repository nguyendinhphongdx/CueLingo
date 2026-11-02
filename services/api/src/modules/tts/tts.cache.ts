import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Where finished audio is kept, keyed by a hash of what was said. */
export interface TtsCache {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, audio: Uint8Array): Promise<void>;
}

/** Files on disk: fine for one server; swap for object storage when there are several. */
export function createFileTtsCache(dir: string): TtsCache {
  const path = (key: string) => join(dir, `${key}.wav`);
  return {
    async get(key) {
      try {
        return new Uint8Array(await readFile(path(key)));
      } catch {
        return null;
      }
    },
    async put(key, audio) {
      await mkdir(dir, { recursive: true });
      // Write then rename, so a reader never sees half a file.
      const temp = `${path(key)}.${process.pid}.tmp`;
      await writeFile(temp, audio);
      await rename(temp, path(key));
    },
  };
}

export function createInMemoryTtsCache(): TtsCache & { size(): number } {
  const store = new Map<string, Uint8Array>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, audio) {
      store.set(key, audio);
    },
    size: () => store.size,
  };
}
