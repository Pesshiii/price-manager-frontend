import { useQuery } from '@tanstack/react-query';
import { previewPipeline } from '../api';
import { dataframeKeys } from '../queryKeys';
import type { Instructions, PreviewResult } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

export interface UsePreviewArgs {
  instructions: Instructions;
  sessionId: string | null;
  upTo?: number;
  rowLimit?: number;
  debounceMs?: number;
}

export function usePipelinePreview({
  instructions,
  sessionId,
  upTo,
  rowLimit = 100,
  debounceMs = 300,
}: UsePreviewArgs) {
  const debounced = useDebouncedValue(instructions, debounceMs);
  const debouncedUpTo = useDebouncedValue(upTo, debounceMs);

  return useQuery<PreviewResult>({
    queryKey: dataframeKeys.preview(sessionId ?? '', debouncedUpTo, {
      instructions: debounced,
      rowLimit,
    }),
    queryFn: () =>
      previewPipeline({
        instructions: debounced,
        sessionId: sessionId as string,
        upTo: debouncedUpTo,
        rowLimit,
      }),
    enabled: !!sessionId && !!debounced.reader.func,
    retry: false,
  });
}
