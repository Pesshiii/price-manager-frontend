import { useQuery } from '@tanstack/react-query';
import { listSupplierFeeds, type SupplierFeedListParams } from '../api';
import { supplierFeedKeys } from '../queryKeys';

export function useSupplierFeeds(params?: SupplierFeedListParams) {
  return useQuery({
    queryKey: supplierFeedKeys.list(params as Record<string, unknown> | undefined),
    queryFn: () => listSupplierFeeds(params),
  });
}
