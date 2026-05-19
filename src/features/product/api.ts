import { api } from '@/api/client';
import type {
  Brand,
  Category,
  CharacteristicType,
  FacetsResponse,
  ImportJob,
  ImportRequestBody,
  Paginated,
  Product,
  ProductFilters,
  ProductWritePayload,
} from './types';

const BASE = '/products';

function buildListParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.append('q', filters.q);
  if (filters.category !== undefined) params.append('category', String(filters.category));
  if (filters.brand !== undefined) params.append('brand', String(filters.brand));
  if (filters.status) params.append('status', filters.status);
  params.append('page', String(filters.page));
  params.append('page_size', String(filters.pageSize));
  for (const [name, values] of Object.entries(filters.chars)) {
    for (const value of values) {
      params.append(`char__${name}`, value);
    }
  }
  return params;
}

export async function listProducts(filters: ProductFilters): Promise<Paginated<Product>> {
  const { data } = await api.get<Paginated<Product>>(`${BASE}/products/`, {
    params: buildListParams(filters),
  });
  return data;
}

export async function getProductFacets(filters: ProductFilters): Promise<FacetsResponse> {
  const { data } = await api.get<FacetsResponse>(`${BASE}/products/facets/`, {
    params: buildListParams(filters),
  });
  return data;
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await api.get<Product>(`${BASE}/products/${id}/`);
  return data;
}

export async function createProduct(payload: ProductWritePayload): Promise<Product> {
  const { data } = await api.post<Product>(`${BASE}/products/`, payload);
  return data;
}

export async function updateProduct(
  id: number,
  payload: Partial<ProductWritePayload>,
): Promise<Product> {
  const { data } = await api.patch<Product>(`${BASE}/products/${id}/`, payload);
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`${BASE}/products/${id}/`);
}

export async function listCategories(params: { search?: string; page_size?: number } = {}): Promise<Category[]> {
  // Backend paginates this endpoint (default page_size=500). Callers that need
  // many more should pass an explicit page_size — most of the UI is happy with
  // the first page, and the sidebar uses `?search=` to filter when needed.
  const search = new URLSearchParams();
  if (params.search) search.append('search', params.search);
  search.append('page_size', String(params.page_size ?? 500));
  const { data } = await api.get<Paginated<Category>>(`${BASE}/categories/`, { params: search });
  return data.results;
}

export interface CategoryWritePayload {
  name: string;
  parent?: number | null;
}

export async function createCategory(payload: CategoryWritePayload): Promise<Category> {
  const { data } = await api.post<Category>(`${BASE}/categories/`, payload);
  return data;
}

export async function updateCategory(
  id: number,
  payload: Partial<CategoryWritePayload>,
): Promise<Category> {
  const { data } = await api.patch<Category>(`${BASE}/categories/${id}/`, payload);
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`${BASE}/categories/${id}/`);
}

export async function listBrands(params: { search?: string; page_size?: number } = {}): Promise<Brand[]> {
  const search = new URLSearchParams();
  if (params.search) search.append('search', params.search);
  search.append('page_size', String(params.page_size ?? 500));
  const { data } = await api.get<Paginated<Brand>>(`${BASE}/brands/`, { params: search });
  return data.results;
}

export interface BrandWritePayload {
  name: string;
}

export async function createBrand(payload: BrandWritePayload): Promise<Brand> {
  const { data } = await api.post<Brand>(`${BASE}/brands/`, payload);
  return data;
}

export async function updateBrand(
  id: number,
  payload: Partial<BrandWritePayload>,
): Promise<Brand> {
  const { data } = await api.patch<Brand>(`${BASE}/brands/${id}/`, payload);
  return data;
}

export async function deleteBrand(id: number): Promise<void> {
  await api.delete(`${BASE}/brands/${id}/`);
}

export interface ListCharTypesParams {
  category?: number;
  search?: string;
  /** Bulk-fetch metadata for explicit names (e.g. labels for already-bound chars). */
  name__in?: string[];
  page?: number;
  page_size?: number;
}

/**
 * Backend paginates `/characteristic-types/` with default `page_size=200` and
 * `max_page_size=2000`. Pass `page_size: 2000` to fetch everything in one go
 * (admin pages only — list freezes the UI when N >> 200).
 */
export async function listCharacteristicTypes(
  params: ListCharTypesParams = {},
): Promise<Paginated<CharacteristicType>> {
  const search = new URLSearchParams();
  if (params.category !== undefined) search.append('category', String(params.category));
  if (params.search) search.append('search', params.search);
  if (params.name__in && params.name__in.length > 0) {
    search.append('name__in', params.name__in.join(','));
  }
  if (params.page !== undefined) search.append('page', String(params.page));
  if (params.page_size !== undefined) search.append('page_size', String(params.page_size));
  const { data } = await api.get<Paginated<CharacteristicType>>(
    `${BASE}/characteristic-types/`,
    { params: search },
  );
  return data;
}

export interface CharacteristicTypeWritePayload {
  name: string;
  label: string;
  value_type: CharacteristicType['value_type'];
  options?: string[];
  unit?: string;
  required?: boolean;
  categories?: number[];
}

export async function createCharacteristicType(
  payload: CharacteristicTypeWritePayload,
): Promise<CharacteristicType> {
  const { data } = await api.post<CharacteristicType>(
    `${BASE}/characteristic-types/`,
    payload,
  );
  return data;
}

export async function updateCharacteristicType(
  id: number,
  payload: Partial<CharacteristicTypeWritePayload>,
): Promise<CharacteristicType> {
  const { data } = await api.patch<CharacteristicType>(
    `${BASE}/characteristic-types/${id}/`,
    payload,
  );
  return data;
}

export async function deleteCharacteristicType(id: number): Promise<void> {
  await api.delete(`${BASE}/characteristic-types/${id}/`);
}

export async function previewImport(body: ImportRequestBody): Promise<ImportJob> {
  const { data } = await api.post<ImportJob>(`${BASE}/import/preview/`, body);
  return data;
}

export async function commitImport(body: ImportRequestBody): Promise<ImportJob> {
  const { data } = await api.post<ImportJob>(`${BASE}/import/commit/`, body);
  return data;
}

export async function getImportJob(jobId: string): Promise<ImportJob> {
  const { data } = await api.get<ImportJob>(`${BASE}/import/jobs/${jobId}/`);
  return data;
}
