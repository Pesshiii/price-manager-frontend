/**
 * React Query cache keys for the Supplier feature.
 *
 * Convention (mirrors product/queryKeys.ts):
 *   ['suppliers', ...] — top-level namespace
 *   Invalidating ['suppliers'] clears everything in this feature.
 */

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: () => [...supplierKeys.lists()] as const,
  detail: (id: number) => [...supplierKeys.all, 'detail', id] as const,
};

export const feedMappingKeys = {
  all: ['feed-mappings'] as const,
  lists: () => [...feedMappingKeys.all, 'list'] as const,
  list: (supplierId?: number) =>
    [...feedMappingKeys.lists(), { supplierId }] as const,
  detail: (id: number) => [...feedMappingKeys.all, 'detail', id] as const,
};

export const supplierFeedKeys = {
  all: ['supplier-feeds'] as const,
  lists: () => [...supplierFeedKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) =>
    [...supplierFeedKeys.lists(), params ?? {}] as const,
  detail: (id: number) => [...supplierFeedKeys.all, 'detail', id] as const,
};

export const matchQueueKeys = {
  all: ['match-queue'] as const,
  list: (feedId: number) => [...matchQueueKeys.all, 'list', feedId] as const,
};

export const supplierLinkKeys = {
  all: ['supplier-links'] as const,
  lists: () => [...supplierLinkKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) =>
    [...supplierLinkKeys.lists(), params ?? {}] as const,
  detail: (id: number) => [...supplierLinkKeys.all, 'detail', id] as const,
};
