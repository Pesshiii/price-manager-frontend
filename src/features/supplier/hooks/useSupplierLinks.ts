import { useQuery } from '@tanstack/react-query';
import { listSupplierLinks } from '../api';
import { supplierLinkKeys } from '../queryKeys';

export function useSupplierLinks(params?: { supplier?: number; sku?: string }) {
  return useQuery({
    queryKey: supplierLinkKeys.list(params ?? {}),
    queryFn: () => listSupplierLinks(params),
  });
}
