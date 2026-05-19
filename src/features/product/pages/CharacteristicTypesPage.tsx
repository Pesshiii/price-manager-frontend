import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  Stack,
  TagsInput,
  Table,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  createCharacteristicType,
  deleteCharacteristicType,
  type CharacteristicTypeWritePayload,
} from '../api';
import { useCategories } from '../hooks/useCategories';
import { useCharacteristicTypes } from '../hooks/useCharacteristicTypes';
import { charTypeKeys } from '../queryKeys';
import type { ValueType } from '../types';

const VALUE_TYPES: ValueType[] = ['string', 'integer', 'float', 'boolean', 'choice'];

interface FormState {
  name: string;
  label: string;
  value_type: ValueType;
  options: string[];
  unit: string;
  required: boolean;
  categories: number[];
}

const emptyForm: FormState = {
  name: '',
  label: '',
  value_type: 'string',
  options: [],
  unit: '',
  required: false,
  categories: [],
};

export function CharacteristicTypesPage() {
  const qc = useQueryClient();
  // Admin page — opt out of the default page_size=200 so the whole catalog
  // is browsable until a proper paginated table UI is added.
  const { data: page, isLoading } = useCharacteristicTypes({ page_size: 2000 });
  const data = page?.results ?? [];
  const { data: categories } = useCategories();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const createMutation = useMutation({
    mutationFn: (payload: CharacteristicTypeWritePayload) => createCharacteristicType(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: charTypeKeys.all });
      close();
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCharacteristicType,
    onSuccess: () => qc.invalidateQueries({ queryKey: charTypeKeys.all }),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Типы характеристик</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Новый тип
        </Button>
      </Group>

      {isLoading && <Loader />}
      {!isLoading && (
        <Card withBorder padding={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Имя</Table.Th>
                <Table.Th>Метка</Table.Th>
                <Table.Th>Тип</Table.Th>
                <Table.Th>Ед.</Table.Th>
                <Table.Th>Обяз.</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(data ?? []).map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>{t.label}</Table.Td>
                  <Table.Td>{t.value_type}</Table.Td>
                  <Table.Td>{t.unit || '—'}</Table.Td>
                  <Table.Td>{t.required ? 'да' : ''}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        loading={deleteMutation.variables === t.id}
                        onClick={() => {
                          if (confirm(`Удалить «${t.label}»?`)) deleteMutation.mutate(t.id);
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

      <Modal opened={opened} onClose={close} title="Новый тип характеристики" size="lg">
        <Stack>
          <Group grow>
            <TextInput
              label="Имя (slug)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
              required
            />
            <TextInput
              label="Метка"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
              required
            />
          </Group>
          <Group grow>
            <Select
              label="Тип значения"
              data={VALUE_TYPES}
              value={form.value_type}
              onChange={(v) => setForm({ ...form, value_type: (v ?? 'string') as ValueType })}
            />
            <TextInput
              label="Единица"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.currentTarget.value })}
            />
          </Group>
          {form.value_type === 'choice' && (
            <TagsInput
              label="Варианты"
              value={form.options}
              onChange={(options) => setForm({ ...form, options })}
            />
          )}
          <MultiSelect
            label="Категории"
            searchable
            data={(categories ?? []).map((c) => ({
              value: String(c.id),
              label: '— '.repeat(c.level) + c.name,
            }))}
            value={form.categories.map(String)}
            onChange={(values) =>
              setForm({ ...form, categories: values.map((v) => Number(v)) })
            }
          />
          <Checkbox
            label="Обязательный"
            checked={form.required}
            onChange={(e) => setForm({ ...form, required: e.currentTarget.checked })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Отмена
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.name.trim() || !form.label.trim()}
              onClick={() =>
                createMutation.mutate({
                  name: form.name.trim(),
                  label: form.label.trim(),
                  value_type: form.value_type,
                  options: form.options,
                  unit: form.unit,
                  required: form.required,
                  categories: form.categories,
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
