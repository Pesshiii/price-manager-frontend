import { useQuery } from '@tanstack/react-query';
import { getSupplierFeed } from '../api';
import { supplierFeedKeys } from '../queryKeys';

/**
 * Fetches a single SupplierFeed by id.
 * Polls every 3 s while the feed is in 'processing' status.
 */
export function useSupplierFeed(id: number) {
  return useQuery({
    queryKey: supplierFeedKeys.detail(id),
    queryFn: () => getSupplierFeed(id),
    refetchInterval: (query) => {
      const feed = query.state.data;
      return feed?.status === 'processing' ? 3000 : false;
    },
  });
}
