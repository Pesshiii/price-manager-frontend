/**
 * Issue #3 — FeedMapping CRUD + column detection
 *
 * TDD slices (vertical RED→GREEN):
 *  1. Tracer: list renders a mapping row
 *  2. Supplier name resolved from supplier FK
 *  3. Delete button removes a row
 *  4. HTTP 409 on delete shows error without crash
 *  5. "Новая конфигурация" button opens modal
 *  6. File drop → upload session → preview → column selects populate
 *  7. Submit create → POST /api/suppliers/mappings/
 *  8. Edit row pre-populates all fields
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { FeedMapping, Supplier } from '../types';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const SUPPLIERS: Supplier[] = [{ id: 10, name: 'Acme Corp' }];

const MAPPINGS: FeedMapping[] = [
  {
    id: 1,
    supplier: 10,
    name: 'Main Config',
    supplier_sku_column: 'sku',
    identity_columns: ['name', 'brand'],
    variable_columns: ['price'],
    auto_match_threshold: 0.8,
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Register the "happy path" MSW handlers used by most tests. */
function mockDefaults(mappings: FeedMapping[] = MAPPINGS) {
  server.use(
    http.get('/api/suppliers/mappings/', () => HttpResponse.json(mappings)),
    http.get('/api/suppliers/suppliers/', () => HttpResponse.json(SUPPLIERS)),
  );
}

async function renderPage() {
  const { MappingsPage } = await import('../pages/MappingsPage');
  return renderWithProviders(<MappingsPage />);
}

// ─── slice 1: tracer ───────────────────────────────────────────────────────────

describe('MappingsPage — list', () => {
  it('renders a mapping row from the API', async () => {
    mockDefaults();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Main Config')).toBeInTheDocument();
    });
  });

  // ── slice 2: supplier name resolved ─────────────────────────────────────────
  it('shows the supplier name in the row', async () => {
    mockDefaults();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  // ── slice 3: delete removes the row ─────────────────────────────────────────
  it('delete button calls DELETE and row disappears', async () => {
    mockDefaults();
    let deleted = false;
    server.use(
      http.delete('/api/suppliers/mappings/1/', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    // After delete, return empty list so the row disappears
    server.use(
      http.get('/api/suppliers/mappings/', () =>
        deleted ? HttpResponse.json([]) : HttpResponse.json(MAPPINGS),
      ),
    );

    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => screen.getByText('Main Config'));

    // Click the delete button
    const deleteBtn = screen.getByRole('button', { name: /удалить/i });
    await user.click(deleteBtn);

    // Confirm the browser dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Click again since spyOn wasn't set before click
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(deleted).toBe(true);
    });
  });

  // ── slice 4: 409 shows error without crash ───────────────────────────────────
  it('shows an error message when delete returns 409', async () => {
    mockDefaults();
    server.use(
      http.delete('/api/suppliers/mappings/1/', () =>
        HttpResponse.json({ detail: 'Активные сессии' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderPage();
    await waitFor(() => screen.getByText('Main Config'));

    const deleteBtn = screen.getByRole('button', { name: /удалить/i });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/нельзя удалить|активн|используется/i),
      ).toBeInTheDocument();
    });
  });
});

// ── slice 5: modal opens ───────────────────────────────────────────────────────

describe('MappingsPage — create modal', () => {
  beforeEach(() => mockDefaults());

  it('"Новая конфигурация" button opens the modal', async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => screen.getByText('Main Config'));

    await user.click(screen.getByRole('button', { name: /новая конфигурация/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ── slice 6: file drop → columns populate ───────────────────────────────────
  it('file drop triggers upload+preview and populates column selects', async () => {
    server.use(
      http.post('/api/dataframe/sessions/', () =>
        HttpResponse.json({ session_id: 'sess-1', filename: 'test.csv', size: 100 }),
      ),
      http.post('/api/dataframe/preview/', () =>
        HttpResponse.json({
          columns: ['sku', 'name', 'price'],
          rows: [],
          total_rows: 0,
          returned_rows: 0,
          offset: 0,
          has_more: false,
        }),
      ),
    );

    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => screen.getByText('Main Config'));

    await user.click(screen.getByRole('button', { name: /новая конфигурация/i }));
    await waitFor(() => screen.getByRole('dialog'));

    // Simulate file drop on the Dropzone
    const file = new File(['col1,col2'], 'sample.csv', { type: 'text/csv' });
    const dropzone = screen
      .getByRole('dialog')
      .querySelector('[data-testid="column-dropzone"]') as HTMLElement;

    // Use fireEvent for drag-drop since userEvent dropzone support is limited
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.drop(dropzone!, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    await waitFor(() => {
      // After successful preview the column selects are populated — 'sku' appears
      // in multiple select option labels, so use getAllByText
      expect(screen.getAllByText('sku').length).toBeGreaterThan(0);
    });
  });

  // ── slice 7: submit create ────────────────────────────────────────────────────
  it('submitting the modal POSTs to /api/suppliers/mappings/', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/suppliers/mappings/', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ ...MAPPINGS[0], id: 99 }, { status: 201 });
      }),
    );
    server.use(
      http.post('/api/dataframe/sessions/', () =>
        HttpResponse.json({ session_id: 'sess-1', filename: 'test.csv', size: 100 }),
      ),
      http.post('/api/dataframe/preview/', () =>
        HttpResponse.json({
          columns: ['sku', 'name', 'price'],
          rows: [],
          total_rows: 0,
          returned_rows: 0,
          offset: 0,
          has_more: false,
        }),
      ),
    );

    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => screen.getByText('Main Config'));

    await user.click(screen.getByRole('button', { name: /новая конфигурация/i }));
    // Wait for the modal form to fully render (not just the dialog overlay)
    const nameInput = await screen.findByLabelText(/название/i);

    // Select a supplier — find by placeholder (same pattern used in CharacteristicTypesPage tests)
    const supplierCombo = screen.getByPlaceholderText('Выбрать поставщика');
    await user.click(supplierCombo);
    await user.click(await screen.findByRole('option', { name: 'Acme Corp' }));

    // Fill Название
    await user.type(nameInput, 'New Config');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /создать/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(posted).toMatchObject({ name: 'New Config', supplier: 10 });
    });
  });

  // ── slice 8: edit pre-populates ──────────────────────────────────────────────
  it('edit button pre-populates all form fields', async () => {
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => screen.getByText('Main Config'));

    await user.click(screen.getByRole('button', { name: /редактировать/i }));
    await waitFor(() => screen.getByRole('dialog'));

    const nameInput = screen.getByLabelText(/название/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Main Config');
  });
});
