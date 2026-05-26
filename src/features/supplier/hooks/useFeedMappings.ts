import { useQuery } from '@tanstack/react-query';
import { listFeedMappings } from '../api';
import { feedMappingKeys } from '../queryKeys';

export function useFeedMappings(supplierId?: number) {
  return useQuery({
    queryKey: feedMappingKeys.list(supplierId),
    queryFn: () => listFeedMappings(supplierId),
  });
}
