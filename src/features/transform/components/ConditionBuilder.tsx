import { ActionIcon, Button, Group, SegmentedControl, Select, Stack, Switch, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { AndOrCondition, Condition, ConditionCompareOp, ConditionSource, LeafCondition } from '../types';

interface Props {
  value: Condition | null;
  onChange: (c: Condition | null) => void;
}

const DEFAULT_LEAF: LeafCondition = { op: '==', source: 'feed', key: '', value: '' };

export function ConditionBuilder({ value, onChange }: Props) {
  const noCondition = value === null;
  const cond = value as AndOrCondition | null;

  function toggleNoCondition(checked: boolean) {
    if (checked) {
      onChange(null);
    } else {
      onChange({ op: 'AND', conditions: [] });
    }
  }

  function addLeaf() {
    if (!cond) return;
    onChange({ ...cond, conditions: [...cond.conditions, { ...DEFAULT_LEAF }] });
  }

  function removeLeaf(idx: number) {
    if (!cond) return;
    onChange({ ...cond, conditions: cond.conditions.filter((_, i) => i !== idx) });
  }

  function updateLeaf(idx: number, patch: Partial<LeafCondition>) {
    if (!cond) return;
    const conditions = cond.conditions.map((c, i) => (i === idx ? { ...(c as LeafCondition), ...patch } : c));
    onChange({ ...cond, conditions });
  }

  return (
    <Stack gap="xs">
      <Switch
        label="Без условия"
        checked={noCondition}
        onChange={(e) => toggleNoCondition(e.currentTarget.checked)}
      />
      {!noCondition && cond && (
        <Stack gap="xs">
          <SegmentedControl
            data={['AND', 'OR']}
            value={cond.op}
            onChange={(v) => onChange({ ...cond, op: v as 'AND' | 'OR' })}
          />
          {cond.conditions.map((leaf, idx) => {
            const l = leaf as LeafCondition;
            const hideKey = l.source === 'brand' || l.source === 'category';
            return (
              <Group key={idx} gap="xs" align="flex-end">
                <Select
                  label="Источник"
                  data={['feed', 'char', 'brand', 'category']}
                  value={l.source}
                  onChange={(v) => updateLeaf(idx, { source: v as ConditionSource })}
                />
                {!hideKey && (
                  <TextInput
                    label="Ключ"
                    value={l.key ?? ''}
                    onChange={(e) => updateLeaf(idx, { key: e.currentTarget.value })}
                  />
                )}
                <Select
                  label="Оператор"
                  data={['==', '!=', '<', '<=', '>', '>=']}
                  value={l.op}
                  onChange={(v) => updateLeaf(idx, { op: v as ConditionCompareOp })}
                />
                <TextInput
                  label="Значение"
                  value={String(l.value ?? '')}
                  onChange={(e) => updateLeaf(idx, { value: e.currentTarget.value })}
                />
                <ActionIcon
                  color="red"
                  aria-label="Удалить условие"
                  onClick={() => removeLeaf(idx)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            );
          })}
          <Button variant="light" onClick={addLeaf}>
            Добавить условие
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
