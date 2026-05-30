/**
 * FeedDetailPage — shows feed metadata + MatchQueue resolution UI.
 *
 * Sections:
 *  - Header: back link, status badge, total/matched/queued counts
 *  - Processing: spinner + message while status === 'processing'
 *  - Error: alert with error text when status === 'error'
 *  - MatchQueue: list of unresolved entries with candidate cards
 *    Each entry shows supplier_sku, data preview, and top-N candidates.
 *    User can confirm a candidate (POST resolve {product_id}) or skip
 *    (POST resolve {skipped:true}).
 */
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listProducts } from '@/features/product/api';
import { resolveMatchQueueEntry } from '../api';
import { useMatchQueue } from '../hooks/useMatchQueue';
import { useSupplierFeed } from '../hooks/useSupplierFeed';
import { useSuppliers } from '../hooks/useSuppliers';
import { matchQueueKeys, supplierFeedKeys } from '../queryKeys';
import type { Paginated } from '@/features/product/types';
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

// ── ManualSearchModal ─────────────────────────────────────────────────────────

interface ManualSearchModalProps {
  opened: boolean;
  onClose: () => void;
  supplierSku: string;
  onConfirm: (productId: number) => void;
  isPending: boolean;
}

function ManualSearchModal({ opened, onClose, supplierSku, onConfirm, isPending }: ManualSearchModalProps) {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchText, 300);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: productsPage } = useQuery({
    queryKey: ['products', 'list', { q: debouncedSearch }],
    queryFn: () => listProducts({ q: debouncedSearch, chars: {}, page: 1, pageSize: 20 }),
    enabled: debouncedSearch.length >= 2,
  });

  const productOptions = (productsPage?.results ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.name} (${p.sku})`,
  }));

  function handleClose() {
    setSearchText('');
    setSelectedProductId(null);
    onClose();
  }

  function handleConfirm() {
    if (selectedProductId) {
      onConfirm(Number(selectedProductId));
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Найти товар вручную">
      <Stack>
        <Text size="sm">
          Артикул поставщика: <strong>{supplierSku}</strong>
        </Text>
        <TextInput
          label="Поиск товара"
          placeholder="Введите название или артикул..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.currentTarget.value);
            setSelectedProductId(null);
          }}
        />
        {debouncedSearch.length >= 2 && (
          <Select
            label="Выберите товар"
            placeholder="Выбрать из результатов..."
            data={productOptions}
            value={selectedProductId}
            onChange={setSelectedProductId}
            searchable={false}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            disabled={!selectedProductId}
            loading={isPending}
            onClick={handleConfirm}
          >
            Выбрать
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── MatchQueueEntry card ──────────────────────────────────────────────────────

interface EntryCardProps {
  entry: MatchQueueEntry;
  feedId: number;
}

function EntryCard({ entry, feedId }: EntryCardProps) {
  const qc = useQueryClient();
  const [manualModalOpened, { open: openManualModal, close: closeManualModal }] = useDisclosure(false);

  const resolveMutation = useMutation({
    mutationFn: (payload: { product_id?: number; skipped?: boolean }) =>
      resolveMatchQueueEntry(feedId, entry.id, payload),
    onSuccess: () => {
      closeManualModal();
      qc.setQueryData<InfiniteData<Paginated<MatchQueueEntry>>>(
        matchQueueKeys.list(feedId),
        (prev) =>
          prev
            ? {
                ...prev,
                pages: prev.pages.map((p, i) => ({
                  ...p,
                  count: i === 0 ? p.count - 1 : p.count,
                  results: p.results.filter((e) => e.id !== entry.id),
                })),
              }
            : prev,
      );
      // Refresh feed counts
      qc.invalidateQueries({ queryKey: supplierFeedKeys.detail(feedId) });
    },
  });

  return (
    <>
      <Card withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600}>{entry.supplier_sku}</Text>
            <Group gap="xs">
              <Button
                size="compact-sm"
                variant="subtle"
                color="gray"
                loading={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ skipped: true })}
              >
                Пропустить
              </Button>
              <Button
                size="compact-sm"
                variant="subtle"
                onClick={openManualModal}
              >
                Найти вручную
              </Button>
            </Group>
          </Group>

          <Stack gap={4}>
            {entry.match_candidates.map((c) => (
              <Group key={c.product_id} justify="space-between">
                <Group gap="xs">
                  <Text size="sm">{c.sku}</Text>
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

      <ManualSearchModal
        opened={manualModalOpened}
        onClose={closeManualModal}
        supplierSku={entry.supplier_sku}
        onConfirm={(productId) => resolveMutation.mutate({ product_id: productId })}
        isPending={resolveMutation.isPending}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const feedId = Number(id);

  const { data: feed } = useSupplierFeed(feedId);
  const { data: suppliers } = useSuppliers();
  const queueEnabled = feed?.status === 'partial';
  const {
    data: queueData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMatchQueue(feedId, queueEnabled);

  const queueEntries = queueData?.pages.flatMap((p) => p.results) ?? [];

  const supplierMap = Object.fromEntries(
    (suppliers ?? []).map((s) => [s.id, s.name]),
  );

  const handledStatusRef = useRef<string | null>(null);

  useEffect(() => {
    handledStatusRef.current = null;
  }, [feedId]);

  useEffect(() => {
    if (!feed) return;
    if (feed.status !== 'error' && feed.status !== 'done') return;
    const key = `${feedId}:${feed.status}`;
    if (handledStatusRef.current === key) return;
    handledStatusRef.current = key;
    if (feed.status === 'error') {
      notifications.show({ message: feed.error ?? 'Ошибка', color: 'red' });
    } else {
      notifications.show({ message: 'Все строки разобраны', color: 'green' });
    }
  }, [feed, feedId]);

  if (!feed) {
    return <Loader />;
  }

  const supplierName = supplierMap[feed.supplier] ?? `#${feed.supplier}`;

  return (
    <Stack>
      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Anchor component={Link} to={`/suppliers/${feed.supplier}`}>
            ← {supplierName}
          </Anchor>
          <Title order={2}>Выгрузка #{feed.id}</Title>
        </Stack>
        <Badge color={STATUS_COLOUR[feed.status]} size="lg">
          {STATUS_LABEL[feed.status]}
        </Badge>
      </Group>

      {/* ── Row counts ── */}
      <Group gap="xl">
        <Stack gap={0} align="center">
          <Text fw={700} size="xl">{feed.total}</Text>
          <Text size="xs" c="dimmed">Всего</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fw={700} size="xl" c="green">{feed.matched}</Text>
          <Text size="xs" c="dimmed">Сопоставлено</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fw={700} size="xl" c="orange">{feed.queued}</Text>
          <Text size="xs" c="dimmed">В очереди</Text>
        </Stack>
        <Stack gap={0} align="center">
          <Text fw={700} size="xl" c="dimmed">{feed.skipped}</Text>
          <Text size="xs" c="dimmed">Пропущено</Text>
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
          {queueData && queueEntries.length === 0 ? (
            <Text c="dimmed">Очередь пуста</Text>
          ) : (
            <Stack>
              {queueEntries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} feedId={feedId} />
              ))}
              {hasNextPage && (
                <Button
                  variant="default"
                  loading={isFetchingNextPage}
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  Загрузить ещё
                </Button>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
