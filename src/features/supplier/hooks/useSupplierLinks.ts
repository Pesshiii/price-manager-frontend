import { useQuery } from '@tanstack/react-query';
import { listSupplierLinks, type SupplierLinkListParams } from '../api';
import { supplierLinkKeys } from '../queryKeys';

export function useSupplierLinks(params?: { supplier?: number; supplier_sku?: string }) {
  return useQuery({
    queryKey: supplierLinkKeys.list(params ?? {}),
    queryFn: () => listSupplierLinks(params as SupplierLinkListParams | undefined),
  });
}
