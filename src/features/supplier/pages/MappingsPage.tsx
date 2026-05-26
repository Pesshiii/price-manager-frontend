import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { previewPipeline, uploadSession } from '@/features/dataframe/api';
import { isPreviewError } from '@/features/dataframe/types';
import {
  createFeedMapping,
  deleteFeedMapping,
  updateFeedMapping,
} from '../api';
import { useFeedMappings } from '../hooks/useFeedMappings';
import { useSuppliers } from '../hooks/useSuppliers';
import { feedMappingKeys } from '../queryKeys';
import type { FeedMapping } from '../types';

// ── types ──────────────────────────────────────────────────────────────────────

interface FormState {
  supplier: string; // stored as string for Select compatibility
  name: string;
  supplier_sku_column: string;
  identity_columns: string[];
  variable_columns: string[];
  auto_match_threshold: number | string;
}

const EMPTY_FORM: FormState = {
  supplier: '',
  name: '',
  supplier_sku_column: '',
  identity_columns: [],
  variable_columns: [],
  auto_match_threshold: 0.8,
};

// ── component ──────────────────────────────────────────────────────────────────

export function MappingsPage() {
  const qc = useQueryClient();

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: mappings, isLoading: loadingMappings } = useFeedMappings();
  const { data: suppliers, isLoading: loadingSuppliers } = useSuppliers();

  // ── modal state ───────────────────────────────────────────────────────────
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<FeedMapping | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // ── column detection state ─────────────────────────────────────────────────
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  // ── delete error state ─────────────────────────────────────────────────────
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── mutations ──────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: deleteFeedMapping,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedMappingKeys.all });
      setDeleteError(null);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 409) {
        setDeleteError('Нельзя удалить: конфигурация используется активными сессиями');
      } else {
        notifications.show({ color: 'red', message: 'Ошибка при удалении' });
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Omit<FeedMapping, 'id'>) =>
      editing
        ? updateFeedMapping(editing.id, payload)
        : createFeedMapping(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedMappingKeys.all });
      handleClose();
    },
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function handleOpen(mapping?: FeedMapping) {
    setEditing(mapping ?? null);
    if (mapping) {
      setForm({
        supplier: String(mapping.supplier),
        name: mapping.name,
        supplier_sku_column: mapping.supplier_sku_column,
        identity_columns: mapping.identity_columns,
        variable_columns: mapping.variable_columns,
        auto_match_threshold: mapping.auto_match_threshold,
      });
      // When editing, seed detected columns with the existing values so they
      // show in the selects even before a new file is uploaded.
      const existing = Array.from(
        new Set([
          mapping.supplier_sku_column,
          ...mapping.identity_columns,
          ...mapping.variable_columns,
        ]),
      ).filter(Boolean);
      setDetectedColumns(existing);
    } else {
      setForm(EMPTY_FORM);
      setDetectedColumns([]);
    }
    setDetectError(null);
    open();
  }

  function handleClose() {
    close();
    setEditing(null);
    setForm(EMPTY_FORM);
    setDetectedColumns([]);
    setDetectError(null);
  }

  async function handleFileDrop(files: File[]) {
    const file = files[0];
    if (!file) return;
    setDetecting(true);
    setDetectError(null);
    try {
      const { session_id } = await uploadSession(file);
      const result = await previewPipeline({
        sessionId: session_id,
        instructions: { reader: { func: 'auto', args: {} }, transforms: [] },
      });
      if (isPreviewError(result)) {
        setDetectError(result.error.message);
      } else {
        setDetectedColumns(result.columns);
      }
    } catch {
      setDetectError('Не удалось определить столбцы файла');
    } finally {
      setDetecting(false);
    }
  }

  function handleSubmit() {
    const payload: Omit<FeedMapping, 'id'> = {
      supplier: Number(form.supplier),
      name: form.name,
      supplier_sku_column: form.supplier_sku_column,
      identity_columns: form.identity_columns,
      variable_columns: form.variable_columns,
      auto_match_threshold: Number(form.auto_match_threshold),
    };
    saveMutation.mutate(payload);
  }

  // ── supplier lookup helper ─────────────────────────────────────────────────

  function supplierName(id: number) {
    return suppliers?.find((s) => s.id === id)?.name ?? String(id);
  }

  // ── column options for Selects ─────────────────────────────────────────────

  const colOptions = detectedColumns.map((c) => ({ value: c, label: c }));

  // ── render ─────────────────────────────────────────────────────────────────

  const isLoading = loadingMappings || loadingSuppliers;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Конфигурации выгрузок</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
          Новая конфигурация
        </Button>
      </Group>

      {deleteError && (
        <Alert color="red" withCloseButton onClose={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      {isLoading && <Loader />}

      {!isLoading && (
        <Card withBorder padding={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Поставщик</Table.Th>
                <Table.Th>Название</Table.Th>
                <Table.Th>Порог</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(mappings ?? []).map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>{supplierName(m.supplier)}</Table.Td>
                  <Table.Td>{m.name}</Table.Td>
                  <Table.Td>{m.auto_match_threshold}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => handleOpen(m)}
                        aria-label="Редактировать"
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        loading={deleteMutation.variables === m.id && deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Удалить «${m.name}»?`)) deleteMutation.mutate(m.id);
                        }}
                        aria-label="Удалить"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* ── Create / Edit modal ───────────────────────────────────────────── */}
      <Modal
        opened={opened}
        onClose={handleClose}
        title={editing ? 'Редактировать конфигурацию' : 'Новая конфигурация'}
        size="lg"
      >
        <Stack>
          <Select
            label="Поставщик"
            placeholder="Выбрать поставщика"
            required
            data={(suppliers ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
            value={form.supplier}
            onChange={(v) => setForm((f) => ({ ...f, supplier: v ?? '' }))}
          />

          <TextInputCompat
            label="Название"
            required
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          />

          <NumberInput
            label="Порог авто-матчинга"
            min={0}
            max={1}
            step={0.05}
            decimalScale={2}
            value={form.auto_match_threshold}
            onChange={(v) => setForm((f) => ({ ...f, auto_match_threshold: v }))}
          />

          {/* Column detection via file upload */}
          <Text size="sm" fw={500}>
            Определить столбцы из файла
          </Text>
          <Dropzone
            onDrop={handleFileDrop}
            loading={detecting}
            accept={[
              'text/csv',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]}
            data-testid="column-dropzone"
          >
            <Group justify="center" style={{ pointerEvents: 'none' }}>
              <IconUpload size={18} />
              <Text size="sm">Перетащите файл или нажмите для выбора</Text>
            </Group>
          </Dropzone>
          {detectError && <Text c="red" size="sm">{detectError}</Text>}

          <Select
            label="Столбец артикула поставщика"
            data={colOptions}
            value={form.supplier_sku_column || null}
            onChange={(v) => setForm((f) => ({ ...f, supplier_sku_column: v ?? '' }))}
          />

          {/* MultiSelects for identity / variable columns */}
          <MultiSelectCompat
            label="Столбцы идентификации"
            data={colOptions}
            value={form.identity_columns}
            onChange={(v) => setForm((f) => ({ ...f, identity_columns: v }))}
          />

          <MultiSelectCompat
            label="Переменные столбцы"
            data={colOptions}
            value={form.variable_columns}
            onChange={(v) => setForm((f) => ({ ...f, variable_columns: v }))}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={!form.name.trim() || !form.supplier}
              onClick={handleSubmit}
            >
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── small adapter components to keep TS happy ────────────────────────────────

import { TextInput, MultiSelect } from '@mantine/core';

function TextInputCompat({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextInput
      label={label}
      required={required}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

function MultiSelectCompat({
  label,
  data,
  value,
  onChange,
}: {
  label: string;
  data: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return <MultiSelect label={label} data={data} value={value} onChange={onChange} />;
}
