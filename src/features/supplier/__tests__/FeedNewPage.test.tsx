/**
 * Issue #5 — FeedNewPage: two-step feed creation wizard
 *
 * TDD slices (vertical RED→GREEN):
 *  1. Tracer: step 1 renders supplier + mapping selects
 *  2. Selecting a supplier re-fetches mappings with ?supplier=<id>
 *  3. "Далее" button disabled until both supplier + mapping chosen
 *  4. Clicking "Далее" POSTs /api/suppliers/feeds/ and shows step 2
 *  5. "Новая конфигурация" opens modal; on save, new mapping auto-selects
 *  6. File drop in step 2 uploads to /api/suppliers/feeds/:id/upload/; filename in list
 *  7. "Обработать" disabled when file list empty; enabled after upload
 *  8. "Обработать" → POST /api/suppliers/feeds/:id/process/ → navigate to detail
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { FeedNewPage } from '../pages/FeedNewPage';

// ── fixtures ──────────────────────────────────────────────────────────────────

const SUPPLIER = { id: 1, name: 'ООО Ромашка' };

const MAPPING = {
  id: 5,
  supplier: 1,
  name: 'Основная конфигурация',
  supplier_sku_column: 'sku',
  identity_columns: ['name'],
  variable_columns: ['price'],
  auto_match_threshold: 0.8,
};

const FEED = {
  id: 42,
  supplier: 1,
  mapping: 5,
  status: 'draft',
  total_rows: 0,
  matched_rows: 0,
  unmatched_rows: 0,
  error: null,
  created_at: '2026-05-26T10:00:00Z',
  updated_at: '2026-05-26T10:00:00Z',
};

const FEED_FILE = {
  id: 1,
  filename: 'prices.xlsx',
  size: 4096,
  uploaded_at: '2026-05-26T10:01:00Z',
};

// ── helpers ───────────────────────────────────────────────────────────────────

/** Default handlers used by most tests. */
function baseHandlers() {
  return [
    http.get('/api/suppliers/suppliers/', () => HttpResponse.json([SUPPLIER])),
    http.get('/api/suppliers/mappings/', () => HttpResponse.json([MAPPING])),
    http.post('/api/suppliers/feeds/', () => HttpResponse.json(FEED, { status: 201 })),
  ];
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/feeds/new" element={<FeedNewPage />} />
      <Route
        path="/suppliers/feeds/:id"
        element={<div data-testid="detail-page">Детали</div>}
      />
    </Routes>,
    { route: '/suppliers/feeds/new' },
  );
}

/**
 * Advance the wizard past step 1 by selecting supplier + mapping + clicking Далее.
 * Requires baseHandlers (including POST /api/suppliers/feeds/) to be registered.
 */
