/**
 * SuppliersPage — список всех поставщиков с возможностью создать нового.
 *
 * Маршрут: /suppliers (index)
 */
import {
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
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSupplier } from '../api';
import { useSuppliers } from '../hooks/useSuppliers';
import { supplierKeys } from '../queryKeys';

// ── Create modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  opened: boolean;
  onClose: () => void;
}

function CreateModal({ opened, onClose }: CreateModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.all });
      handleClose();
    },
  });

  function handleClose() {
    setName('');
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Новый поставщик">
      <Stack>
        <TextInput
          label="Название"
          required
          placeholder="Введите название поставщика"
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
            disabled={!name.trim()}
            onClick={() => mutation.mutate({ name: name.trim() })}
          >
            Создать
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuppliersPage() {
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const { data: suppliers, isLoading } = useSuppliers();

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Поставщики</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Новый поставщик
        </Button>
      </Group>

      {isLoading && <Loader />}

      {!isLoading && (
        <Card withBorder padding={0}>
          <Table highlightOnHover style={{ cursor: 'pointer' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(suppliers ?? []).length === 0 ? (
                <Table.Tr>
                  <Table.Td>
                    <Text c="dimmed" size="sm" p="sm">
                      Поставщики не найдены
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                (suppliers ?? []).map((s) => (
                  <Table.Tr
                    key={s.id}
                    onClick={() => navigate(`/suppliers/${s.id}`)}
                  >
                    <Table.Td>{s.name}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <CreateModal opened={opened} onClose={close} />
    </Stack>
  );
}
