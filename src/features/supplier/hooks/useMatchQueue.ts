import { useInfiniteQuery } from '@tanstack/react-query';
import { listMatchQueue } from '../api';
import { matchQueueKeys } from '../queryKeys';

export function useMatchQueue(feedId: number, enabled = true) {
  return useInfiniteQuery({
    queryKey: matchQueueKeys.list(feedId),
    queryFn: ({ pageParam }) => listMatchQueue(feedId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      try {
        return Number(new URL(lastPage.next).searchParams.get('page'));
      } catch {
        return undefined;
      }
    },
    enabled,
  });
}
