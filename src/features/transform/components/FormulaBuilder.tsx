import { Alert, Select, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import type {
  ArithmeticFormula,
  CopyFormula,
  Formula,
  IfFormula,
  LiteralFormula,
  MapFormula,
} from '../types';
import { ConditionBuilder } from './ConditionBuilder';

interface Props {
  value: Formula | null;
  onChange: (f: Formula) => void;
}

interface SubFormulaProps {
  value: Formula | null;
  onChange: (f: Formula) => void;
}

function SubFormulaBuilder({ value, onChange }: SubFormulaProps) {
  const type = value?.type ?? 'copy';
  return (
    <Stack gap="xs">
      <Select
        label="Тип"
        data={['copy', 'literal']}
        value={type}
        onChange={(v) => {
          if (v === 'copy') onChange({ type: 'copy', source: 'feed', key: '' });
          if (v === 'literal') onChange({ type: 'literal', value: '' });
        }}
      />
      {type === 'copy' && (
        <>
          <Select
            label="Источник"
            data={['feed', 'char']}
            value={(value as CopyFormula)?.source ?? 'feed'}
            onChange={(v) =>
              v && onChange({ ...(value as CopyFormula), source: v as 'feed' | 'char' })
            }
          />
          <TextInput
            label="Ключ"
            value={(value as CopyFormula)?.key ?? ''}
            onChange={(e) => onChange({ ...(value as CopyFormula), key: e.currentTarget.value })}
          />
        </>
      )}
      {type === 'literal' && (
        <TextInput
          label="Значение"
          value={String((value as LiteralFormula)?.value ?? '')}
          onChange={(e) => onChange({ type: 'literal', value: e.currentTarget.value })}
        />
      )}
    </Stack>
  );
}

function defaultFormula(type: string): Formula {
  switch (type) {
    case 'literal':
      return { type: 'literal', value: '' };
    case 'arithmetic':
      return {
        type: 'arithmetic',
        op: '+',
        left: { type: 'copy', source: 'feed', key: '' },
        right: { type: 'copy', source: 'feed', key: '' },
      };
    case 'map':
      return {
        type: 'map',
        input: { type: 'copy', source: 'feed', key: '' },
        map: {},
        default: '',
      };
    case 'if':
      return {
        type: 'if',
        condition: { op: 'AND', conditions: [] },
        then: { type: 'copy', source: 'feed', key: '' },
        else: { type: 'copy', source: 'feed', key: '' },
      };
    default:
      return { type: 'copy', source: 'feed', key: '' };
  }
}

export function FormulaBuilder({ value, onChange }: Props) {
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [rawError, setRawError] = useState('');

  const currentType = value?.type ?? 'copy';

  function switchToRaw(checked: boolean) {
    if (checked) {
      setRawJson(value ? JSON.stringify(value, null, 2) : '');
      setRawError('');
      setRawMode(true);
    } else {
      try {
        const parsed = JSON.parse(rawJson) as Formula;
        onChange(parsed);
        setRawError('');
        setRawMode(false);
      } catch {
        setRawError('Невалидный JSON');
      }
    }
  }

  if (rawMode) {
    return (
      <Stack gap="xs">
        <Switch
          label="Расширенный режим"
          checked={rawMode}
          onChange={(e) => switchToRaw(e.currentTarget.checked)}
        />
        <Alert color="yellow">Структурированный вид недоступен в расширенном режиме</Alert>
        <Textarea
          label="JSON"
          value={rawJson}
          onChange={(e) => setRawJson(e.currentTarget.value)}
          autosize
          minRows={4}
        />
        {rawError && <div>{rawError}</div>}
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Switch
        label="Расширенный режим"
        checked={rawMode}
        onChange={(e) => switchToRaw(e.currentTarget.checked)}
      />
      <Select
        label="Тип формулы"
        data={['copy', 'literal', 'arithmetic', 'map', 'if']}
        value={currentType}
        onChange={(v) => v && onChange(defaultFormula(v))}
      />
      {currentType === 'copy' && (
        <>
          <Select
            label="Источник"
            data={['feed', 'char']}
            value={(value as CopyFormula).source}
            onChange={(v) =>
              v && onChange({ ...(value as CopyFormula), source: v as 'feed' | 'char' })
            }
          />
          <TextInput
            label="Ключ"
            value={(value as CopyFormula).key}
            onChange={(e) => onChange({ ...(value as CopyFormula), key: e.currentTarget.value })}
          />
        </>
      )}
      {currentType === 'literal' && (
        <TextInput
          label="Значение"
          value={String((value as LiteralFormula).value ?? '')}
          onChange={(e) => onChange({ type: 'literal', value: e.currentTarget.value })}
        />
      )}
      {currentType === 'arithmetic' && (
        <>
          <Select
            label="Операция"
            data={['+', '-', '*', '/']}
            value={(value as ArithmeticFormula).op}
            onChange={(v) =>
              v && onChange({ ...(value as ArithmeticFormula), op: v as '+' | '-' | '*' | '/' })
            }
          />
          <SubFormulaBuilder
            value={(value as ArithmeticFormula).left}
            onChange={(f) => onChange({ ...(value as ArithmeticFormula), left: f })}
          />
          <SubFormulaBuilder
            value={(value as ArithmeticFormula).right}
            onChange={(f) => onChange({ ...(value as ArithmeticFormula), right: f })}
          />
        </>
      )}
      {currentType === 'map' && (
        <>
          <SubFormulaBuilder
            value={(value as MapFormula).input}
            onChange={(f) => onChange({ ...(value as MapFormula), input: f })}
          />
          <TextInput
            label="По умолчанию"
            value={String((value as MapFormula).default ?? '')}
            onChange={(e) => onChange({ ...(value as MapFormula), default: e.currentTarget.value })}
          />
        </>
      )}
      {currentType === 'if' && (
        <>
          <ConditionBuilder
            value={(value as IfFormula).condition}
            onChange={(c) => onChange({ ...(value as IfFormula), condition: c! })}
          />
          <SubFormulaBuilder
            value={(value as IfFormula).then}
            onChange={(f) => onChange({ ...(value as IfFormula), then: f })}
          />
          <SubFormulaBuilder
            value={(value as IfFormula).else}
            onChange={(f) => onChange({ ...(value as IfFormula), else: f })}
          />
        </>
      )}
    </Stack>
  );
}
