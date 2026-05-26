/**
 * FeedDetailPage — shows feed metadata + MatchQueue resolution UI.
 *
 * Sections:
 *  - Header: supplier name, status badge, total/matched/unmatched counts
 *  - Processing: spinner + message while status === 'processing'
 *  - Error: alert with error text when status === 'error'
 *  - MatchQueue: list of unresolved entries with candidate cards
 *    Each entry shows supplier_sku, data preview, and top-N candidates.
 *    User can confirm a candidate (PATCH resolve {product_id}) or skip
 *    (PATCH resolve {skipped:true}).
 */
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { resolveMatchQueueEntry } from '../api';
import { useMatchQueue } from '../hooks/useMatchQueue';
import { useSupplierFeed } from '../hooks/useSupplierFeed';
import { useSuppliers } from '../hooks/useSuppliers';
import { matchQueueKeys, supplierFeedKeys } from '../queryKeys';
import type { MatchQueueEntry, SupplierFeedStatus } from '../types';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOUR: Record<SupplierFeedStatus, string> = {
  draft: 'gray',
  processing: 'blue',
  matched: 'green',
  partial: 'yellow',
  done: 'green',
  error: 'red',
};

const STATUS_LABEL: Record<SupplierFeedStatus, string> = {
  draft: 'Черновик',
  processing: 'Обработка',
  matched: 'Сопоставлено',
  partial: 'Частично',
  done: 'Готово',
  error: 'Ошибка',
};

// ── MatchQueueEntry card ──────────────────────────────────────────────────────

interface EntryCardProps {
  entry: MatchQueueEntry;
  feedId: number;
}

function EntryCard({ entry, feedId }: EntryCardProps) {
  const qc = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: (payload: { product_id?: number; skipped?: boolean }) =>
      resolveMatchQueueEntry(feedId, entry.id, payload),
    onSuccess: () => {
      // Remove resolved entry from cache immediately
      qc.setQueryData<MatchQueueEntry[]>(
        matchQueueKeys.list(feedId),
        (prev) => prev?.filter((e) => e.id !== entry.id) ?? [],
      );
      // Refresh feed counts
      qc.invalidateQueries({ queryKey: supplierFeedKeys.detail(feedId) });
    },
  });

  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{entry.supplier_sku}</Text>
          <Button
            size="compact-sm"
            variant="subtle"
            color="gray"
            loading={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate({ skipped: true })}
          >
            Пропустить
          </Button>
        </Group>

        <Stack gap={4}>
          {entry.match_candidates.map((c) => (
            <Group key={c.product_id} justify="space-between">
              <Group gap="xs">
                <Text size="sm">{c.name}</Text>
                <Badge variant="light" color="gray" size="sm">
                  {Math.round(c.score * 100)}%
                </Badge>
              </Group>
              <Button
                size="compact-sm"
                loading={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ product_id: c.product_id })}
              >
                Подтвердить
              </Button>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const feedId = Number(id);

  const { data: feed } = useSupplierFeed(feedId);
  const { data: suppliers } = useSuppliers();
  const queueEnabled = feed?.status === 'partial' || feed?.status === 'matched';
  const { data: queue } = useMatchQueue(feedId, queueEnabled);

  const supplierMap = Object.fromEntries(
    (suppliers ?? []).map((s) => [s.id, s.name]),
  );

  if (!feed) {
    return <Loader />;
  }

  const supplierName = supplierMap[feed.supplier] ?? `#${feed.supplier}`;

  return (
    <Stack>
      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Выгрузка #{feed.id}</Title>
          <Text>{supplierName}</Text>
        </Stack>
        <Badge color={STATUS_COLOUR[feed.status]} size="lg">
          {STATUS_LABEL[feed.status]}
        </Badge>
      </Group>

      {/* ── Row counts ── */}
      <Group gap="xl">
        <Stack gap={0} align="center">
          <Text fw={700} size="xl">{feed.total_rows}</Text>
          <Text size="xs" c="dimmed">Всего</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fw={700} size="xl" c="green">{feed.matched_rows}</Text>
          <Text size="xs" c="dimmed">Сопоставлено</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fw={700} size="xl" c="orange">{feed.unmatched_rows}</Text>
          <Text size="xs" c="dimmed">Не сопоставлено</Text>
        </Stack>
      </Group>

      {/* ── Processing ── */}
      {feed.status === 'processing' && (
        <Group>
          <Loader size="sm" data-testid="feed-processing-loader" />
          <Text size="sm" c="dimmed">Идёт обработка файла…</Text>
        </Group>
      )}

      {/* ── Error ── */}
      {feed.status === 'error' && feed.error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Ошибка">
          {feed.error}
        </Alert>
      )}

      {/* ── MatchQueue ── */}
      {queueEnabled && (
        <>
          <Title order={3}>Очередь матчинга</Title>
          {queue && queue.length === 0 ? (
            <Text c="dimmed">Очередь пуста</Text>
          ) : (
            <Stack>
              {(queue ?? []).map((entry) => (
                <EntryCard key={entry.id} entry={entry} feedId={feedId} />
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
