import { Select, Stack, Table, Text, Title } from '@mantine/core';
import type { CharacteristicType, FieldMapping, ImportMapping } from '../../types';

const PRODUCT_FIELDS: Array<{ key: keyof ImportMapping; label: string; required?: boolean }> = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'name', label: 'Название', required: true },
  { key: 'category', label: 'Категория' },
  { key: 'brand', label: 'Бренд' },
  { key: 'description', label: 'Описание' },
  { key: 'status', label: 'Статус' },
];

export interface ImportMappingStepProps {
  columns: string[];
  characteristicTypes: CharacteristicType[];
  mapping: ImportMapping;
  onChange: (mapping: ImportMapping) => void;
}

function getColumn(value: FieldMapping | undefined): string | null {
  if (value && 'column' in value) return value.column;
  return null;
}

export function ImportMappingStep({
  columns,
  characteristicTypes,
  mapping,
  onChange,
}: ImportMappingStepProps) {
  const setField = (key: keyof ImportMapping, column: string | null) => {
    const next: ImportMapping = { ...mapping };
    if (column) {
      (next[key] as FieldMapping) = { column };
    } else {
      delete next[key];
    }
    onChange(next);
  };

  const setCharacteristic = (name: string, column: string | null) => {
    const chars = { ...(mapping.characteristics ?? {}) };
    if (column) {
      chars[name] = { column };
    } else {
      delete chars[name];
    }
    onChange({ ...mapping, characteristics: chars });
  };

  return (
    <Stack>
      <Title order={4}>Поля продукта</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Поле</Table.Th>
            <Table.Th>Колонка</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {PRODUCT_FIELDS.map((field) => (
            <Table.Tr key={field.key}>
              <Table.Td>
                <Text>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Text>
              </Table.Td>
              <Table.Td>
                <Select
                  placeholder="—"
                  data={columns}
                  value={getColumn(mapping[field.key] as FieldMapping | undefined)}
                  onChange={(v) => setField(field.key, v)}
                  clearable
                  searchable
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {characteristicTypes.length > 0 && (
        <>
          <Title order={4}>Характеристики</Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Характеристика</Table.Th>
                <Table.Th>Колонка</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {characteristicTypes.map((type) => (
                <Table.Tr key={type.id}>
                  <Table.Td>
                    <Text>
                      {type.label}
                      {type.required ? ' *' : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Select
                      placeholder="—"
                      data={columns}
                      value={getColumn(mapping.characteristics?.[type.name])}
                      onChange={(v) => setCharacteristic(type.name, v)}
                      clearable
                      searchable
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}
