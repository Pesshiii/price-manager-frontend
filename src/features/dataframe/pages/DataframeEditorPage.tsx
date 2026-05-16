import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Grid, Loader, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createPipeline,
  deleteSession,
  getPipeline,
  updatePipeline,
} from '../api';
import { ReaderConfig } from '../components/ReaderConfig';
import { SourcePicker } from '../components/SourcePicker';
import { StepList } from '../components/StepList';
import { PreviewPanel } from '../components/PreviewPanel';
import { UndoRedoToolbar } from '../components/UndoRedoToolbar';
import { useDataframeRegistry } from '../hooks/useDataframeRegistry';
import { usePipelinePreview } from '../hooks/usePipelinePreview';
import { useUndoableState } from '../hooks/useUndoableState';
import { dataframeKeys } from '../queryKeys';
import type {
  DataframePayload,
  Instructions,
  PreviewError,
  PreviewResult,
  TransformSpec,
} from '../types';
import { emptyInstructions, isPreviewError } from '../types';

interface UploadedFile {
  name: string;
  size: number;
}

function newStep(spec: TransformSpec) {
  const args: Record<string, unknown> = {};
  for (const a of spec.args) {
    if (a.default !== null && a.default !== undefined) args[a.name] = a.default;
  }
  return { func: spec.name, args };
}

function detectReader(filename: string, readers: { name: string; extensions: string[] }[]) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return readers.find((r) => r.extensions.includes(ext))?.name ?? '';
}

