/**
 * Domain types for the Supplier feature.
 *
 * Glossary (from CONTEXT.md):
 *  - Поставщик     = Supplier       — a vendor that provides feeds
 *  - Выгрузка      = SupplierFeed   — one periodic upload session from a supplier
 *  - Конфигурация  = FeedMapping    — permanent column-mapping config for a supplier
 *  - Строка выгрузки = SupplierFeedEntry — one row from the uploaded file
 *  - Связь         = SupplierLink   — confirmed supplier_sku ↔ Product mapping
 */

// ---------------------------------------------------------------------------
// Supplier
// ---------------------------------------------------------------------------

export interface Supplier {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// FeedMapping — permanent per-supplier configuration
// ---------------------------------------------------------------------------

export interface FeedMapping {
  id: number;
  /** FK to Supplier */
  supplier: number;
  name: string;
  /** Column used as the supplier's article key */
  supplier_sku_column: string;
  /** Columns combined into the embedding for auto-matching */
  identity_columns: string[];
  /** Columns with mutable data (price, stock, …) stored in SupplierFeedEntry.data */
  variable_columns: string[];
  /** Cosine-similarity threshold above which a candidate is auto-accepted (0–1) */
  auto_match_threshold: number;
}

// ---------------------------------------------------------------------------
// SupplierFeed — one upload session
// ---------------------------------------------------------------------------

export type SupplierFeedStatus =
  | 'draft'
  | 'processing'
  | 'matched'
  | 'partial'
  | 'done'
  | 'error';

export interface SupplierFeed {
  id: number;
  supplier: number;
  /** FK to FeedMapping used for this session */
  mapping: number | null;
  status: SupplierFeedStatus;
  /** Number of entries in the file */
  total_rows: number;
  /** Entries successfully auto-matched */
  matched_rows: number;
  /** Entries still in the MatchQueue */
  unmatched_rows: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// SupplierFeedEntry (MatchQueueEntry)
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  product_id: number;
  score: number;
  name: string;
}

/**
 * One row from the supplier file.  When `product` is null and `skipped` is
 * false the entry is in the MatchQueue (the user must resolve it manually).
 */
export interface SupplierFeedEntry {
  id: number;
  feed: number;
  supplier_sku: string;
  /** Mutable data from the supplier row (price, stock, …) */
  data: Record<string, unknown>;
  /** Top-N candidates produced by the embedding search */
  match_candidates: MatchCandidate[];
  /** Confirmed product FK — null until resolved */
  product: number | null;
  skipped: boolean;
  created_at: string;
}

/** An entry that is still in the MatchQueue (product=null, skipped=false) */
export type MatchQueueEntry = SupplierFeedEntry & { product: null; skipped: false };

// ---------------------------------------------------------------------------
// FeedFile — one file uploaded to a draft SupplierFeed
// ---------------------------------------------------------------------------

export interface FeedFile {
  id: number;
  filename: string;
  size: number;
  uploaded_at: string;
}

// ---------------------------------------------------------------------------
// SupplierLink — permanent confirmed mapping
// ---------------------------------------------------------------------------

export interface SupplierLink {
  id: number;
  supplier: number;
  /** The supplier's own article/SKU identifier */
  supplier_sku: string;
  /** FK to our catalogue Product */
  product: number;
  /** Denormalized display name from the catalogue (may be absent on older records) */
  product_name?: string;
  /** Internal catalogue SKU (may be absent on older records) */
  product_sku?: string;
  created_at: string;
}
