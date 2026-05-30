import { useQuery } from '@tanstack/react-query';
import { getSupplier } from '../api';
import { supplierKeys } from '../queryKeys';

export function useSupplier(id: number) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: () => getSupplier(id),
    enabled: !isNaN(id),
  });
}
