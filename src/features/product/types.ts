export type ValueType = 'string' | 'integer' | 'float' | 'boolean' | 'choice';

export type ProductStatus = string;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  level: number;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
}

export interface CharacteristicType {
  id: number;
  name: string;
  label: string;
  value_type: ValueType;
  options: string[];
  unit: string;
  required: boolean;
  categories: number[];
}

export type CharacteristicValue = string | number | boolean;

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: number | null;
  brand: number | null;
  description: string;
  status: ProductStatus;
  characteristics: Record<string, CharacteristicValue>;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductWritePayload {
  sku: string;
  name: string;
  category?: number | null;
  brand?: number | null;
  description?: string;
  status?: ProductStatus;
  characteristics: Record<string, CharacteristicValue>;
  image_urls: string[];
}

export interface ProductFilters {
  q?: string;
  category?: number;
  brand?: number;
  status?: string;
  chars: Record<string, string[]>;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 50;

export const emptyFilters = (): ProductFilters => ({
  chars: {},
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
});

export interface FacetBucket {
  value: unknown;
  count: number;
}

export type FacetsResponse = Record<string, FacetBucket[]>;

export type FieldMapping = { column: string } | { const: unknown };

export interface ImportMapping {
  sku?: FieldMapping;
  name?: FieldMapping;
  category?: FieldMapping;
  brand?: FieldMapping;
  description?: FieldMapping;
  status?: FieldMapping;
  characteristics?: Record<string, FieldMapping>;
}

/**
 * Backend може отдавать ошибки строки в разных формах:
 *  - массив строк: ["sku: required"]
 *  - объект DRF-стиля: { sku: ["required"], characteristics: ["color: ..."] }
 *  - строка или null
 * Нормализация — в normalizeRowErrors() (см. ImportPreviewResults).
 */
export type ImportRowErrors =
  | string[]
  | Record<string, string | string[]>
  | string
  | null
  | undefined;

export interface ImportPreviewRow {
  index: number;
  payload: Record<string, unknown>;
  errors: ImportRowErrors;
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  total: number;
  returned: number;
  valid: number;
  invalid: number;
}

export interface ImportCommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
}

export interface ImportRequestBody {
  session_id: string;
  instructions: unknown;
  mapping: ImportMapping;
  row_limit?: number;
}
