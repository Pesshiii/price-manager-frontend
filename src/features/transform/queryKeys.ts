export const transformKeys = {
  all: ['transform'] as const,
  snapshotFields: () => [...transformKeys.all, 'snapshot-fields'] as const,
  snapshotField: (id: number) => [...transformKeys.all, 'snapshot-fields', id] as const,
  rules: (mappingId: number) => [...transformKeys.all, 'rules', mappingId] as const,
  snapshots: (productId: number) =>
    [...transformKeys.all, 'snapshots', 'product', productId] as const,
  snapshotsBySupplier: (supplierId: number) =>
    [...transformKeys.all, 'snapshots', 'supplier', supplierId] as const,
};
