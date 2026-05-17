import {
  Alert,
  Button,
  Card,
  FileButton,
  Group,
  Loader,
  Modal,
  Radio,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPipeline,
  deleteSession,
  listPipelines,
  previewPipeline,
  uploadSession,
} from '@/features/dataframe/api';
import { DataframeBuilder } from '@/features/dataframe/components/DataframeBuilder';
import { useDataframeRegistry } from '@/features/dataframe/hooks/useDataframeRegistry';
import { dataframeKeys } from '@/features/dataframe/queryKeys';
import {
  emptyInstructions,
  isPreviewError,
  type DataframePayload,
  type Instructions,
  type PreviewSuccess,
} from '@/features/dataframe/types';
import { ImportMappingStep } from '../components/import/ImportMappingStep';
import { ImportPreviewResults } from '../components/import/ImportPreviewResults';
import { useCategories } from '../hooks/useCategories';
import { useCharacteristicTypes } from '../hooks/useCharacteristicTypes';
import { useImportCommit, useImportPreview } from '../hooks/useImportMutations';
import { useImportPersistence } from '../hooks/useImportPersistence';
import { useImportSessionRestore } from '../hooks/useImportSessionRestore';
import {
  clearPersistedState,
  defaultPersistedState,
  loadPersistedState,
  type SourceMode,
} from '../persistence';
import type {
  ImportCommitResult,
  ImportMapping,
  ImportPreviewResult,
} from '../types';

