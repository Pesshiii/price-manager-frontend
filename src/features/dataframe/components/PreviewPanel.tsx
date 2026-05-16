import { Alert, Badge, Card, Group, Loader, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconUpload } from '@tabler/icons-react';
import type { PreviewResult } from '../types';
import { isPreviewError } from '../types';
import { PreviewTable } from './PreviewTable';

interface Props {
  result: PreviewResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  hasSession: boolean;
  stepLabel: string;
}

export function PreviewPanel({
  result,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  hasSession,
  stepLabel,
}: Props) {
  if (!hasSession) {
    return (
      <Card withBorder padding="lg">
        <Stack align="center" gap="xs">
          <IconUpload size={28} />
          <Text c="dimmed">Загрузите файл, чтобы увидеть превью</Text>
        </Stack>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card withBorder padding="lg">
        <Group justify="center">
          <Loader size="sm" />
          <Text size="sm">Загружаем превью…</Text>
        </Group>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={16} />}>
        {errorMessage || 'Не удалось получить превью'}
      </Alert>
    );
  }

  if (!result) return null;

  if (isPreviewError(result)) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Ошибка в шаге">
        {result.error.message}
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            После шага:
          </Text>
          <Badge variant="light">{stepLabel}</Badge>
        </Group>
        <Group gap="md">
          <Text size="xs" c="dimmed">
            Колонок: <b>{result.columns.length}</b>
          </Text>
          <Text size="xs" c="dimmed">
            Строк: <b>{result.total_rows}</b>{' '}
            {result.returned_rows < result.total_rows && (
              <span>(показано {result.returned_rows})</span>
            )}
          </Text>
          {isFetching && <Loader size="xs" />}
        </Group>
      </Group>
      <PreviewTable columns={result.columns} rows={result.rows} />
    </Stack>
  );
}
