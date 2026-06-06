export interface SnapshotField {
  id: number;
  slug: string;
  name: string;
  value_type: 'number' | 'string' | 'boolean';
  description: string;
}

export type SnapshotFieldWritePayload = Omit<SnapshotField, 'id'>;

// Condition

export type ConditionCompareOp = '==' | '!=' | '<' | '<=' | '>' | '>=';
export type ConditionSource = 'feed' | 'char' | 'brand' | 'category';

export interface LeafCondition {
  op: ConditionCompareOp;
  source: ConditionSource;
  key?: string;
  value: unknown;
}

export interface AndOrCondition {
  op: 'AND' | 'OR';
  conditions: Condition[];
}

export interface NotCondition {
  op: 'NOT';
  condition: Condition;
}

export type Condition = LeafCondition | AndOrCondition | NotCondition;

// Formula

export interface CopyFormula {
  type: 'copy';
  source: 'feed' | 'char';
  key: string;
}

export interface LiteralFormula {
  type: 'literal';
  value: unknown;
}

export interface ArithmeticFormula {
  type: 'arithmetic';
  op: '+' | '-' | '*' | '/';
  left: Formula;
  right: Formula;
}

export interface MapFormula {
  type: 'map';
  input: Formula;
  map: Record<string, unknown>;
  default: unknown;
}

export interface IfFormula {
  type: 'if';
  condition: Condition;
  then: Formula;
  else: Formula;
}

export type Formula =
  | CopyFormula
  | LiteralFormula
  | ArithmeticFormula
  | MapFormula
  | IfFormula;

// TransformRule

export interface TransformRule {
  id: number;
  feed_mapping: number;
  priority: number;
  target_field: number;
  condition: Condition | null;
  formula: Formula;
}

export type TransformRuleWritePayload = Omit<TransformRule, 'id'>;

// ProductSnapshot

export interface ProductSnapshot {
  id: number;
  product: number;
  supplier: number;
  source_feed: number;
  data: Record<string, unknown>;
  updated_at: string;
}
