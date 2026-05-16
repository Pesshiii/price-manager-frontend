import { api } from '@/api/client';
import type {
  Brand,
  Category,
  CharacteristicType,
  FacetsResponse,
  ImportCommitResult,
  ImportPreviewResult,
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

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>(`${BASE}/categories/`);
  return data;
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

export async function listBrands(): Promise<Brand[]> {
  const { data } = await api.get<Brand[]>(`${BASE}/brands/`);
  return data;
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

export async function listCharacteristicTypes(
  params: { category?: number } = {},
): Promise<CharacteristicType[]> {
  const { data } = await api.get<CharacteristicType[]>(`${BASE}/characteristic-types/`, {
    params: params.category !== undefined ? { category: params.category } : undefined,
  });
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

export async function previewImport(body: ImportRequestBody): Promise<ImportPreviewResult> {
  const { data } = await api.post<ImportPreviewResult>(`${BASE}/import/preview/`, body);
  return data;
}

export async function commitImport(body: ImportRequestBody): Promise<ImportCommitResult> {
  const { data } = await api.post<ImportCommitResult>(`${BASE}/import/commit/`, body);
  return data;
}
