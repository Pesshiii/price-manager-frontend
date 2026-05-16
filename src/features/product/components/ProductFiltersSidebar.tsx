import { Button, Divider, Select, Stack, TextInput } from '@mantine/core';
import { useBrands } from '../hooks/useBrands';
import { useCategories } from '../hooks/useCategories';
import { useCharacteristicTypes } from '../hooks/useCharacteristicTypes';
import { useProductFacets } from '../hooks/useProductFacets';
import type { ProductFilters } from '../types';
import { FacetGroup } from './FacetGroup';

export interface ProductFiltersSidebarProps {
  filters: ProductFilters;
  patchFilters: (patch: Partial<ProductFilters>) => void;
  toggleCharValue: (name: string, value: string) => void;
  resetFilters: () => void;
}

export function ProductFiltersSidebar({
  filters,
  patchFilters,
  toggleCharValue,
  resetFilters,
}: ProductFiltersSidebarProps) {
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const { data: charTypes } = useCharacteristicTypes(
    filters.category !== undefined ? { category: filters.category } : {},
  );
  const { data: facets } = useProductFacets(filters);

  return (
    <Stack gap="md">
      <TextInput
        label="Поиск"
        placeholder="Название или SKU"
        value={filters.q ?? ''}
        onChange={(e) => patchFilters({ q: e.currentTarget.value || undefined })}
      />
      <Select
        label="Категория"
        placeholder="Все"
        data={(categories ?? []).map((c) => ({
          value: String(c.id),
          label: '— '.repeat(c.level) + c.name,
        }))}
        value={filters.category !== undefined ? String(filters.category) : null}
        onChange={(v) => patchFilters({ category: v ? Number(v) : undefined })}
        clearable
        searchable
      />
      <Select
        label="Бренд"
        placeholder="Все"
        data={(brands ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
        value={filters.brand !== undefined ? String(filters.brand) : null}
        onChange={(v) => patchFilters({ brand: v ? Number(v) : undefined })}
        clearable
        searchable
      />
      <Select
        label="Статус"
        placeholder="Любой"
        data={['active', 'archived', 'draft']}
        value={filters.status ?? null}
        onChange={(v) => patchFilters({ status: v ?? undefined })}
        clearable
      />
      <Divider />
      {(charTypes ?? []).map((type) => {
        const buckets = facets?.[type.name] ?? [];
        if (buckets.length === 0) return null;
        return (
          <FacetGroup
            key={type.id}
            type={type}
            buckets={buckets}
            selected={filters.chars[type.name] ?? []}
            onToggle={(value) => toggleCharValue(type.name, value)}
          />
        );
      })}
      <Button variant="subtle" onClick={resetFilters}>
        Сбросить
      </Button>
    </Stack>
  );
}
