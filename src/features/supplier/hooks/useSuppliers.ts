import { useQuery } from '@tanstack/react-query';
import { listSuppliers } from '../api';
import { supplierKeys } from '../queryKeys';

export function useSuppliers() {
  return useQuery({
    queryKey: supplierKeys.list(),
    queryFn: listSuppliers,
  });
}
