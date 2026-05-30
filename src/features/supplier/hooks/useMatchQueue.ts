import { useQuery } from '@tanstack/react-query';
import { listMatchQueue } from '../api';
import { matchQueueKeys } from '../queryKeys';

/**
 * Fetches the MatchQueue for the given feed.
 * Only enabled when the feed has entries to resolve (status partial/matched).
 */
export function useMatchQueue(feedId: number, enabled = true) {
  return useQuery({
    queryKey: matchQueueKeys.list(feedId),
    queryFn: () => listMatchQueue(feedId),
    enabled,
  });
}
