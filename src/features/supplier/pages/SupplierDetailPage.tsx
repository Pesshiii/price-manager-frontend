/**
 * SupplierDetailPage — детальная страница поставщика.
 *
 * Маршрут: /suppliers/:id
 *
 * Секции:
 *  - Шапка: название, кнопки «Редактировать» и «Удалить»
 *  - Выгрузки: список SupplierFeed этого поставщика + кнопка «Создать выгрузку»
 *  - Конфигурации: список FeedMapping этого поставщика + кнопка «Добавить конфигурацию»
 */
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteSupplier, deleteFeedMapping, updateSupplier } from '../api';
import { useFeedMappings } from '../hooks/useFeedMappings';
import { useSupplier } from '../hooks/useSupplier';
import { useSupplierFeeds } from '../hooks/useSupplierFeeds';
import { feedMappingKeys, supplierKeys } from '../queryKeys';
import type { SupplierFeedStatus } from '../types';

// ── Status helpers (mirrors FeedsPage) ───────────────────────────────────────

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

// ── Edit modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  opened: boolean;
  supplierId: number;
  currentName: string;
  onClose: () => void;
}

function EditModal({ opened, supplierId, currentName, onClose }: EditModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(currentName);

  const mutation = useMutation({
    mutationFn: (newName: string) => updateSupplier(supplierId, { name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.all });
      onClose();
    },
  });

  // Sync state when modal opens or when currentName changes externally
  useEffect(() => {
    if (opened) setName(currentName);
  }, [opened, currentName]);

  function handleClose() {
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Редактировать поставщика">
      <Stack>
        <TextInput
          label="Название"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!name.trim() || name.trim() === currentName}
            onClick={() => mutation.mutate(name.trim())}
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: supplier, isLoading: supplierLoading } = useSupplier(supplierId);
  const { data: feeds, isLoading: feedsLoading } = useSupplierFeeds({ supplier: supplierId });
  const { data: mappings, isLoading: mappingsLoading } = useFeedMappings(supplierId);

  // ── Delete supplier ───────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => deleteSupplier(supplierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.all });
      navigate('/suppliers');
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 409 || status === 400) {
        setDeleteError('Невозможно удалить поставщика: существуют связанные выгрузки.');
      } else {
        notifications.show({ color: 'red', message: 'Ошибка при удалении поставщика' });
      }
    },
  });

  // ── Delete mapping ────────────────────────────────────────────────────────

  const deleteMappingMutation = useMutation({
    mutationFn: deleteFeedMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: feedMappingKeys.all }),
    onError: (err: unknown) => {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 409) {
        notifications.show({
          color: 'red',
          message: 'Нельзя удалить конфигурацию: существуют связанные сессии выгрузок.',
        });
      } else {
        notifications.show({ color: 'red', message: 'Ошибка при удалении конфигурации' });
      }
    },
  });

  if (supplierLoading) {
    return <Loader />;
  }

  if (!supplier) {
    return (
      <Stack>
        <Text c="dimmed">Поставщик не найден.</Text>
        <Link to="/suppliers">← Назад к поставщикам</Link>
      </Stack>
    );
  }

  return (
    <Stack>
      {/* ── Back link ── */}
      <Link to="/suppliers" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <IconArrowLeft size={14} />
        <Text size="sm">Все поставщики</Text>
      </Link>

      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start">
        <Title order={2}>{supplier.name}</Title>
        <Group gap="xs">
          <Button
            variant="default"
            size="sm"
            leftSection={<IconPencil size={14} />}
            onClick={openEdit}
          >
            Редактировать
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="sm"
            leftSection={<IconTrash size={14} />}
            loading={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`Удалить поставщика «${supplier.name}»?`)) {
                setDeleteError(null);
                deleteMutation.mutate();
              }
            }}
          >
            Удалить
          </Button>
        </Group>
      </Group>

      {deleteError && (
        <Alert color="red" withCloseButton onClose={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      {/* ── Feeds section ── */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={3}>Выгрузки</Title>
          <Button
            component={Link}
            to={`/suppliers/feeds/new?supplier=${supplierId}`}
            size="sm"
          >
            Создать выгрузку
          </Button>
        </Group>

        {feedsLoading ? (
          <Loader size="sm" />
        ) : (
          <Card withBorder padding={0}>
            <Table highlightOnHover style={{ cursor: 'pointer' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Дата создания</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(feeds ?? []).length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Text c="dimmed" size="sm" p="sm">
                        Выгрузок пока нет
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  (feeds ?? []).map((feed) => (
                    <Table.Tr
                      key={feed.id}
                      onClick={() => navigate(`/suppliers/feeds/${feed.id}`)}
                    >
                      <Table.Td>
                        <Badge color={STATUS_COLOUR[feed.status]}>
                          {STATUS_LABEL[feed.status]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {new Date(feed.created_at).toLocaleDateString('ru-RU')}
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>

      {/* ── Mappings section ── */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={3}>Конфигурации</Title>
          <Button
            component={Link}
            to={`/suppliers/mappings?supplier=${supplierId}`}
            size="sm"
            variant="default"
          >
            Управление конфигурациями
          </Button>
        </Group>

        {mappingsLoading ? (
          <Loader size="sm" />
        ) : (
          <Card withBorder padding={0}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Порог матчинга</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(mappings ?? []).length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text c="dimmed" size="sm" p="sm">
                        Конфигураций пока нет
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  (mappings ?? []).map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>{m.name}</Table.Td>
                      <Table.Td>{m.auto_match_threshold}</Table.Td>
                      <Table.Td>
                        <Group justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Удалить конфигурацию"
                            loading={
                              deleteMappingMutation.variables === m.id &&
                              deleteMappingMutation.isPending
                            }
                            onClick={() => {
                              if (confirm(`Удалить конфигурацию «${m.name}»?`)) {
                                deleteMappingMutation.mutate(m.id);
                              }
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>

      {/* ── Edit modal ── */}
      <EditModal
        opened={editOpened}
        supplierId={supplierId}
        currentName={supplier.name}
        onClose={closeEdit}
      />
    </Stack>
  );
}