export function DataframeEditorPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const registry = useDataframeRegistry();
  const pipelineQuery = useQuery<DataframePayload>({
    queryKey: id != null ? dataframeKeys.pipeline(id) : ['noop'],
    queryFn: () => getPipeline(id as number),
    enabled: id != null,
  });

  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const undoable = useUndoableState<Instructions>(emptyInstructions());
  const [savedSnapshot, setSavedSnapshot] = useState<Instructions>(emptyInstructions());
  const [sessionId, setSessionId] = useState<string | null>(searchParams.get('session'));
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  useEffect(() => {
    if (pipelineQuery.data) {
      const data = pipelineQuery.data;
      setName(data.name);
      setSavedName(data.name);
      undoable.reset(data.instructions);
      setSavedSnapshot(data.instructions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineQuery.data]);

  const instructions = undoable.value;
  const upTo = selectedStep === null ? instructions.transforms.length : selectedStep + 1;

  const preview = usePipelinePreview({
    instructions,
    sessionId,
    upTo,
  });

  // sync sessionId -> URL
  useEffect(() => {
    if (sessionId && searchParams.get('session') !== sessionId) {
      const next = new URLSearchParams(searchParams);
      next.set('session', sessionId);
      setSearchParams(next, { replace: true });
    }
    if (!sessionId && searchParams.has('session')) {
      const next = new URLSearchParams(searchParams);
      next.delete('session');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // cleanup session on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        deleteSession(sessionId).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSourceUploaded = useCallback(
    (sid: string, file: UploadedFile) => {
      setSessionId(sid);
      setUploadedFile(file);
      // Auto-pick reader if not set yet
      if (!instructions.reader.func && registry.data) {
        const auto = detectReader(file.name, registry.data.readers);
        if (auto) {
          undoable.set((prev) => ({
            ...prev,
            reader: { func: auto, args: {} },
          }));
        }
      }
    },
    [instructions.reader.func, registry.data, undoable],
  );

  const handleSourceReset = useCallback(() => {
    if (sessionId) {
      deleteSession(sessionId).catch(() => undefined);
    }
    setSessionId(null);
    setUploadedFile(null);
    setSelectedStep(null);
  }, [sessionId]);

  const commitSnapshot = useCallback(() => {
    // Replace re-pushes current value as a new snapshot so undo can step back.
    undoable.set(instructions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructions, undoable]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (id == null) {
        return createPipeline({ name, description: '', instructions });
      }
      return updatePipeline(id, { name, description: '', instructions });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: dataframeKeys.pipelines() });
      qc.setQueryData(dataframeKeys.pipeline(data.id), data);
      setSavedSnapshot(data.instructions);
      setSavedName(data.name);
      notifications.show({
        message: id == null ? 'Пайплайн создан' : 'Пайплайн сохранён',
        color: 'green',
      });
      if (id == null) {
        const search = sessionId ? `?session=${sessionId}` : '';
        navigate(`/dataframe/${data.id}${search}`, { replace: true });
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: unknown } })?.response?.data ?? e;
      notifications.show({
        message: typeof msg === 'string' ? msg : JSON.stringify(msg),
        color: 'red',
      });
    },
  });

  const dirty =
    JSON.stringify(instructions) !== JSON.stringify(savedSnapshot) || name !== savedName;
  const canSave = name.trim().length > 0 && !!instructions.reader.func;

  // Step error highlight from preview result
  const previewResult: PreviewResult | undefined = preview.data;
  const errorStepIndex =
    previewResult && isPreviewError(previewResult)
      ? indexFromError(previewResult, instructions.transforms.length)
      : null;

  const stepLabel = useMemo(() => {
    if (selectedStep === null) {
      const n = instructions.transforms.length;
      if (n === 0) return 'reader';
      return `все шаги (${n})`;
    }
    const step = instructions.transforms[selectedStep];
    const spec = registry.data?.transforms.find((t) => t.name === step?.func);
    return spec?.label ?? step?.func ?? 'reader';
  }, [selectedStep, instructions.transforms, registry.data]);

  if (registry.isLoading || (id != null && pipelineQuery.isLoading)) {
    return <Loader />;
  }

  if (registry.isError) {
    return <Alert color="red">Не удалось загрузить registry</Alert>;
  }

  return (
    <Stack gap="md">
      <UndoRedoToolbar
        name={name}
        onChangeName={setName}
        onCommitName={() => undoable.set(instructions)}
        onUndo={undoable.undo}
        onRedo={undoable.redo}
        canUndo={undoable.canUndo}
        canRedo={undoable.canRedo}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
        canSave={canSave}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <SourcePicker
              sessionId={sessionId}
              uploadedFile={uploadedFile}
              onUploaded={handleSourceUploaded}
              onReset={handleSourceReset}
            />
            <ReaderConfig
              readers={registry.data!.readers}
              reader={instructions.reader}
              selected={selectedStep === null && instructions.transforms.length === 0}
              onSelect={() => setSelectedStep(null)}
              onChangeFunc={(func) =>
                undoable.set({ ...instructions, reader: { func, args: {} } })
              }
              onChangeArgs={(args) =>
                undoable.replace({ ...instructions, reader: { ...instructions.reader, args } })
              }
              onCommit={commitSnapshot}
            />
            <StepList
              steps={instructions.transforms}
              transforms={registry.data!.transforms}
              selectedIndex={selectedStep}
              errorIndex={errorStepIndex}
              instructions={instructions}
              sessionId={sessionId}
              onSelect={setSelectedStep}
              onAdd={(spec) =>
                undoable.set({
                  ...instructions,
                  transforms: [...instructions.transforms, newStep(spec)],
                })
              }
              onRemove={(idx) => {
                undoable.set({
                  ...instructions,
                  transforms: instructions.transforms.filter((_, i) => i !== idx),
                });
                if (selectedStep === idx) setSelectedStep(null);
              }}
              onReorder={(next) =>
                undoable.set({ ...instructions, transforms: next })
              }
              onChangeArgs={(idx, args) =>
                undoable.replace({
                  ...instructions,
                  transforms: instructions.transforms.map((s, i) =>
                    i === idx ? { ...s, args } : s,
                  ),
                })
              }
              onCommit={commitSnapshot}
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <PreviewPanel
            result={preview.data}
            isLoading={preview.isLoading}
            isFetching={preview.isFetching}
            isError={preview.isError}
            errorMessage={
              (preview.error as { response?: { status?: number } })?.response?.status === 404
                ? 'Сессия истекла. Загрузите файл заново.'
                : preview.error instanceof Error
                ? preview.error.message
                : undefined
            }
            hasSession={!!sessionId}
            stepLabel={stepLabel}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function indexFromError(result: PreviewError, totalSteps: number): number | null {
  const idx = result.error.step_index;
  if (idx === null || idx === undefined) return null;
  // up_to=k means "first k steps applied", so error is at step k-1
  return idx > 0 && idx <= totalSteps ? idx - 1 : null;
}