async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  const supplierInput = await screen.findByPlaceholderText('Выбрать поставщика');
  await user.click(supplierInput);
  await user.click(await screen.findByRole('option', { name: 'ООО Ромашка' }));

  const mappingInput = await screen.findByPlaceholderText('Выбрать конфигурацию');
  await user.click(mappingInput);
  await user.click(await screen.findByRole('option', { name: 'Основная конфигурация' }));

  await user.click(screen.getByRole('button', { name: /далее/i }));

  // Wait for step 2 to appear
  await waitFor(() => {
    expect(document.querySelector('[data-testid="feed-dropzone"]')).toBeTruthy();
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FeedNewPage', () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  // ── Slice 1: tracer ──────────────────────────────────────────────────────────

  it('renders supplier and mapping selects on step 1', async () => {
    renderPage();

    expect(await screen.findByPlaceholderText('Выбрать поставщика')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Выбрать конфигурацию')).toBeInTheDocument();
  });

  // ── Slice 2: selecting supplier re-fetches mappings filtered by supplierId ──

  it('selecting a supplier re-fetches mappings with ?supplier=<id>', async () => {
    let lastMappingUrl: string | null = null;
    server.use(
      http.get('/api/suppliers/mappings/', ({ request }) => {
        lastMappingUrl = request.url;
        return HttpResponse.json([MAPPING]);
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const supplierInput = await screen.findByPlaceholderText('Выбрать поставщика');
    await user.click(supplierInput);
    await user.click(await screen.findByRole('option', { name: 'ООО Ромашка' }));

    await waitFor(() => {
      expect(lastMappingUrl).toContain('supplier=1');
    });
  });

  // ── Slice 3: "Далее" disabled until both supplier + mapping selected ─────────

  it('"Далее" is disabled until both supplier and mapping are selected', async () => {
    const user = userEvent.setup();
    renderPage();

    const daleeBtn = await screen.findByRole('button', { name: /далее/i });

    // Initially disabled — no supplier, no mapping
    expect(daleeBtn).toBeDisabled();

    // Select supplier only → still disabled
    const supplierInput = screen.getByPlaceholderText('Выбрать поставщика');
    await user.click(supplierInput);
    await user.click(await screen.findByRole('option', { name: 'ООО Ромашка' }));
    expect(daleeBtn).toBeDisabled();

    // Select mapping → button becomes enabled
    const mappingInput = screen.getByPlaceholderText('Выбрать конфигурацию');
    await user.click(mappingInput);
    await user.click(await screen.findByRole('option', { name: 'Основная конфигурация' }));

    await waitFor(() => {
      expect(daleeBtn).not.toBeDisabled();
    });
  });

  // ── Slice 4: clicking "Далее" POSTs feed + renders step 2 ───────────────────

  it('clicking "Далее" POSTs /api/suppliers/feeds/ with supplier+mapping and shows step 2', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/suppliers/feeds/', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(FEED, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);

    expect(posted).toMatchObject({ supplier: 1, mapping: 5 });
    expect(document.querySelector('[data-testid="feed-dropzone"]')).toBeTruthy();
  });

  // ── Slice 5: "Новая конфигурация" modal auto-selects on save ─────────────────

  it('"Новая конфигурация" opens modal; on save new mapping auto-selects in Select', async () => {
    const NEW_NAME = 'Новый вариант';
    let mappingsList = [MAPPING];

    server.use(
      http.get('/api/suppliers/mappings/', () => HttpResponse.json(mappingsList)),
      http.post('/api/suppliers/mappings/', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const created = { ...MAPPING, id: 99, name: String(body.name ?? '') };
        mappingsList = [...mappingsList, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Select a supplier first
    const supplierInput = await screen.findByPlaceholderText('Выбрать поставщика');
    await user.click(supplierInput);
    await user.click(await screen.findByRole('option', { name: 'ООО Ромашка' }));

    // Open "Новая конфигурация" modal
    const newConfigBtn = await screen.findByRole('button', { name: /новая конфигурация/i });
    await user.click(newConfigBtn);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Fill the name field
    const nameInput = screen.getByLabelText(/название/i);
    await user.type(nameInput, NEW_NAME);

    // Submit
    await user.click(screen.getByRole('button', { name: /создать/i }));

    // The mapping Select should now show the newly created mapping's name
    const mappingInput = screen.getByPlaceholderText('Выбрать конфигурацию');
    await waitFor(() => {
      expect(mappingInput).toHaveValue(NEW_NAME);
    });
  });

  // ── Slice 6: file drop → POST upload → filename appears ──────────────────────

  it('dropping a file POSTs to /api/suppliers/feeds/:id/upload/ and shows filename', async () => {
    server.use(
      http.post('/api/suppliers/feeds/42/upload/', () =>
        HttpResponse.json(FEED_FILE, { status: 201 }),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);

    const file = new File(['data'], 'prices.xlsx', { type: 'application/vnd.ms-excel' });
    const dropzone = document.querySelector('[data-testid="feed-dropzone"]') as HTMLElement;

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    await waitFor(() => {
      expect(screen.getByText('prices.xlsx')).toBeInTheDocument();
    });
  });

  // ── Slice 7: "Обработать" disabled ↔ enabled by file list ───────────────────

  it('"Обработать" is disabled when file list is empty and enabled after upload', async () => {
    server.use(
      http.post('/api/suppliers/feeds/42/upload/', () =>
        HttpResponse.json(FEED_FILE, { status: 201 }),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);

    // Initially disabled — no files uploaded
    expect(screen.getByRole('button', { name: /обработать/i })).toBeDisabled();

    // Drop a file
    const file = new File(['data'], 'prices.xlsx', { type: 'application/vnd.ms-excel' });
    const dropzone = document.querySelector('[data-testid="feed-dropzone"]') as HTMLElement;
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    // Button should become enabled after file appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /обработать/i })).not.toBeDisabled();
    });
  });

  // ── Slice 8: "Обработать" calls process + navigates to detail page ───────────

  it('"Обработать" POSTs /api/suppliers/feeds/:id/process/ and navigates to detail', async () => {
    server.use(
      http.post('/api/suppliers/feeds/42/upload/', () =>
        HttpResponse.json(FEED_FILE, { status: 201 }),
      ),
      http.post('/api/suppliers/feeds/42/process/', () =>
        HttpResponse.json({ ...FEED, status: 'processing' }),
      ),
    );

    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);

    // Upload a file to enable "Обработать"
    const file = new File(['data'], 'prices.xlsx', { type: 'application/vnd.ms-excel' });
    const dropzone = document.querySelector('[data-testid="feed-dropzone"]') as HTMLElement;
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    await waitFor(() => {
      expect(screen.getByText('prices.xlsx')).toBeInTheDocument();
    });

    // Click "Обработать"
    await user.click(screen.getByRole('button', { name: /обработать/i }));

    // Should navigate to the feed detail page
    await waitFor(() => {
      expect(screen.getByTestId('detail-page')).toBeInTheDocument();
    });
  });
});
