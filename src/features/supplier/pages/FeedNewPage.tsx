/**
 * FeedNewPage — two-step wizard for creating a new SupplierFeed.
 *
 * Step 1 — Configuration selection
 *   • Select Поставщик (from useSuppliers)
 *   • Select Конфигурация/FeedMapping (from useFeedMappings(supplierId))
 *   • "Новая конфигурация" inline modal → auto-selects new mapping on success
 *   • "Далее →" — disabled until both supplier + mapping chosen;
 *     on click: POST /api/suppliers/feeds/ → advance to step 2
 *
 * Step 2 — File upload & processing
 *   • Mantine Dropzone → each dropped file: POST /api/suppliers/feeds/:id/upload/
 *   • Uploaded-file list with per-file delete
 *   • "Обработать" — disabled when list empty; on click: POST …/process/ → navigate to detail
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createFeedMapping,
  createSupplierFeed,
  deleteFeedFile,
  processFeed,
  uploadFeedFile,
} from '../api';
import { useFeedMappings } from '../hooks/useFeedMappings';
import { useSuppliers } from '../hooks/useSuppliers';
import { feedMappingKeys } from '../queryKeys';
import type { FeedFile, SupplierFeed } from '../types';

// ── Step 1 ────────────────────────────────────────────────────────────────────

interface Step1Props {
  supplierId: string;
  mappingId: string;
  onSupplierChange: (v: string) => void;
  onMappingChange: (v: string) => void;
  onOpenModal: () => void;
  onDalee: () => void;
  daleeLoading: boolean;
  supplierOptions: { value: string; label: string }[];
  mappingOptions: { value: string; label: string }[];
}

function Step1({
  supplierId,
  mappingId,
  onSupplierChange,
  onMappingChange,
  onOpenModal,
  onDalee,
  daleeLoading,
  supplierOptions,
  mappingOptions,
}: Step1Props) {
  const canAdvance = Boolean(supplierId) && Boolean(mappingId);

  return (
    <Stack>
      <Title order={2}>Новая выгрузка</Title>

      <Select
        label="Поставщик"
        placeholder="Выбрать поставщика"
        data={supplierOptions}
        value={supplierId || null}
        onChange={(v) => onSupplierChange(v ?? '')}
      />

      <Select
        label="Конфигурация"
        placeholder="Выбрать конфигурацию"
        data={mappingOptions}
        value={mappingId || null}
        onChange={(v) => onMappingChange(v ?? '')}
        disabled={!supplierId}
      />

      <Group>
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={onOpenModal}
          disabled={!supplierId}
        >
          Новая конфигурация
        </Button>
      </Group>

      <Group justify="flex-end">
        <Button disabled={!canAdvance} loading={daleeLoading} onClick={onDalee}>
          Далее →
        </Button>
      </Group>
    </Stack>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

interface Step2Props {
  feed: SupplierFeed;
  files: FeedFile[];
  onDrop: (files: File[]) => void;
  onDeleteFile: (fileId: number) => void;
  onProcess: () => void;
  uploading: boolean;
  processing: boolean;
}

function Step2({ feed: _feed, files, onDrop, onDeleteFile, onProcess, uploading, processing }: Step2Props) {
  return (
    <Stack>
      <Title order={2}>Загрузка файлов</Title>

      <Dropzone
        onDrop={onDrop}
        loading={uploading}
        data-testid="feed-dropzone"
      >
        <Group justify="center" style={{ pointerEvents: 'none' }}>
          <IconUpload size={18} />
          <Text size="sm">Перетащите файлы или нажмите для выбора</Text>
        </Group>
      </Dropzone>

      {files.length > 0 && (
        <Stack gap="xs">
          {files.map((f) => (
            <Group key={f.id} justify="space-between">
              <Text size="sm">{f.filename}</Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Удалить файл ${f.filename}`}
                onClick={() => onDeleteFile(f.id)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}

      <Group justify="flex-end">
        <Button
          disabled={files.length === 0}
          loading={processing}
          onClick={onProcess}
        >
          Обработать
        </Button>
      </Group>
    </Stack>
  );
}

// ── Inline "Новая конфигурация" modal ─────────────────────────────────────────

interface NewMappingModalProps {
  opened: boolean;
  supplierId: number;
  onClose: () => void;
  onCreated: (id: number, name: string) => void;
}

function NewMappingModal({ opened, supplierId, onClose, onCreated }: NewMappingModalProps) {
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState<number | string>(0.8);

  const createMutation = useMutation({
    mutationFn: createFeedMapping,
    onSuccess: (mapping) => {
      onCreated(mapping.id, mapping.name);
      setName('');
      setThreshold(0.8);
    },
  });

  function handleSubmit() {
    createMutation.mutate({
      supplier: supplierId,
      name,
      supplier_sku_column: '',
      identity_columns: [],
      variable_columns: [],
      auto_match_threshold: Number(threshold),
    });
  }

  function handleClose() {
    setName('');
    setThreshold(0.8);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Новая конфигурация">
      <Stack>
        <TextInput
          label="Название"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <NumberInput
          label="Порог авто-матчинга"
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          value={threshold}
          onChange={(v) => setThreshold(v)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            loading={createMutation.isPending}
            disabled={!name.trim()}
            onClick={handleSubmit}
          >
            Создать
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Root wizard component ──────────────────────────────────────────────────────

export function FeedNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── wizard state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // step 1
  const [supplierId, setSupplierId] = useState<string>('');
  const [mappingId, setMappingId] = useState<string>('');

  // step 1→2 transition result
  const [feed, setFeed] = useState<SupplierFeed | null>(null);

  // step 2
  const [files, setFiles] = useState<FeedFile[]>([]);

  // inline modal
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  // ── data ───────────────────────────────────────────────────────────────────
  const { data: suppliers } = useSuppliers();
  const numericSupplierId = supplierId ? Number(supplierId) : undefined;
  const { data: mappings } = useFeedMappings(numericSupplierId);

  // ── mutations ──────────────────────────────────────────────────────────────

  const createFeedMutation = useMutation({
    mutationFn: createSupplierFeed,
    onSuccess: (newFeed) => {
      setFeed(newFeed);
      setStep(2);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File }) => uploadFeedFile(feed!.id, file),
    onSuccess: (feedFile) => setFiles((prev) => [...prev, feedFile]),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: number) => deleteFeedFile(feed!.id, fileId),
    onSuccess: (_, fileId) => setFiles((prev) => prev.filter((f) => f.id !== fileId)),
  });

  const processMutation = useMutation({
    mutationFn: () => processFeed(feed!.id),
    onSuccess: () => navigate(`/suppliers/feeds/${feed!.id}`),
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  const supplierOptions = (suppliers ?? []).map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const mappingOptions = (mappings ?? []).map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  function handleSupplierChange(v: string) {
    setSupplierId(v);
    setMappingId(''); // reset mapping when supplier changes
  }

  function handleMappingCreated(id: number, _name: string) {
    // Invalidate so the Select options refresh, then auto-select the new mapping
    qc.invalidateQueries({ queryKey: feedMappingKeys.all });
    setMappingId(String(id));
    closeModal();
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (step === 2 && feed) {
    return (
      <Step2
        feed={feed}
        files={files}
        onDrop={(acceptedFiles) => {
          acceptedFiles.forEach((file) => uploadMutation.mutate({ file }));
        }}
        onDeleteFile={(fileId) => deleteFileMutation.mutate(fileId)}
        onProcess={() => processMutation.mutate()}
        uploading={uploadMutation.isPending}
        processing={processMutation.isPending}
      />
    );
  }

  return (
    <>
      <Step1
        supplierId={supplierId}
        mappingId={mappingId}
        onSupplierChange={handleSupplierChange}
        onMappingChange={setMappingId}
        onOpenModal={openModal}
        onDalee={() =>
          createFeedMutation.mutate({
            supplier: Number(supplierId),
            mapping: Number(mappingId),
          })
        }
        daleeLoading={createFeedMutation.isPending}
        supplierOptions={supplierOptions}
        mappingOptions={mappingOptions}
      />

      <NewMappingModal
        opened={modalOpened}
        supplierId={Number(supplierId)}
        onClose={closeModal}
        onCreated={handleMappingCreated}
      />
    </>
  );
}
