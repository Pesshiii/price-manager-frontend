import { useQuery } from '@tanstack/react-query';
import { listCharacteristicTypes } from '../api';
import { charTypeKeys } from '../queryKeys';

export function useCharacteristicTypes(params: { category?: number } = {}) {
  return useQuery({
    queryKey: charTypeKeys.list(params),
    queryFn: () => listCharacteristicTypes(params),
    staleTime: 5 * 60_000,
  });
}
