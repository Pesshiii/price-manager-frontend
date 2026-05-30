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

export interface SupplierFeedSummary {
  id: number;
  supplier: number;
  feed_mapping: number | null;
  status: SupplierFeedStatus;
  error: string | null;
  created_at: string;
}

export interface SupplierFeedDetail extends SupplierFeedSummary {
  total: number;
  matched: number;
  queued: number;
  skipped: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// SupplierFeedEntry (MatchQueueEntry)
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  product_id: number;
  score: number;
  /** Catalogue SKU of the candidate product */
  sku: string;
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
  /** Dataframe session ID — used as the identifier for deletion */
  session_id: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

// ---------------------------------------------------------------------------
// SupplierLink — permanent confirmed mapping
// ---------------------------------------------------------------------------

export interface SupplierLink {
  id: number;
  supplier: { id: number; name: string };
  supplier_sku: string;
  product: { id: number; name: string; sku: string };
  created_at: string;
}
