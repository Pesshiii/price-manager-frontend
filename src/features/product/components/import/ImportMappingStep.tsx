import {
  Autocomplete,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCharacteristicType } from '../../api';
import { useCharacteristicTypes } from '../../hooks/useCharacteristicTypes';
import { charTypeKeys } from '../../queryKeys';
import type {
  CharacteristicType,
  DynamicCharSpec,
  FieldMapping,
  ImportMapping,
  ValueType,
} from '../../types';

const PRODUCT_FIELDS: Array<{ key: keyof ImportMapping; label: string; required?: boolean }> = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'name', label: 'Название', required: true },
  { key: 'category', label: 'Категория' },
  { key: 'brand', label: 'Бренд' },
  { key: 'description', label: 'Описание' },
  { key: 'status', label: 'Статус' },
];

const VALUE_TYPES: Array<{ value: ValueType; label: string }> = [
  { value: 'string', label: 'Строка' },
  { value: 'integer', label: 'Целое число' },
  { value: 'float', label: 'Число' },
  { value: 'boolean', label: 'Да/Нет' },
  { value: 'choice', label: 'Выбор из списка' },
];

export interface ImportMappingStepProps {
  columns: string[];
  /**
   * Metadata for characteristics the parent already knows about (e.g. resolved
   * from a saved mapping). The component does NOT use this list to enumerate
   * pickable types — that comes from a paginated `?search=` API call. Keep
   * this prop tiny (typically just the already-bound names) to avoid the
   * 10k-types-freeze-the-browser failure mode that the old "render every
   * type as a row" UI had.
   */
  characteristicTypes: CharacteristicType[];
  mapping: ImportMapping;
  onChange: (mapping: ImportMapping) => void;
}

function getColumn(value: FieldMapping | undefined): string | null {
  if (value && 'column' in value) return value.column;
  return null;
}

// Stable per-row id so dynamic rows survive parent re-renders without
// remount, and React.memo can short-circuit unrelated rows.
let _rowSeq = 0;
function nextRowId() {
  _rowSeq += 1;
  return `dr-${_rowSeq}`;
}

interface DynamicRow extends DynamicCharSpec {
  __rowId: string;
}

interface DynamicCharRowProps {
  rowId: string;
  index: number;
  spec: DynamicCharSpec;
  columns: string[];
  onPatch: (rowId: string, patch: Partial<DynamicCharSpec>) => void;
  onRemove: (rowId: string) => void;
}

const DynamicCharRow = memo(function DynamicCharRow({
  rowId,
  index,
  spec,
  columns,
  onPatch,
  onRemove,
}: DynamicCharRowProps) {
  return (
    <Table.Tr data-testid={`dynamic-row-${index}`}>
      <Table.Td>
        <Select
          placeholder="Имя из колонки"
          aria-label={`Имя из колонки (группа ${index + 1})`}
          data={columns}
          value={spec.name_column || null}
          onChange={(v) => onPatch(rowId, { name_column: v ?? '' })}
          clearable
        />
      </Table.Td>
      <Table.Td>
        <Select
          placeholder="Значение из колонки"
          aria-label={`Значение из колонки (группа ${index + 1})`}
          data={columns}
          value={spec.value_column || null}
          onChange={(v) => onPatch(rowId, { value_column: v ?? '' })}
          clearable
        />
      </Table.Td>
      <Table.Td>
        <Select
          placeholder="Единица из колонки"
          aria-label={`Единица из колонки (группа ${index + 1})`}
          data={columns}
          value={spec.unit_column || null}
          onChange={(v) => onPatch(rowId, { unit_column: v ?? undefined })}
          clearable
        />
      </Table.Td>
      <Table.Td>
        <Button
          variant="subtle"
          color="red"
          size="xs"
          aria-label={`Удалить группу ${index + 1}`}
          onClick={() => onRemove(rowId)}
        >
          <IconTrash size={14} />
        </Button>
      </Table.Td>
    </Table.Tr>
  );
});

interface BoundCharRowProps {
  name: string;
  type: CharacteristicType | undefined;
  columns: string[];
  column: string | null;
  onSelect: (name: string, column: string | null) => void;
}

const BoundCharRow = memo(function BoundCharRow({
  name,
  type,
  columns,
  column,
  onSelect,
}: BoundCharRowProps) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text>
          {type?.label ?? name}
          {type?.required ? ' *' : ''}
        </Text>
      </Table.Td>
      <Table.Td>
        <Select
          placeholder="—"
          data={columns}
          value={column}
          onChange={(v) => onSelect(name, v)}
          clearable
        />
      </Table.Td>
      <Table.Td>
        <Text c={type?.unit ? undefined : 'dimmed'} size="sm">
          {type?.unit || '—'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Button
          variant="subtle"
          color="red"
          size="xs"
          aria-label={`Отвязать ${type?.label ?? name}`}
          onClick={() => onSelect(name, null)}
        >
          <IconTrash size={14} />
        </Button>
      </Table.Td>
    </Table.Tr>
  );
});

