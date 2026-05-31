import { api } from '@/api/client';
import type { Supplier, SupplierWritePayload } from './types';

const BASE = '/suppliers';

export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await api.get<Supplier[]>(`${BASE}/`);
  return data;
}

export async function createSupplier(payload: SupplierWritePayload): Promise<Supplier> {
  const { data } = await api.post<Supplier>(`${BASE}/`, payload);
  return data;
}

export async function updateSupplier(id: number, payload: SupplierWritePayload): Promise<Supplier> {
  const { data } = await api.patch<Supplier>(`${BASE}/${id}/`, payload);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}/`);
}
