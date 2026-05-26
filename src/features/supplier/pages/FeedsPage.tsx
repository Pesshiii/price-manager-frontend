import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Title,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { deleteSupplierFeed } from '../api';
import { useSupplierFeeds } from '../hooks/useSupplierFeeds';
import { useSuppliers } from '../hooks/useSuppliers';
import { supplierFeedKeys } from '../queryKeys';
import type { SupplierFeedStatus } from '../types';

// ── Status badge ──────────────────────────────────────────────────────────────

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

const ALL_STATUSES: SupplierFeedStatus[] = [
  'draft', 'processing', 'matched', 'partial', 'done', 'error',
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function FeedsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const supplierFilter = searchParams.get('supplier') ?? undefined;
  const statusFilter = searchParams.get('status') ?? undefined;

  const deleteMutation = useMutation({
    mutationFn: deleteSupplierFeed,
    onSuccess: () => qc.invalidateQueries({ queryKey: supplierFeedKeys.all }),
  });

  const { data: feeds, isLoading: feedsLoading } = useSupplierFeeds({
    supplier: supplierFilter !== undefined ? Number(supplierFilter) : undefined,
    status: statusFilter,
  });

  const { data: suppliers } = useSuppliers();

  const supplierMap = Object.fromEntries(
    (suppliers ?? []).map((s) => [s.id, s.name]),
  );

  const supplierOptions = (suppliers ?? []).map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const statusOptions = ALL_STATUSES.map((s) => ({
    value: s,
    label: STATUS_LABEL[s],
  }));

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Выгрузки</Title>
        <Link to="/suppliers/feeds/new">Создать выгрузку</Link>
      </Group>

      <Group>
        <Select
          placeholder="Все поставщики"
          data={supplierOptions}
          value={supplierFilter ?? null}
          onChange={(v) => setParam('supplier', v)}
          clearable
          aria-label="Поставщик"
        />
        <Select
          placeholder="Любой статус"
          data={statusOptions}
          value={statusFilter ?? null}
          onChange={(v) => setParam('status', v)}
          clearable
          aria-label="Статус"
        />
      </Group>

      {feedsLoading && <Loader />}

      {!feedsLoading && (
        <Card withBorder padding={0}>
          <Table highlightOnHover style={{ cursor: 'pointer' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Поставщик</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Дата создания</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(feeds ?? []).map((feed) => (
                <Table.Tr
                  key={feed.id}
                  onClick={() => navigate(`/suppliers/feeds/${feed.id}`)}
                >
                  <Table.Td>{supplierMap[feed.supplier] ?? `#${feed.supplier}`}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOUR[feed.status]}>
                      {STATUS_LABEL[feed.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Date(feed.created_at).toLocaleDateString('ru-RU')}
                  </Table.Td>
                  <Table.Td>
                    {feed.status === 'draft' && (
                      <Group justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Удалить"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Удалить выгрузку #${feed.id}?`)) {
                              deleteMutation.mutate(feed.id);
                            }
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
