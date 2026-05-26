/**
 * Issue #4 — FeedsPage: feed list with filters + delete
 * TDD: vertical RED→GREEN slices, one behaviour at a time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { FeedsPage } from '../pages/FeedsPage';

// ── fixtures ──────────────────────────────────────────────────────────────────

const SUPPLIER = { id: 1, name: 'ООО Ромашка' };

const FEED_DRAFT = {
  id: 42,
  supplier: 1,
  mapping: null,
  status: 'draft',
  total_rows: 0,
  matched_rows: 0,
  unmatched_rows: 0,
  error: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const FEED_PROCESSING = {
  ...FEED_DRAFT,
  id: 99,
  status: 'processing',
};

function baseHandlers(feeds = [FEED_DRAFT]) {
  return [
    http.get('/api/suppliers/feeds/', () => HttpResponse.json(feeds)),
    http.get('/api/suppliers/suppliers/', () => HttpResponse.json([SUPPLIER])),
  ];
}

function renderPage(route = '/suppliers/feeds') {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/feeds" element={<FeedsPage />} />
      <Route path="/suppliers/feeds/new" element={<div>Новая выгрузка</div>} />
      <Route path="/suppliers/feeds/:id" element={<div data-testid="detail-page">Детали</div>} />
    </Routes>,
    { route },
  );
}

// ── Slice 1: tracer — rows render ─────────────────────────────────────────────

describe('FeedsPage', () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  it('renders feed rows from the API', async () => {
    renderPage();

    // Mantine Select also renders option labels as hidden spans,
    // so we assert specifically on the table cell.
    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'ООО Ромашка' })).toBeInTheDocument();
    });
  });

  // ── Slice 2: status badge ─────────────────────────────────────────────────

  it('shows Russian status label in badge for each status', async () => {
    server.use(
      http.get('/api/suppliers/feeds/', () =>
        HttpResponse.json([
          { ...FEED_DRAFT, status: 'processing' },
          { ...FEED_DRAFT, id: 43, status: 'error' },
        ]),
      ),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Обработка')).toBeInTheDocument();
      expect(screen.getByText('Ошибка')).toBeInTheDocument();
    });
  });

  // ── Slice 3: row click navigates ──────────────────────────────────────────

  it('clicking a row navigates to /suppliers/feeds/:id', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for the row to appear then click it
    const cell = await screen.findByRole('cell', { name: 'ООО Ромашка' });
    await user.click(cell);

    // The detail-page stub should be visible
    await waitFor(() => {
      expect(screen.getByTestId('detail-page')).toBeInTheDocument();
    });
  });

  // ── Slice 4: create button leads to /suppliers/feeds/new ─────────────────

  it('"Создать выгрузку" link leads to /suppliers/feeds/new', async () => {
    const user = userEvent.setup();
    renderPage();

    const link = await screen.findByRole('link', { name: /создать выгрузку/i });
    await user.click(link);

    await waitFor(() => {
      expect(screen.getByText('Новая выгрузка')).toBeInTheDocument();
    });
  });

  // ── Slice 5: supplier filter writes ?supplier= to URL ────────────────────

  it('selecting a supplier sets ?supplier= in the URL', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for the supplier select to be populated (Mantine Select renders
    // the input with placeholder text when no value is selected)
    const supplierInput = await screen.findByPlaceholderText('Все поставщики');

    await user.click(supplierInput);
    const option = await screen.findByRole('option', { name: 'ООО Ромашка' });
    await user.click(option);

    // The Select input should now show the selected supplier name
    await waitFor(() => {
      expect(supplierInput).toHaveValue('ООО Ромашка');
    });

    // The table row should still be visible (API was re-queried with supplier=1)
    expect(screen.getByRole('cell', { name: 'ООО Ромашка' })).toBeInTheDocument();
  });

  // ── Slice 6: status filter writes ?status= to URL ────────────────────────

  it('selecting a status sets the status Select value', async () => {
    const user = userEvent.setup();
    renderPage();

    const statusInput = await screen.findByPlaceholderText('Любой статус');

    await user.click(statusInput);
    const option = await screen.findByRole('option', { name: 'Черновик' });
    await user.click(option);

    await waitFor(() => {
      expect(statusInput).toHaveValue('Черновик');
    });
  });

  // ── Slice 7 & 8 shared: delete behaviour ─────────────────────────────────

  it('delete button is visible for draft feeds and hidden for non-draft', async () => {
    server.use(
      http.get('/api/suppliers/feeds/', () =>
        HttpResponse.json([FEED_DRAFT, FEED_PROCESSING]),
      ),
    );
    renderPage();

    // Both rows appear
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(2); // header + 2 data rows
    });

    const deleteButtons = screen.queryAllByRole('button', { name: /удалить/i });
    // Only draft feeds get a delete button
    expect(deleteButtons).toHaveLength(1);
  });

  it('confirming delete calls DELETE /feeds/:id/ and removes the row', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    let deleteCalled = false;
    server.use(
      http.delete('/api/suppliers/feeds/42/', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      // After delete, refetch returns empty list
      http.get('/api/suppliers/feeds/', () =>
        deleteCalled ? HttpResponse.json([]) : HttpResponse.json([FEED_DRAFT]),
      ),
    );

    renderPage();

    // Wait for delete button then click
    const deleteBtn = await screen.findByRole('button', { name: /удалить/i });
    await user.click(deleteBtn);

    expect(deleteCalled).toBe(true);

    // Row should disappear after invalidation + refetch
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'ООО Ромашка' })).not.toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});
