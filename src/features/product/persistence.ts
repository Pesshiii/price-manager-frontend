import { emptyInstructions, type Instructions } from '@/features/dataframe/types';
import type { UploadedFileInfo } from '@/features/dataframe/components/DataframeBuilder';
import type { ImportCommitResult, ImportMapping, ImportPreviewResult } from './types';

export type SourceMode = 'saved' | 'adhoc';

export interface ImportPersistedState {
  version: 1;
  mode: SourceMode;
  step: 0 | 1 | 2;
  sessionId: string | null;
  filename: string | null;
  pipelineId: number | null;
  adhocSessionId: string | null;
  adhocUploadedFile: UploadedFileInfo | null;
  adhocInstructions: Instructions;
  columns: string[];
  category: number | null;
  mapping: ImportMapping;
  previewResult: ImportPreviewResult | null;
  commitResult: ImportCommitResult | null;
}

export const STORAGE_KEY = 'product-import-state-v1';

export function defaultPersistedState(): ImportPersistedState {
  return {
    version: 1,
    mode: 'saved',
    step: 0,
    sessionId: null,
    filename: null,
    pipelineId: null,
    adhocSessionId: null,
    adhocUploadedFile: null,
    adhocInstructions: emptyInstructions(),
    columns: [],
    category: null,
    mapping: {},
    previewResult: null,
    commitResult: null,
  };
}

export function loadPersistedState(): ImportPersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ImportPersistedState>;
    if (parsed?.version !== 1) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { ...defaultPersistedState(), ...parsed } as ImportPersistedState;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

export function savePersistedState(state: ImportPersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // QuotaExceeded or unavailable storage — silently ignore
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
