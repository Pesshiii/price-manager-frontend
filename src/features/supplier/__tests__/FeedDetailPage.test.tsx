/**
 * Issue #7 — FeedDetailPage: feed detail + MatchQueue resolution
 *
 * TDD slices (vertical RED→GREEN):
 *  1. Tracer: feed header renders with status badge + row counts
 *  2. Processing poll — spinner shown, refetchInterval active while processing
 *  3. MatchQueue renders when status is partial
 *  4. Candidate cards show supplier_sku + candidates with score
 *  5. Confirm candidate → PATCH resolve with product_id → entry removed
 *  6. Skip entry → PATCH resolve with {skipped:true} → entry removed
 *  7. Empty queue shows empty-state message
 *  8. Error state shows feed error message
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { FeedDetailPage } from '../pages/FeedDetailPage';

// ── fixtures ──────────────────────────────────────────────────────────────────

const SUPPLIER = { id: 1, name: 'ООО Ромашка' };

const FEED_PARTIAL = {
  id: 42,
  supplier: 1,
  mapping: 5,
  status: 'partial',
  total_rows: 100,
  matched_rows: 80,
  unmatched_rows: 20,
  error: null,
  created_at: '2026-05-26T10:00:00Z',
  updated_at: '2026-05-26T10:05:00Z',
};

const FEED_PROCESSING = {
  ...FEED_PARTIAL,
  status: 'processing',
  matched_rows: 0,
  unmatched_rows: 0,
};

const FEED_ERROR = {
  ...FEED_PARTIAL,
  status: 'error',
  error: 'Ошибка разбора файла: неверный формат',
};

const ENTRY_1 = {
  id: 1,
  feed: 42,
  supplier_sku: 'SUP-001',
  data: { price: 999, stock: 5 },
  match_candidates: [
    { product_id: 10, score: 0.95, name: 'Товар А' },
    { product_id: 11, score: 0.72, name: 'Товар Б' },
  ],
  product: null,
  skipped: false,
  created_at: '2026-05-26T10:00:00Z',
};

const ENTRY_2 = {
  id: 2,
  feed: 42,
  supplier_sku: 'SUP-002',
  data: { price: 1500 },
  match_candidates: [
    { product_id: 20, score: 0.61, name: 'Товар В' },
  ],
  product: null,
  skipped: false,
  created_at: '2026-05-26T10:00:01Z',
};

// ── helpers ───────────────────────────────────────────────────────────────────

function renderPage(route = '/suppliers/feeds/42') {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/feeds/:id" element={<FeedDetailPage />} />
    </Routes>,
    { route },
  );
}

// ── Slice 1: tracer — feed header ─────────────────────────────────────────────

describe('FeedDetailPage', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/suppliers/suppliers/', () => HttpResponse.json([SUPPLIER])),
      http.get('/api/suppliers/feeds/42/', () => HttpResponse.json(FEED_PARTIAL)),
      http.get('/api/suppliers/feeds/42/queue/', () => HttpResponse.json([])),
    );
  });

  it('renders the feed header with supplier name, status badge, and row counts', async () => {
    renderPage();

    // Supplier name
    expect(await screen.findByText('ООО Ромашка')).toBeInTheDocument();

    // Status badge text
    expect(screen.getByText('Частично')).toBeInTheDocument();

    // Row counts
    expect(screen.getByText(/100/)).toBeInTheDocument();  // total_rows
    expect(screen.getByText(/80/)).toBeInTheDocument();   // matched_rows
    expect(screen.getByText(/20/)).toBeInTheDocument();   // unmatched_rows
  });

  // ── Slice 2: processing → spinner visible ─────────────────────────────────

  it('shows a spinner while feed status is processing', async () => {
    server.use(
      http.get('/api/suppliers/feeds/42/', () => HttpResponse.json(FEED_PROCESSING)),
    );
    renderPage();

    await waitFor(() => {
      // Mantine Loader renders role="presentation" — fall back to aria-label or test-id
      expect(document.querySelector('[data-testid="feed-processing-loader"]')).toBeTruthy();
    });
  });

  // ── Slice 3: MatchQueue renders when partial ──────────────────────────────

  it('renders MatchQueue entries when feed status is partial', async () => {
    server.use(
      http.get('/api/suppliers/feeds/42/queue/', () =>
        HttpResponse.json([ENTRY_1, ENTRY_2]),
      ),
    );
    renderPage();

    expect(await screen.findByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText('SUP-002')).toBeInTheDocument();
  });

  // ── Slice 4: candidate cards show name + score ────────────────────────────

  it('shows candidate names and scores for each queue entry', async () => {
    server.use(
      http.get('/api/suppliers/feeds/42/queue/', () =>
        HttpResponse.json([ENTRY_1]),
      ),
    );
    renderPage();

    expect(await screen.findByText('Товар А')).toBeInTheDocument();
    expect(screen.getByText('Товар Б')).toBeInTheDocument();
    // Score formatted as percentage
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  // ── Slice 5: confirm candidate → entry disappears ────────────────────────

  it('confirming a candidate PATCHes resolve with product_id and removes the entry', async () => {
    let resolveBody: unknown;
    server.use(
      http.get('/api/suppliers/feeds/42/queue/', () => HttpResponse.json([ENTRY_1])),
      http.patch('/api/suppliers/feeds/42/queue/1/resolve/', async ({ request }) => {
        resolveBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Wait for the entry to appear, then click confirm on the first candidate
    await screen.findByText('SUP-001');
    const confirmBtn = screen.getAllByRole('button', { name: /подтвердить/i })[0];
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(resolveBody).toMatchObject({ product_id: 10 });
    });

    // Entry should be removed from the list after resolve
    await waitFor(() => {
      expect(screen.queryByText('SUP-001')).not.toBeInTheDocument();
    });
  });

  // ── Slice 6: skip entry → entry disappears ───────────────────────────────

  it('skipping an entry PATCHes resolve with skipped:true and removes the entry', async () => {
    let resolveBody: unknown;
    server.use(
      http.get('/api/suppliers/feeds/42/queue/', () => HttpResponse.json([ENTRY_1])),
      http.patch('/api/suppliers/feeds/42/queue/1/resolve/', async ({ request }) => {
        resolveBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    await user.click(screen.getByRole('button', { name: /пропустить/i }));

    await waitFor(() => {
      expect(resolveBody).toMatchObject({ skipped: true });
    });

    await waitFor(() => {
      expect(screen.queryByText('SUP-001')).not.toBeInTheDocument();
    });
  });

  // ── Slice 7: empty queue shows empty-state ───────────────────────────────

  it('shows an empty-state message when the queue is empty', async () => {
    renderPage(); // queue returns [] from beforeEach

    await waitFor(() => {
      expect(screen.getByText(/очередь пуста/i)).toBeInTheDocument();
    });
  });

  // ── Slice 8: error state ─────────────────────────────────────────────────

  it('shows the error message when feed status is error', async () => {
    server.use(
      http.get('/api/suppliers/feeds/42/', () => HttpResponse.json(FEED_ERROR)),
    );
    renderPage();

    expect(await screen.findByText(/ошибка разбора файла/i)).toBeInTheDocument();
  });
});