export function ImportMappingStep({
  columns,
  characteristicTypes,
  mapping,
  onChange,
}: ImportMappingStepProps) {
  const qc = useQueryClient();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [form, setForm] = useState({
    name: '',
    label: '',
    value_type: 'string' as ValueType,
    options: [] as string[],
    unit: '',
    required: false,
  });
  const [pickerQuery, setPickerQuery] = useState('');
  // Debounce so each keystroke doesn't refetch picker results and shake the
  // memoized BoundCharRow tree.
  const [debouncedPickerQuery] = useDebouncedValue(pickerQuery, 250);

  // Refs let the action callbacks below stay identity-stable (deps: []) so
  // React.memo on DynamicCharRow / BoundCharRow actually short-circuits when
  // sibling rows are unchanged. Without this, every `mapping` update produced
  // new callback identities and re-rendered all ~50 rows.
  const mappingRef = useRef(mapping);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    mappingRef.current = mapping;
    onChangeRef.current = onChange;
  });

  // Keep stable __rowId per dynamic spec across renders. The mapping prop is
  // the source of truth for spec content; this ref only tracks identity.
  const rowIdsRef = useRef<string[]>([]);
  const incomingDynamic = mapping.dynamic_characteristics ?? [];
  // Sync row ids during render (cheap, idempotent) — moving this into an
  // effect would render one frame with mismatched keys and remount children.
  if (rowIdsRef.current.length !== incomingDynamic.length) {
    const next = rowIdsRef.current.slice(0, incomingDynamic.length);
    while (next.length < incomingDynamic.length) next.push(nextRowId());
    rowIdsRef.current = next;
  }
  const dynamicRows: DynamicRow[] = incomingDynamic.map((spec, i) => ({
    ...spec,
    __rowId: rowIdsRef.current[i],
  }));

  const createMutation = useMutation({
    mutationFn: createCharacteristicType,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: charTypeKeys.all });
      notifications.show({
        message: `Характеристика «${created.label}» создана`,
        color: 'green',
      });
      // Bind the newly-created type automatically so the user can pick a column.
      const current = mappingRef.current;
      const chars = { ...(current.characteristics ?? {}) };
      if (!chars[created.name]) {
        chars[created.name] = { column: '' };
        onChangeRef.current({ ...current, characteristics: chars });
      }
      closeModal();
      setForm({ name: '', label: '', value_type: 'string', options: [], unit: '', required: false });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: unknown } })?.response?.data ?? e;
      notifications.show({
        message: typeof msg === 'string' ? msg : JSON.stringify(msg),
        color: 'red',
      });
    },
  });

  // Search picker: paginated, bounded result set. Fires only when user types.
  const pickerEnabled = debouncedPickerQuery.trim().length > 0;
  const pickerQ = useCharacteristicTypes(
    pickerEnabled ? { search: debouncedPickerQuery.trim(), page_size: 20 } : {},
  );
  const pickerResults = pickerEnabled ? pickerQ.data?.results ?? [] : [];

  // Split: bound rows only need the stable type list. Picker results live in
  // a separate map and don't invalidate BoundCharRow on every keystroke.
  const boundTypeIndex = useMemo(() => {
    const m = new Map<string, CharacteristicType>();
    for (const t of characteristicTypes) m.set(t.name, t);
    return m;
  }, [characteristicTypes]);

  const setField = useCallback((key: keyof ImportMapping, column: string | null) => {
    const next: ImportMapping = { ...mappingRef.current };
    if (column) {
      (next[key] as FieldMapping) = { column };
    } else {
      delete next[key];
    }
    onChangeRef.current(next);
  }, []);

  const setCharacteristic = useCallback((name: string, column: string | null) => {
    const current = mappingRef.current;
    const chars = { ...(current.characteristics ?? {}) };
    if (column) {
      chars[name] = { column };
    } else {
      delete chars[name];
    }
    onChangeRef.current({ ...current, characteristics: chars });
  }, []);

  const bindNewCharacteristic = useCallback((name: string) => {
    if (!name) return;
    const current = mappingRef.current;
    const chars = { ...(current.characteristics ?? {}) };
    if (!chars[name]) chars[name] = { column: '' };
    onChangeRef.current({ ...current, characteristics: chars });
  }, []);

  const patchDynamic = useCallback((rowId: string, patch: Partial<DynamicCharSpec>) => {
    const idx = rowIdsRef.current.indexOf(rowId);
    if (idx < 0) return;
    const current = mappingRef.current;
    const list = current.dynamic_characteristics ?? [];
    const next = list.map((spec, i) => (i === idx ? { ...spec, ...patch } : spec));
    onChangeRef.current({ ...current, dynamic_characteristics: next });
  }, []);

  const removeDynamic = useCallback((rowId: string) => {
    const idx = rowIdsRef.current.indexOf(rowId);
    if (idx < 0) return;
    const current = mappingRef.current;
    const list = current.dynamic_characteristics ?? [];
    const next = list.filter((_, i) => i !== idx);
    rowIdsRef.current = rowIdsRef.current.filter((_, i) => i !== idx);
    if (next.length === 0) {
      const { dynamic_characteristics: _drop, ...rest } = current;
      onChangeRef.current(rest);
    } else {
      onChangeRef.current({ ...current, dynamic_characteristics: next });
    }
  }, []);

  const addDynamic = useCallback(() => {
    const current = mappingRef.current;
    const list = current.dynamic_characteristics ?? [];
    rowIdsRef.current = [...rowIdsRef.current, nextRowId()];
    onChangeRef.current({
      ...current,
      dynamic_characteristics: [...list, { name_column: '', value_column: '' }],
    });
  }, []);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.label.trim().length > 0 &&
    (form.value_type !== 'choice' || form.options.length > 0);

  const boundNames = Object.keys(mapping.characteristics ?? {});

  // Autocomplete `data` accepts `{value, label}` — show label so users can
  // search by it. Limit to top 20 (already bounded by ?page_size=20 above).
  const autocompleteData = pickerResults
    .filter((t) => !(mapping.characteristics ?? {})[t.name])
    .map((t) => ({ value: t.name, label: `${t.label} (${t.name})` }));

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

      <Group justify="space-between" align="end">
        <Title order={4}>Характеристики</Title>
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addDynamic}
          >
            Добавить вариант
          </Button>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={openModal}
          >
            Создать характеристику
          </Button>
        </Group>
      </Group>
      <Text c="dimmed" size="xs">
        Введите название известной характеристики чтобы привязать её к колонке.
        «Вариант» — это группа из трёх колонок (Имя / Значение / Единица), когда
        несколько характеристик хранятся в одних и тех же столбцах файла.
      </Text>
      <Autocomplete
        label="Привязать характеристику"
        placeholder="Начните печатать название…"
        data={autocompleteData}
        value={pickerQuery}
        onChange={setPickerQuery}
        onOptionSubmit={(value) => {
          bindNewCharacteristic(value);
          setPickerQuery('');
        }}
        limit={20}
      />
      {boundNames.length === 0 && dynamicRows.length === 0 ? (
        <Text c="dimmed" size="sm">
          Пока не привязано ни одной характеристики. Используйте поле выше, чтобы
          добавить нужные, или «Добавить вариант» для EAV-лайаута.
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Характеристика</Table.Th>
              <Table.Th>Колонка значения</Table.Th>
              <Table.Th>Единица</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {boundNames.map((name) => (
              <BoundCharRow
                key={`bound-${name}`}
                name={name}
                type={boundTypeIndex.get(name)}
                columns={columns}
                column={getColumn(mapping.characteristics?.[name])}
                onSelect={setCharacteristic}
              />
            ))}
            {dynamicRows.map((row, idx) => (
              <DynamicCharRow
                key={row.__rowId}
                rowId={row.__rowId}
                index={idx}
                spec={row}
                columns={columns}
                onPatch={patchDynamic}
                onRemove={removeDynamic}
              />
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Создать характеристику"
      >
        <Stack>
          <TextInput
            label="Ключ (slug)"
            description="Латиница/цифры/-/_. По нему ссылается mapping."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Название"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
            required
          />
          <Select
            label="Тип значения"
            data={VALUE_TYPES}
            value={form.value_type}
            onChange={(v) => setForm({ ...form, value_type: (v as ValueType) ?? 'string' })}
          />
          {form.value_type === 'choice' && (
            <TagsInput
              label="Варианты"
              description="Введите и нажмите Enter"
              value={form.options}
              onChange={(opts) => setForm({ ...form, options: opts })}
            />
          )}
          <TextInput
            label="Единица измерения"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.currentTarget.value })}
          />
          <Switch
            label="Обязательная"
            checked={form.required}
            onChange={(e) => setForm({ ...form, required: e.currentTarget.checked })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>
              Отмена
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!canSubmit}
              onClick={() =>
                createMutation.mutate({
                  name: form.name.trim(),
                  label: form.label.trim(),
                  value_type: form.value_type,
                  options: form.value_type === 'choice' ? form.options : undefined,
                  unit: form.unit || undefined,
                  required: form.required,
                })
              }
            >
              Создать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
