import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  createSnapshotField,
  deleteSnapshotField,
  listSnapshotFields,
  updateSnapshotField,
} from '../api';
import { transformKeys } from '../queryKeys';
import type { SnapshotField, SnapshotFieldWritePayload } from '../types';

type ValueType = 'number' | 'string' | 'boolean';

interface FormState {
  slug: string;
  name: string;
  value_type: ValueType;
  description: string;
}

const DEFAULT_FORM: FormState = { slug: '', name: '', value_type: 'number', description: '' };

const VALUE_TYPE_OPTIONS = [
  { value: 'number', label: 'number' },
  { value: 'string', label: 'string' },
  { value: 'boolean', label: 'boolean' },
];

export function SnapshotFieldsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: transformKeys.snapshotFields(),
    queryFn: listSnapshotFields,
  });

  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<SnapshotField | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  function openCreate() {
    setForm(DEFAULT_FORM);
    setMode('create');
  }

  function openEdit(field: SnapshotField) {
    setForm({
      slug: field.slug,
      name: field.name,
      value_type: field.value_type,
      description: field.description,
    });
    setEditTarget(field);
    setMode('edit');
  }

  function closeModal() {
    setMode(null);
    setEditTarget(null);
  }

  const createMutation = useMutation({
    mutationFn: (payload: SnapshotFieldWritePayload) => createSnapshotField(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transformKeys.snapshotFields() });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<SnapshotFieldWritePayload> }) =>
      updateSnapshotField(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transformKeys.snapshotFields() });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSnapshotField,
    onSuccess: () => qc.invalidateQueries({ queryKey: transformKeys.snapshotFields() }),
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        notifications.show({ color: 'red', message: 'Поле используется в правилах' });
      }
    },
  });

  function handleSubmit() {
    if (mode === 'create') {
      createMutation.mutate(form);
    } else if (mode === 'edit' && editTarget) {
      updateMutation.mutate({ id: editTarget.id, payload: form });
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Поля снимков</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Новое поле
        </Button>
      </Group>

      {isLoading && <Loader />}

      {!isLoading && (
        <Card withBorder padding={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Slug</Table.Th>
                <Table.Th>Название</Table.Th>
                <Table.Th>Тип</Table.Th>
                <Table.Th>Описание</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(data ?? []).map((f) => (
                <Table.Tr key={f.id}>
                  <Table.Td>{f.slug}</Table.Td>
                  <Table.Td>{f.name}</Table.Td>
                  <Table.Td>{f.value_type}</Table.Td>
                  <Table.Td>{f.description}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openEdit(f)}
                        aria-label="Редактировать"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        loading={deleteMutation.variables === f.id && deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Удалить «${f.name}»?`)) deleteMutation.mutate(f.id);
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

      <Modal
        opened={mode !== null}
        onClose={closeModal}
        title={mode === 'create' ? 'Новое поле' : 'Редактировать поле'}
      >
        <Stack>
          <TextInput
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.currentTarget.value }))}
            required
          />
          <TextInput
            label="Название"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
            required
          />
          <Select
            label="Тип значения"
            data={VALUE_TYPE_OPTIONS}
            value={form.value_type}
            onChange={(v) => setForm((f) => ({ ...f, value_type: (v as ValueType) ?? 'number' }))}
          />
          <Textarea
            label="Описание"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>
              Отмена
            </Button>
            <Button
              loading={isSubmitting}
              disabled={!form.slug.trim() || !form.name.trim()}
              onClick={handleSubmit}
            >
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
