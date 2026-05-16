import { Badge, Checkbox, Group, Stack, Text } from '@mantine/core';
import type { CharacteristicType, FacetBucket } from '../types';

export interface FacetGroupProps {
  type: CharacteristicType;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (value: string) => void;
}

export function FacetGroup({ type, buckets, selected, onToggle }: FacetGroupProps) {
  if (buckets.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {type.label}
        {type.unit ? ` (${type.unit})` : ''}
      </Text>
      {buckets.map((bucket) => {
        const value = String(bucket.value);
        return (
          <Checkbox
            key={value}
            checked={selected.includes(value)}
            onChange={() => onToggle(value)}
            label={
              <Group gap={6} wrap="nowrap">
                <Text size="sm">{value}</Text>
                <Badge size="xs" variant="light" color="gray">
                  {bucket.count}
                </Badge>
              </Group>
            }
          />
        );
      })}
    </Stack>
  );
}
