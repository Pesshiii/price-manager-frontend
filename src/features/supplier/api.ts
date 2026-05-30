/**
 * API client for the Supplier feature.
 *
 * Thin wrappers around the shared axios instance — mirrors
 * src/features/product/api.ts in style.
 *
 * Base paths:
 *   /suppliers      — simple Supplier CRUD  (GET/POST/PATCH/DELETE /api/suppliers/)
 *   /supplier-feed  — feeds, mappings, queue, links  (mounted at /api/supplier-feed/)
 */
import { api } from '@/api/client';
import type { Paginated } from '@/features/product/types';
import type {
  FeedFile,
  FeedMapping,
  MatchQueueEntry,
  Supplier,
  SupplierFeedSummary,
  SupplierFeedDetail,
  SupplierLink,
} from './types';

const SUPPLIERS_BASE = '/suppliers';
const FEED_BASE = '/supplier-feed';

// ── Suppliers ───────────────────────────────────────────────────────────────

export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await api.get<Supplier[]>(`${SUPPLIERS_BASE}/`);
  return data;
}

export async function getSupplier(id: number): Promise<Supplier> {
  const { data } = await api.get<Supplier>(`${SUPPLIERS_BASE}/${id}/`);
  return data;
}

export async function createSupplier(payload: Pick<Supplier, 'name'>): Promise<Supplier> {
  const { data } = await api.post<Supplier>(`${SUPPLIERS_BASE}/`, payload);
  return data;
}

export async function updateSupplier(
  id: number,
  payload: Pick<Supplier, 'name'>,
): Promise<Supplier> {
  const { data } = await api.patch<Supplier>(`${SUPPLIERS_BASE}/${id}/`, payload);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  await api.delete(`${SUPPLIERS_BASE}/${id}/`);
}

// ── FeedMappings ────────────────────────────────────────────────────────────

export async function listFeedMappings(supplierId?: number): Promise<FeedMapping[]> {
  const params = supplierId !== undefined ? { supplier: supplierId } : undefined;
  const { data } = await api.get<FeedMapping[]>(`${FEED_BASE}/mappings/`, { params });
  return data;
}

export async function getFeedMapping(id: number): Promise<FeedMapping> {
  const { data } = await api.get<FeedMapping>(`${FEED_BASE}/mappings/${id}/`);
  return data;
}

export async function createFeedMapping(
  payload: Omit<FeedMapping, 'id'>,
): Promise<FeedMapping> {
  const { data } = await api.post<FeedMapping>(`${FEED_BASE}/mappings/`, payload);
  return data;
}

export async function updateFeedMapping(
  id: number,
  payload: Partial<Omit<FeedMapping, 'id'>>,
): Promise<FeedMapping> {
  const { data } = await api.patch<FeedMapping>(`${FEED_BASE}/mappings/${id}/`, payload);
  return data;
}

export async function deleteFeedMapping(id: number): Promise<void> {
  await api.delete(`${FEED_BASE}/mappings/${id}/`);
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
): Promise<SupplierFeedSummary[]> {
  const { data } = await api.get<SupplierFeedSummary[]>(`${FEED_BASE}/feeds/`, { params });
  return data;
}

export async function getSupplierFeed(id: number): Promise<SupplierFeedDetail> {
  const { data } = await api.get<SupplierFeedDetail>(`${FEED_BASE}/feeds/${id}/`);
  return data;
}

export async function createSupplierFeed(
  payload: Pick<SupplierFeedSummary, 'supplier' | 'feed_mapping'>,
): Promise<SupplierFeedSummary> {
  const { data } = await api.post<SupplierFeedSummary>(`${FEED_BASE}/feeds/`, payload);
  return data;
}

export async function deleteSupplierFeed(id: number): Promise<void> {
  await api.delete(`${FEED_BASE}/feeds/${id}/`);
}

// Upload a file to an existing draft feed
export async function uploadFeedFile(feedId: number, file: File): Promise<FeedFile> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post<FeedFile>(`${FEED_BASE}/feeds/${feedId}/upload/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Delete an uploaded file — identified by its dataframe session_id
export async function deleteFeedFile(feedId: number, sessionId: string): Promise<void> {
  await api.delete(`${FEED_BASE}/feeds/${feedId}/files/${sessionId}/`);
}

// Trigger processing — moves feed from draft → processing
export async function processFeed(feedId: number): Promise<SupplierFeedSummary> {
  const { data } = await api.post<SupplierFeedSummary>(`${FEED_BASE}/feeds/${feedId}/process/`);
  return data;
}

// ── Match Queue ─────────────────────────────────────────────────────────────

export async function listMatchQueue(
  feedId: number,
  page = 1,
): Promise<Paginated<MatchQueueEntry>> {
  const { data } = await api.get<Paginated<MatchQueueEntry>>(
    `${FEED_BASE}/feeds/${feedId}/queue/`,
    { params: { page } },
  );
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
  await api.post(`${FEED_BASE}/feeds/${feedId}/queue/${entryId}/resolve/`, payload);
}

// ── SupplierLinks ───────────────────────────────────────────────────────────

export interface SupplierLinkListParams {
  supplier?: number;
  supplier_sku?: string;
  page?: number;
  page_size?: number;
}

export async function listSupplierLinks(
  params?: SupplierLinkListParams,
): Promise<SupplierLink[]> {
  const { data } = await api.get<SupplierLink[]>(`${FEED_BASE}/links/`, { params });
  return data;
}

export async function deleteSupplierLink(id: number): Promise<void> {
  await api.delete(`${FEED_BASE}/links/${id}/`);
}

export async function updateSupplierLink(
  id: number,
  payload: { product_id: number },
): Promise<SupplierLink> {
  const { data } = await api.patch<SupplierLink>(`${FEED_BASE}/links/${id}/`, payload);
  return data;
}
