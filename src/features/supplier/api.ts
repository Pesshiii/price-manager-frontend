/**
 * API client for the Supplier feature.
 *
 * Thin wrappers around the shared axios instance — mirrors
 * src/features/product/api.ts in style.
 *
 * Base path: /suppliers  (mounted at /api/suppliers/ by the backend)
 */
import { api } from '@/api/client';
import type {
  FeedFile,
  FeedMapping,
  MatchQueueEntry,
  Supplier,
  SupplierFeed,
  SupplierLink,
} from './types';

const BASE = '/suppliers';

// ── Suppliers (read-only lookup) ────────────────────────────────────────────

export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await api.get<Supplier[]>(`${BASE}/suppliers/`);
  return data;
}

export async function getSupplier(id: number): Promise<Supplier> {
  const { data } = await api.get<Supplier>(`${BASE}/suppliers/${id}/`);
  return data;
}

// ── FeedMappings ────────────────────────────────────────────────────────────

export async function listFeedMappings(supplierId?: number): Promise<FeedMapping[]> {
  const params = supplierId !== undefined ? { supplier: supplierId } : undefined;
  const { data } = await api.get<FeedMapping[]>(`${BASE}/mappings/`, { params });
  return data;
}

export async function getFeedMapping(id: number): Promise<FeedMapping> {
  const { data } = await api.get<FeedMapping>(`${BASE}/mappings/${id}/`);
  return data;
}

export async function createFeedMapping(
  payload: Omit<FeedMapping, 'id'>,
): Promise<FeedMapping> {
  const { data } = await api.post<FeedMapping>(`${BASE}/mappings/`, payload);
  return data;
}

export async function updateFeedMapping(
  id: number,
  payload: Partial<Omit<FeedMapping, 'id'>>,
): Promise<FeedMapping> {
  const { data } = await api.patch<FeedMapping>(`${BASE}/mappings/${id}/`, payload);
  return data;
}

export async function deleteFeedMapping(id: number): Promise<void> {
  await api.delete(`${BASE}/mappings/${id}/`);
}

// ── SupplierFeeds ───────────────────────────────────────────────────────────

export interface SupplierFeedListParams {
  supplier?: number;
  status?: string;
  page?: number;
  page_size?: number;
}

export async function listSupplierFeeds(
  params?: SupplierFeedListParams,
): Promise<SupplierFeed[]> {
  const { data } = await api.get<SupplierFeed[]>(`${BASE}/feeds/`, { params });
  return data;
}

export async function getSupplierFeed(id: number): Promise<SupplierFeed> {
  const { data } = await api.get<SupplierFeed>(`${BASE}/feeds/${id}/`);
  return data;
}

export async function createSupplierFeed(
  payload: Pick<SupplierFeed, 'supplier' | 'mapping'>,
): Promise<SupplierFeed> {
  const { data } = await api.post<SupplierFeed>(`${BASE}/feeds/`, payload);
  return data;
}

export async function deleteSupplierFeed(id: number): Promise<void> {
  await api.delete(`${BASE}/feeds/${id}/`);
}

// Upload a file to an existing draft feed
export async function uploadFeedFile(feedId: number, file: File): Promise<FeedFile> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post<FeedFile>(`${BASE}/feeds/${feedId}/upload/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Delete an uploaded file
export async function deleteFeedFile(feedId: number, fileId: number): Promise<void> {
  await api.delete(`${BASE}/feeds/${feedId}/upload/${fileId}/`);
}

// Trigger processing — moves feed from draft → processing
export async function processFeed(feedId: number): Promise<SupplierFeed> {
  const { data } = await api.post<SupplierFeed>(`${BASE}/feeds/${feedId}/process/`);
  return data;
}

// ── Match Queue ─────────────────────────────────────────────────────────────

export async function listMatchQueue(feedId: number): Promise<MatchQueueEntry[]> {
  const { data } = await api.get<MatchQueueEntry[]>(`${BASE}/feeds/${feedId}/queue/`);
  return data;
}

export interface ResolvePayload {
  /** Confirm a candidate. Mutually exclusive with `skipped`. */
  product_id?: number;
  /** Mark as skipped. Mutually exclusive with `product_id`. */
  skipped?: boolean;
}

export async function resolveMatchQueueEntry(
  feedId: number,
  entryId: number,
  payload: ResolvePayload,
): Promise<void> {
  await api.patch(`${BASE}/feeds/${feedId}/queue/${entryId}/resolve/`, payload);
}

// ── SupplierLinks ───────────────────────────────────────────────────────────

export interface SupplierLinkListParams {
  supplier?: number;
  page?: number;
  page_size?: number;
}

export async function listSupplierLinks(
  params?: SupplierLinkListParams,
): Promise<SupplierLink[]> {
  const { data } = await api.get<SupplierLink[]>(`${BASE}/links/`, { params });
  return data;
}

export async function deleteSupplierLink(id: number): Promise<void> {
  await api.delete(`${BASE}/links/${id}/`);
}

export async function updateSupplierLink(
  id: number,
  payload: { product: number },
): Promise<SupplierLink> {
  const { data } = await api.patch<SupplierLink>(`${BASE}/links/${id}/`, payload);
  return data;
}
