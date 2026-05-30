import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listProducts } from '@/features/product/api';
import { deleteSupplierLink, updateSupplierLink } from '../api';
import { useSupplierLinks } from '../hooks/useSupplierLinks';
import { useSuppliers } from '../hooks/useSuppliers';
import { supplierLinkKeys } from '../queryKeys';
import type { SupplierLink } from '../types';

// ── Reassignment modal ────────────────────────────────────────────────────────

interface ReassignModalProps {
  link: SupplierLink | null;
  opened: boolean;
  onClose: () => void;
  onSubmit: (linkId: number, productId: number) => void;
  isPending: boolean;
}

function ReassignModal({ link, opened, onClose, onSubmit, isPending }: ReassignModalProps) {
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

  function handleSubmit() {
    if (link && selectedProductId) {
      onSubmit(link.id, Number(selectedProductId));
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Переназначить связь">
      <Stack>
        <Text size="sm">
          Артикул поставщика: <strong>{link?.supplier_sku}</strong>
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
            onClick={handleSubmit}
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LinksPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const supplierFilter = searchParams.get('supplier') ?? '';
  const skuFilter = searchParams.get('sku') ?? '';

  // Local state for SKU input (before debounce)
  const [skuInput, setSkuInput] = useState(skuFilter);
  const [_debouncedSku] = useDebouncedValue(skuInput, 300);

  // Reassignment modal state
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [reassignTarget, setReassignTarget] = useState<SupplierLink | null>(null);

  const { data: suppliers } = useSuppliers();
  const { data: links, isLoading } = useSupplierLinks({
    supplier: supplierFilter ? Number(supplierFilter) : undefined,
    supplier_sku: skuFilter || undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplierLink,
    onSuccess: () => qc.invalidateQueries({ queryKey: supplierLinkKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, product }: { id: number; product: number }) =>
      updateSupplierLink(id, { product_id: product }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierLinkKeys.all });
      closeModal();
    },
  });

  const supplierOptions = (suppliers ?? []).map((s) => ({
    value: String(s.id),
    label: s.name,
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

  function handleReassign(link: SupplierLink) {
    setReassignTarget(link);
    openModal();
  }

  return (
    <Stack>
      <Title order={2}>Связи поставщиков</Title>

      <Group>
        <Select
          placeholder="Все поставщики"
          data={supplierOptions}
          value={supplierFilter || null}
          onChange={(v) => setParam('supplier', v)}
          clearable
          aria-label="Поставщик"
        />
        <TextInput
          placeholder="Поиск по артикулу"
          value={skuInput}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setSkuInput(v);
            setParam('sku', v || null);
          }}
          aria-label="SKU"
        />
      </Group>

      {isLoading && <Loader />}

      {!isLoading && (
        <Card withBorder padding={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Поставщик</Table.Th>
                <Table.Th>Артикул поставщика</Table.Th>
                <Table.Th>Товар</Table.Th>
                <Table.Th>Артикул товара</Table.Th>
                <Table.Th>Создано</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(links ?? []).map((link) => (
                <Table.Tr key={link.id}>
                  <Table.Td>{link.supplier.name}</Table.Td>
                  <Table.Td>{link.supplier_sku}</Table.Td>
                  <Table.Td>{link.product.name}</Table.Td>
                  <Table.Td>{link.product.sku}</Table.Td>
                  <Table.Td>
                    {new Date(link.created_at).toLocaleDateString('ru-RU')}
                  </Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap="xs">
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        leftSection={<IconPencil size={14} />}
                        onClick={() => handleReassign(link)}
                      >
                        Переназначить
                      </Button>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Удалить"
                        loading={deleteMutation.variables === link.id && deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Удалить связь для «${link.supplier_sku}»?`)) {
                            deleteMutation.mutate(link.id);
                          }
                        }}
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

      <ReassignModal
        link={reassignTarget}
        opened={modalOpened}
        onClose={closeModal}
        onSubmit={(linkId, productId) => updateMutation.mutate({ id: linkId, product: productId })}
        isPending={updateMutation.isPending}
      />
    </Stack>
  );
}
