import {
  ActionIcon,
  Anchor,
  Breadcrumbs,
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
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFeedMapping } from '@/features/supplier/api';
import { supplierKeys } from '@/features/supplier/queryKeys';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { FormulaBuilder } from '../components/FormulaBuilder';
import { createRule, deleteRule, listRules, listSnapshotFields, updateRule } from '../api';
import { transformKeys } from '../queryKeys';
import type {
  Condition,
  Formula,
  TransformRule,
  TransformRuleWritePayload,
} from '../types';

function formulaSummary(formula: Formula): string {
  if (formula.type === 'copy') return `copy:${formula.source}.${formula.key}`;
  if (formula.type === 'literal') return `literal:${JSON.stringify(formula.value)}`;
  return formula.type;
}

function conditionSummary(cond: Condition | null): string {
  if (!cond) return '—';
  return JSON.stringify(cond);
}

const DEFAULT_FORMULA: Formula = { type: 'copy', source: 'feed', key: '' };

interface RuleFormState {
  target_field: string;
  priority: number;
  formula: Formula;
  condition: Condition | null;
}

const DEFAULT_FORM: RuleFormState = {
  target_field: '',
  priority: 0,
  formula: DEFAULT_FORMULA,
  condition: null,
};

export function TransformRulesPage() {
  const { id: supplierId, mappingId: mappingIdStr } = useParams<{
    id: string;
    mappingId: string;
  }>();
  const mappingId = Number(mappingIdStr);
  const qc = useQueryClient();

  const { data: mapping } = useQuery({
    queryKey: supplierKeys.mapping(mappingId),
    queryFn: () => getFeedMapping(mappingId),
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: transformKeys.rules(mappingId),
    queryFn: () => listRules(mappingId),
  });

  const { data: fields } = useQuery({
    queryKey: transformKeys.snapshotFields(),
    queryFn: listSnapshotFields,
  });

  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<TransformRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);

  function openCreate() {
    setForm(DEFAULT_FORM);
    setMode('create');
  }

  function openEdit(rule: TransformRule) {
    setForm({
      target_field: String(rule.target_field),
      priority: rule.priority,
      formula: rule.formula,
      condition: rule.condition,
    });
    setEditTarget(rule);
    setMode('edit');
  }

  function closeModal() {
    setMode(null);
    setEditTarget(null);
  }

  function invalidateRules() {
    qc.invalidateQueries({ queryKey: transformKeys.rules(mappingId) });
  }

  const createMutation = useMutation({
    mutationFn: (payload: TransformRuleWritePayload) => createRule(payload),
    onSuccess: () => {
      invalidateRules();
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TransformRuleWritePayload> }) =>
      updateRule(id, payload),
    onSuccess: () => {
      invalidateRules();
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: invalidateRules,
  });

  function handleSubmit() {
    const payload: TransformRuleWritePayload = {
      feed_mapping: mappingId,
      priority: form.priority,
      target_field: Number(form.target_field),
      formula: form.formula,
      condition: form.condition,
    };
    if (mode === 'create') {
      createMutation.mutate(payload);
    } else if (mode === 'edit' && editTarget) {
      updateMutation.mutate({ id: editTarget.id, payload });
    }
  }

  const sortedRules = [...(rules ?? [])].sort((a, b) => a.priority - b.priority);
  const fieldOptions = (fields ?? []).map((f) => ({ value: String(f.id), label: f.slug }));
  const fieldById = Object.fromEntries((fields ?? []).map((f) => [f.id, f]));
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} to={`/suppliers/${supplierId}`}>
          Поставщик
        </Anchor>
        <Text>{mapping?.name ?? '...'}</Text>
        <Text>Правила трансформации</Text>
      </Breadcrumbs>

      <Group justify="space-between">
        <Title order={2}>Правила трансформации</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Создать правило
        </Button>
      </Group>

      {isLoading && <Loader />}

      {!isLoading && (
        <Card withBorder padding={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Приоритет</Table.Th>
                <Table.Th>Целевое поле</Table.Th>
                <Table.Th>Формула</Table.Th>
                <Table.Th>Условие</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedRules.map((rule) => (
                <Table.Tr key={rule.id}>
                  <Table.Td>{rule.priority}</Table.Td>
                  <Table.Td>{fieldById[rule.target_field]?.slug ?? rule.target_field}</Table.Td>
                  <Table.Td>{formulaSummary(rule.formula)}</Table.Td>
                  <Table.Td>{conditionSummary(rule.condition)}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => openEdit(rule)}
                        aria-label="Редактировать"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        loading={
                          deleteMutation.variables === rule.id && deleteMutation.isPending
                        }
                        onClick={() => {
                          if (confirm('Удалить правило?')) deleteMutation.mutate(rule.id);
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
        title={mode === 'create' ? 'Создать правило' : 'Редактировать правило'}
        size="lg"
      >
        <Stack>
          <Select
            label="Целевое поле"
            data={fieldOptions}
            value={form.target_field || null}
            onChange={(v) => setForm((f) => ({ ...f, target_field: v ?? '' }))}
            searchable
          />
          <NumberInput
            label="Приоритет"
            value={form.priority}
            onChange={(v) => setForm((f) => ({ ...f, priority: typeof v === 'number' ? v : 0 }))}
          />
          <FormulaBuilder
            value={form.formula}
            onChange={(formula) => setForm((f) => ({ ...f, formula }))}
          />
          <ConditionBuilder
            value={form.condition}
            onChange={(condition) => setForm((f) => ({ ...f, condition }))}
          />
          <Anchor href="/transform/snapshot-fields" target="_blank" size="sm">
            Создать поле →
          </Anchor>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>
              Отмена
            </Button>
            <Button
              loading={isSubmitting}
              disabled={!form.target_field}
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
