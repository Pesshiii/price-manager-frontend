import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { TransformRulesPage } from '../pages/TransformRulesPage';
import type { FeedMapping } from '@/features/supplier/types';
import type { TransformRule, SnapshotField } from '../types';

const MAPPING: FeedMapping = {
  id: 2,
  supplier: 1,
  name: 'Прайс Альфа',
  dataframe: 5,
  dataframe_detail: { id: 5, name: 'df-5' },
  supplier_sku_column: 'sku',
  identity_columns: [],
  variable_columns: [],
  auto_match_threshold: 0.8,
  product_name_column: null,
  product_sku_column: null,
};

const FIELDS: SnapshotField[] = [
  { id: 10, slug: 'price', name: 'Цена', value_type: 'number', description: '' },
  { id: 11, slug: 'in_stock', name: 'Наличие', value_type: 'boolean', description: '' },
];

const RULES: TransformRule[] = [
  {
    id: 101,
    feed_mapping: 2,
    priority: 2,
    target_field: 11,
    condition: null,
    formula: { type: 'literal', value: 'true' },
  },
  {
    id: 100,
    feed_mapping: 2,
    priority: 1,
    target_field: 10,
    condition: null,
    formula: { type: 'copy', source: 'feed', key: 'price' },
  },
];

function baseHandlers() {
  return [
    http.get('/api/supplier-feed/mappings/2/', () => HttpResponse.json(MAPPING)),
    http.get('/api/transform/rules/', () => HttpResponse.json({ count: RULES.length, next: null, previous: null, results: RULES })),
    http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: FIELDS.length, next: null, previous: null, results: FIELDS })),
  ];
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/:id/mappings/:mappingId/rules" element={<TransformRulesPage />} />
    </Routes>,
    { route: '/suppliers/1/mappings/2/rules' },
  );
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('TransformRulesPage', () => {
  it('renders breadcrumb with mapping name and page title', async () => {
    server.use(...baseHandlers());
    renderPage();
    expect(await screen.findByText('Прайс Альфа')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Правила трансформации/i })).toBeInTheDocument();
  });

  it('shows rules sorted by priority in the table', async () => {
    server.use(...baseHandlers());
    renderPage();

    const rows = await screen.findAllByRole('row');
    // rows[0] = header, rows[1] = priority 1, rows[2] = priority 2
    expect(rows[1]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('price');
    expect(rows[2]).toHaveTextContent('2');
    expect(rows[2]).toHaveTextContent('in_stock');
  });

  it('opens create modal with empty fields and POSTs on submit', async () => {
    let postedBody: unknown;
    server.use(
      ...baseHandlers(),
      http.post('/api/transform/rules/', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({ id: 200, ...(postedBody as object) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Прайс Альфа');

    await user.click(screen.getByRole('button', { name: /Создать правило/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Mantine Select renders as role="textbox"
    const fieldSelect = screen.getByRole('textbox', { name: /целевое поле/i });
    await user.click(fieldSelect);
    await user.click(await screen.findByRole('option', { name: 'price' }));

    await user.click(screen.getByRole('button', { name: /^Создать$/i }));

    await waitFor(() =>
      expect(postedBody).toMatchObject({
        feed_mapping: 2,
        target_field: 10,
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('opens edit modal pre-filled and PATCHes on submit', async () => {
    let patchedBody: unknown;
    server.use(
      ...baseHandlers(),
      http.patch('/api/transform/rules/100/', async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({ ...RULES[1], priority: 5 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Прайс Альфа');

    const editButtons = await screen.findAllByLabelText(/Редактировать/i);
    // Click the first rule's edit button (priority 1 = rule id 100 = rows[1])
    await user.click(editButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Priority should be pre-filled — Mantine NumberInput renders as textbox
    const priorityInput = screen.getByRole('textbox', { name: /приоритет/i }) as HTMLInputElement;
    expect(priorityInput.value).toBe('1');

    await user.click(screen.getByRole('button', { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(patchedBody).toMatchObject({
        feed_mapping: 2,
        target_field: 10,
        priority: 1,
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('sends DELETE after window.confirm and invalidates rules', async () => {
    let deleted = false;
    server.use(
      ...baseHandlers(),
      http.delete('/api/transform/rules/100/', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Прайс Альфа');

    const deleteButtons = await screen.findAllByLabelText(/Удалить/i);
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(deleted).toBe(true));
  });

  it('target_field Select is populated from snapshot fields', async () => {
    server.use(...baseHandlers());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Прайс Альфа');

    await user.click(screen.getByRole('button', { name: /Создать правило/i }));
    await screen.findByRole('dialog');

    // Open the target_field Select dropdown
    const fieldSelect = screen.getByRole('textbox', { name: /целевое поле/i });
    await user.click(fieldSelect);

    expect(await screen.findByRole('option', { name: 'price' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'in_stock' })).toBeInTheDocument();
  });

  it('modal contains "Создать поле →" link that opens a new tab', async () => {
    server.use(...baseHandlers());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Прайс Альфа');

    await user.click(screen.getByRole('button', { name: /Создать правило/i }));
    await screen.findByRole('dialog');

    const link = screen.getByRole('link', { name: /Создать поле/i });
    expect(link).toHaveAttribute('target', '_blank');
  });
});
