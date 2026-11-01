import { retentionSweep } from './retention';
import type { RegisteredJob } from './types';

/** Every job this worker handles. Add new jobs here (and to JobName in @cuelingo/shared). */
export const jobs: RegisteredJob[] = [retentionSweep];
