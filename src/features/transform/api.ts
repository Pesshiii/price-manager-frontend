import { api } from '@/api/client';
import type { Paginated } from '@/features/product/types';
import type {
  ProductSnapshot,
  SnapshotField,
  SnapshotFieldWritePayload,
  TransformRule,
  TransformRuleWritePayload,
} from './types';

const FIELDS_BASE = '/transform/snapshot-fields';
const RULES_BASE = '/transform/rules';
const SNAPSHOTS_BASE = '/transform/snapshots';

// Snapshot Fields

export async function listSnapshotFields(): Promise<SnapshotField[]> {
  const { data } = await api.get<Paginated<SnapshotField>>(`${FIELDS_BASE}/`, {
    params: { page_size: 1000 },
  });
  return data.results;
}

export async function getSnapshotField(id: number): Promise<SnapshotField> {
  const { data } = await api.get<SnapshotField>(`${FIELDS_BASE}/${id}/`);
  return data;
}

export async function createSnapshotField(
  payload: SnapshotFieldWritePayload,
): Promise<SnapshotField> {
  const { data } = await api.post<SnapshotField>(`${FIELDS_BASE}/`, payload);
  return data;
}

export async function updateSnapshotField(
  id: number,
  payload: Partial<SnapshotFieldWritePayload>,
): Promise<SnapshotField> {
  const { data } = await api.patch<SnapshotField>(`${FIELDS_BASE}/${id}/`, payload);
  return data;
}

export async function deleteSnapshotField(id: number): Promise<void> {
  await api.delete(`${FIELDS_BASE}/${id}/`);
}

// Transform Rules

export async function listRules(mappingId: number): Promise<TransformRule[]> {
  const { data } = await api.get<Paginated<TransformRule>>(`${RULES_BASE}/`, {
    params: { feed_mapping: mappingId, page_size: 1000 },
  });
  return data.results;
}

export async function getRule(id: number): Promise<TransformRule> {
  const { data } = await api.get<TransformRule>(`${RULES_BASE}/${id}/`);
  return data;
}

export async function createRule(payload: TransformRuleWritePayload): Promise<TransformRule> {
  const { data } = await api.post<TransformRule>(`${RULES_BASE}/`, payload);
  return data;
}

export async function updateRule(
  id: number,
  payload: Partial<TransformRuleWritePayload>,
): Promise<TransformRule> {
  const { data } = await api.patch<TransformRule>(`${RULES_BASE}/${id}/`, payload);
  return data;
}

export async function deleteRule(id: number): Promise<void> {
  await api.delete(`${RULES_BASE}/${id}/`);
}

// Product Snapshots

export async function listSnapshots(params: {
  product?: number;
  source_feed?: number;
  supplier?: number;
}): Promise<ProductSnapshot[]> {
  const { data } = await api.get<ProductSnapshot[]>(`${SNAPSHOTS_BASE}/`, { params });
  return data;
}

export async function getSnapshot(id: number): Promise<ProductSnapshot> {
  const { data } = await api.get<ProductSnapshot>(`${SNAPSHOTS_BASE}/${id}/`);
  return data;
}
