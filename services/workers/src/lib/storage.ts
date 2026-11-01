/** Where user audio lives once users opt in to saving it (S3-compatible, chosen before beta). */
export interface ObjectStorage {
  /** Idempotent: deleting a key that does not exist is not an error. */
  deleteMany(keys: string[]): Promise<void>;
}

/**
 * Placeholder until a storage provider exists. Audio is off by default (ADR-0006), so nothing
 * should ever be stored; if a row has an audio key anyway, fail loudly instead of pretending.
 */
export function createUnconfiguredStorage(): ObjectStorage {
  return {
    async deleteMany(keys) {
      if (keys.length > 0)
        throw new Error(
          `No object storage configured, cannot delete ${keys.length} audio object(s)`,
        );
    },
  };
}