export function ImportPage() {
  const qc = useQueryClient();
  const initial = useMemo(() => loadPersistedState() ?? defaultPersistedState(), []);

  const [step, setStep] = useState<number>(initial.step);
  const [mode, setMode] = useState<SourceMode>(initial.mode);

  // Saved-mode state
  const [sessionId, setSessionId] = useState<string | null>(initial.sessionId);
  const [filename, setFilename] = useState<string | null>(initial.filename);
  const [pipelineId, setPipelineId] = useState<number | null>(initial.pipelineId);
  const [savedInstructions, setSavedInstructions] = useState<Instructions | null>(null);

  // Ad-hoc-mode state
  const [adhocInstructions, setAdhocInstructions] = useState<Instructions>(initial.adhocInstructions);
  const [adhocSessionId, setAdhocSessionId] = useState<string | null>(initial.adhocSessionId);
  const [adhocUploadedFile, setAdhocUploadedFile] = useState(initial.adhocUploadedFile);
  const [adhocSelectedStep, setAdhocSelectedStep] = useState<number | null>(null);

  // Shared step-2/3 state
  const [columns, setColumns] = useState<string[]>(initial.columns);
  const [category, setCategory] = useState<number | undefined>(initial.category ?? undefined);
  const [mapping, setMapping] = useState<ImportMapping>(initial.mapping);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(
    initial.previewResult,
  );
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(
    initial.commitResult,
  );

  const [saveModalOpened, { open: openSave, close: closeSave }] = useDisclosure(false);
  const [saveName, setSaveName] = useState('');

  const registry = useDataframeRegistry();
  const { data: pipelines } = useQuery({
    queryKey: dataframeKeys.pipelines(),
    queryFn: listPipelines,
  });
  const { data: categories } = useCategories();
  const { data: charTypes } = useCharacteristicTypes(
    category !== undefined ? { category } : {},
  );

  // Resolve current session+instructions depending on mode
  const currentSessionId = mode === 'saved' ? sessionId : adhocSessionId;
  const currentInstructions = mode === 'saved' ? savedInstructions : adhocInstructions;

  // Re-resolve savedInstructions when pipelines load after hydration.
  useEffect(() => {
    if (mode !== 'saved' || pipelineId == null || savedInstructions || !pipelines) return;
    const found = pipelines.find((p: DataframePayload) => p.id === pipelineId);
    if (found) setSavedInstructions(found.instructions);
  }, [pipelines, pipelineId, mode, savedInstructions]);

  const resetDownstream = useCallback(() => {
    setStep(0);
    setMapping({});
    setColumns([]);
    setPreviewResult(null);
    setCommitResult(null);
  }, []);

  useImportSessionRestore({
    sessionId,
    adhocSessionId,
    setSessionId,
    setFilename,
    setAdhocSessionId,
    setAdhocUploadedFile,
    onAnyInvalidated: resetDownstream,
  });

  useImportPersistence({
    version: 1,
    mode,
    step: (step === 1 || step === 2 ? step : 0) as 0 | 1 | 2,
    sessionId,
    filename,
    pipelineId,
    adhocSessionId,
    adhocUploadedFile,
    adhocInstructions,
    columns,
    category: category ?? null,
    mapping,
    previewResult,
    commitResult,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSession(file),
    onSuccess: (data) => {
      setSessionId(data.session_id);
      setFilename(data.filename);
    },
  });

  // For saved mode — explicitly run pipeline preview to fetch column list
  const savedPreviewMutation = useMutation({
    mutationFn: (args: { sessionId: string; instructions: Instructions }) =>
      previewPipeline({
        instructions: args.instructions,
        sessionId: args.sessionId,
        rowLimit: 50,
      }),
    onSuccess: (result) => {
      if (isPreviewError(result)) {
        notifications.show({ message: result.error.message, color: 'red' });
        return;
      }
      const success = result as PreviewSuccess;
      setColumns(success.columns);
      setStep(1);
    },
  });

  const previewMutation = useImportPreview();
  const commitMutation = useImportCommit();

  const savePipelineMutation = useMutation({
    mutationFn: () =>
      createPipeline({
        name: saveName.trim(),
        description: '',
        instructions: adhocInstructions,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: dataframeKeys.pipelines() });
      qc.setQueryData(dataframeKeys.pipeline(data.id), data);
      notifications.show({ message: `Пайплайн «${data.name}» создан`, color: 'green' });
      closeSave();
      setSaveName('');
      // Switch to saved-mode binding the freshly created pipeline + current session
      setMode('saved');
      setPipelineId(data.id);
      setSavedInstructions(data.instructions);
      setSessionId(adhocSessionId);
      setFilename(adhocUploadedFile?.name ?? null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: unknown } })?.response?.data ?? e;
      notifications.show({
        message: typeof msg === 'string' ? msg : JSON.stringify(msg),
        color: 'red',
      });
    },
  });

  const handlePipelineSelect = (id: string | null) => {
    if (!id || !pipelines) {
      setPipelineId(null);
      setSavedInstructions(null);
      return;
    }
    const num = Number(id);
    const found = pipelines.find((p: DataframePayload) => p.id === num);
    setPipelineId(num);
    setSavedInstructions(found?.instructions ?? null);
  };

  const forkToAdhoc = () => {
    if (!savedInstructions) return;
    setAdhocInstructions(savedInstructions);
    setAdhocSessionId(sessionId);
    setAdhocUploadedFile(filename ? { name: filename, size: 0 } : null);
    setMode('adhoc');
  };

  const goToMapping = () => {
    if (mode === 'saved') {
      if (!sessionId || !savedInstructions) return;
      savedPreviewMutation.mutate({ sessionId, instructions: savedInstructions });
    } else {
      // In ad-hoc mode we rely on the builder's live preview to have populated `columns`
      if (columns.length === 0) {
        notifications.show({
          message: 'Дождитесь успешного превью с колонками',
          color: 'orange',
        });
        return;
      }
      setStep(1);
    }
  };

  const runImportPreview = () => {
    if (!currentSessionId || !currentInstructions) return;
    previewMutation.mutate(
      {
        session_id: currentSessionId,
        instructions: currentInstructions,
        mapping,
        row_limit: 100,
      },
      {
        onSuccess: (result) => {
          setPreviewResult(result);
          setStep(2);
        },
      },
    );
  };

  const runImportCommit = () => {
    if (!currentSessionId || !currentInstructions) return;
    commitMutation.mutate(
      { session_id: currentSessionId, instructions: currentInstructions, mapping },
      {
        onSuccess: (result) => {
          setCommitResult(result);
          notifications.show({
            message: `Создано: ${result.created}, обновлено: ${result.updated}`,
            color: 'green',
          });
        },
      },
    );
  };

  const cleanupSession = async () => {
    const sessionsToDelete = new Set<string>();
    if (sessionId) sessionsToDelete.add(sessionId);
    if (adhocSessionId) sessionsToDelete.add(adhocSessionId);
    await Promise.all(
      [...sessionsToDelete].map((sid) => deleteSession(sid).catch(() => undefined)),
    );
    setSessionId(null);
    setFilename(null);
    setAdhocSessionId(null);
    setAdhocUploadedFile(null);
    setAdhocInstructions(emptyInstructions());
    setColumns([]);
    setMapping({});
    setPreviewResult(null);
    setCommitResult(null);
    setStep(0);
    setPipelineId(null);
    setSavedInstructions(null);
    setCategory(undefined);
    clearPersistedState();
  };

  const canProceedToMapping =
    mode === 'saved'
      ? !!sessionId && !!savedInstructions
      : !!adhocSessionId && columns.length > 0;

  return (
    <Stack>
      <Title order={2}>Импорт товаров</Title>

      <Stepper active={step} onStepClick={setStep}>
        <Stepper.Step label="Источник" description="Файл и пайплайн">
          <Stack mt="md">
            <Radio.Group
              value={mode}
              onChange={(v) => setMode(v as SourceMode)}
              label="Режим"
            >
              <Group mt="xs">
                <Radio value="saved" label="Сохранённый пайплайн" />
                <Radio value="adhoc" label="Ad-hoc" />
              </Group>
            </Radio.Group>

            {mode === 'saved' && (
              <Card withBorder padding="md">
                <Stack>
                  <Group>
                    <FileButton
                      onChange={(f) => f && uploadMutation.mutate(f)}
                      accept="*"
                    >
                      {(props) => (
                        <Button
                          {...props}
                          leftSection={<IconUpload size={16} />}
                          loading={uploadMutation.isPending}
                        >
                          Загрузить файл
                        </Button>
                      )}
                    </FileButton>
                    {filename && <Text c="dimmed">{filename}</Text>}
                  </Group>
                  <Select
                    label="Пайплайн"
                    placeholder="Выберите сохранённый пайплайн"
                    data={(pipelines ?? []).map((p) => ({
                      value: String(p.id),
                      label: p.name,
                    }))}
                    value={pipelineId !== null ? String(pipelineId) : null}
                    onChange={handlePipelineSelect}
                    searchable
                  />
                  <Group>
                    <Button
                      variant="default"
                      onClick={forkToAdhoc}
                      disabled={!savedInstructions}
                    >
                      Форкнуть в ad-hoc
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}

            {mode === 'adhoc' && (
              <Card withBorder padding="md">
                <Stack>
                  {registry.isLoading && <Loader />}
                  {registry.data && (
                    <DataframeBuilder
                      registry={registry.data}
                      instructions={adhocInstructions}
                      setInstructions={setAdhocInstructions}
                      sessionId={adhocSessionId}
                      setSessionId={setAdhocSessionId}
                      uploadedFile={adhocUploadedFile}
                      setUploadedFile={setAdhocUploadedFile}
                      selectedStep={adhocSelectedStep}
                      setSelectedStep={setAdhocSelectedStep}
                      onPreviewSuccess={(p) => setColumns(p.columns)}
                    />
                  )}
                  <Group justify="flex-end">
                    <Button
                      variant="default"
                      onClick={openSave}
                      disabled={!adhocInstructions.reader.func}
                    >
                      Сохранить как pipeline…
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}

            <Card withBorder padding="md">
              <Select
                label="Категория для импорта"
                placeholder="Опционально"
                data={(categories ?? []).map((c) => ({
                  value: String(c.id),
                  label: '— '.repeat(c.level) + c.name,
                }))}
                value={category !== undefined ? String(category) : null}
                onChange={(v) => setCategory(v ? Number(v) : undefined)}
                description="Подгрузит характеристики выбранной категории для маппинга"
                clearable
                searchable
              />
            </Card>

            <Group justify="flex-end">
              <Button
                onClick={goToMapping}
                disabled={!canProceedToMapping}
                loading={savedPreviewMutation.isPending}
              >
                Далее
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Маппинг" description="Поля → колонки">
          <Stack mt="md">
            {!charTypes && category !== undefined ? (
              <Loader />
            ) : (
              <ImportMappingStep
                columns={columns}
                characteristicTypes={charTypes ?? []}
                mapping={mapping}
                onChange={setMapping}
              />
            )}
            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep(0)}>
                Назад
              </Button>
              <Button onClick={runImportPreview} loading={previewMutation.isPending}>
                Проверить
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Импорт" description="Проверка и сохранение">
          <Stack mt="md">
            {previewResult && <ImportPreviewResults result={previewResult} />}
            {commitResult && (
              <Alert color="green" title="Импорт выполнен">
                Создано: {commitResult.created}, обновлено: {commitResult.updated},
                пропущено: {commitResult.skipped}
              </Alert>
            )}
            <Group justify="space-between">
              <Button variant="default" onClick={() => setStep(1)}>
                Назад
              </Button>
              <Group>
                <Button variant="subtle" onClick={cleanupSession}>
                  Сбросить
                </Button>
                <Button
                  onClick={runImportCommit}
                  loading={commitMutation.isPending}
                  disabled={!previewResult || previewResult.valid === 0}
                >
                  Импортировать
                </Button>
              </Group>
            </Group>
          </Stack>
        </Stepper.Step>
      </Stepper>

      <Modal
        opened={saveModalOpened}
        onClose={closeSave}
        title="Сохранить ad-hoc как pipeline"
      >
        <Stack>
          <TextInput
            label="Имя пайплайна"
            value={saveName}
            onChange={(e) => setSaveName(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeSave}>
              Отмена
            </Button>
            <Button
              loading={savePipelineMutation.isPending}
              disabled={!saveName.trim() || !adhocInstructions.reader.func}
              onClick={() => savePipelineMutation.mutate()}
            >
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
