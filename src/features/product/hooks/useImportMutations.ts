import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commitImport, previewImport } from '../api';
import { brandKeys, categoryKeys, productKeys } from '../queryKeys';

export function useImportPreview() {
  return useMutation({ mutationFn: previewImport });
}

export function useImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: commitImport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      qc.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}
