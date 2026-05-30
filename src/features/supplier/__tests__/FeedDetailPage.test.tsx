/**
 * Issue #7 — FeedDetailPage: feed detail + MatchQueue resolution
 * Issue #11 — quick fixes: queueEnabled, back link, status notifications
 *
 * TDD slices (vertical RED→GREEN):
 *  1. Tracer: feed header renders with status badge + row counts
 *  2. Processing poll — spinner shown, refetchInterval active while processing
 *  3. MatchQueue renders when status is partial
 *  4. Candidate cards show supplier_sku + candidates with score
 *  5. Confirm candidate → POST resolve with product_id → entry removed
 *  6. Skip entry → POST resolve with {skipped:true} → entry removed
 *  7. Empty queue shows empty-state message
 *  8. Error state shows feed error message
 *  9. No queue request when status is matched
 * 10. Back link renders with supplier name and routes to /suppliers/:id
 * 11. Error notification fires exactly once on error status
 * 12. Done notification fires exactly once on done status
 * 13. Notification dedup guard prevents duplicates on re-render
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
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
  feed_mapping: 5,
  status: 'partial',
  total: 100,
  matched: 80,
  queued: 20,
  skipped: 0,
  error: null,
  created_at: '2026-05-26T10:00:00Z',
  updated_at: '2026-05-26T10:05:00Z',
};

const FEED_PROCESSING = {
  ...FEED_PARTIAL,
  status: 'processing',
  matched: 0,
  queued: 0,
};

const FEED_MATCHED = {
  ...FEED_PARTIAL,
  status: 'matched',
  matched: 100,
  queued: 0,
};

const FEED_DONE = {
  ...FEED_PARTIAL,
  status: 'done',
  matched: 100,
  queued: 0,
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
    { product_id: 10, score: 0.95, sku: 'CAT-010' },
    { product_id: 11, score: 0.72, sku: 'CAT-011' },
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
    { product_id: 20, score: 0.61, sku: 'CAT-020' },
  ],
  product: null,
  skipped: false,
  created_at: '2026-05-26T10:00:01Z',
};

const paginated = <T,>(results: T[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
});

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
      http.get('/api/suppliers/', () => HttpResponse.json([SUPPLIER])),
      http.get('/api/supplier-feed/feeds/42/', () => HttpResponse.json(FEED_PARTIAL)),
      http.get('/api/supplier-feed/feeds/42/queue/', () => HttpResponse.json(paginated([]))),
    );
  });

  it('renders the feed header with supplier name, status badge, and row counts', async () => {
    renderPage();

    // Supplier name (now in the back link)
    expect(await screen.findByRole('link', { name: /ООО Ромашка/ })).toBeInTheDocument();

    // Status badge text
    expect(screen.getByText('Частично')).toBeInTheDocument();

    // Row counts
    expect(screen.getByText(/100/)).toBeInTheDocument();  // total
    expect(screen.getByText(/80/)).toBeInTheDocument();   // matched
    expect(screen.getByText(/20/)).toBeInTheDocument();   // queued
  });

  // ── Slice 2: processing → spinner visible ─────────────────────────────────

  it('shows a spinner while feed status is processing', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () => HttpResponse.json(FEED_PROCESSING)),
    );
    renderPage();

    await waitFor(() => {
      expect(document.querySelector('[data-testid="feed-processing-loader"]')).toBeTruthy();
    });
  });

  // ── Slice 3: MatchQueue renders when partial ──────────────────────────────

  it('renders MatchQueue entries when feed status is partial', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1, ENTRY_2])),
      ),
    );
    renderPage();

    expect(await screen.findByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText('SUP-002')).toBeInTheDocument();
  });

  // ── Slice 4: candidate cards show sku + score ─────────────────────────────

  it('shows candidate SKUs and scores for each queue entry', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1])),
      ),
    );
    renderPage();

    expect(await screen.findByText('CAT-010')).toBeInTheDocument();
    expect(screen.getByText('CAT-011')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  // ── Slice 5: confirm candidate → entry disappears ────────────────────────

  it('confirming a candidate POSTs resolve with product_id and removes the entry', async () => {
    let resolveBody: unknown;
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () => HttpResponse.json(paginated([ENTRY_1]))),
      http.post('/api/supplier-feed/feeds/42/queue/1/resolve/', async ({ request }) => {
        resolveBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    const confirmBtn = screen.getAllByRole('button', { name: /подтвердить/i })[0];
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(resolveBody).toMatchObject({ product_id: 10 });
    });

    await waitFor(() => {
      expect(screen.queryByText('SUP-001')).not.toBeInTheDocument();
    });
  });

  // ── Slice 6: skip entry → entry disappears ───────────────────────────────

  it('skipping an entry POSTs resolve with skipped:true and removes the entry', async () => {
    let resolveBody: unknown;
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () => HttpResponse.json(paginated([ENTRY_1]))),
      http.post('/api/supplier-feed/feeds/42/queue/1/resolve/', async ({ request }) => {
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
    renderPage(); // queue returns paginated([]) from beforeEach

    await waitFor(() => {
      expect(screen.getByText(/очередь пуста/i)).toBeInTheDocument();
    });
  });

  // ── Slice 8: error state ─────────────────────────────────────────────────

  it('shows the error message when feed status is error', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () => HttpResponse.json(FEED_ERROR)),
    );
    renderPage();

    expect(await screen.findByText(/ошибка разбора файла/i)).toBeInTheDocument();
  });

  // ── Slice 9: no queue request when status is matched ─────────────────────

  it('does not request the queue endpoint when feed status is matched', async () => {
    let queueCalled = false;
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () => HttpResponse.json(FEED_MATCHED)),
      http.get('/api/supplier-feed/feeds/42/queue/', () => {
        queueCalled = true;
        return HttpResponse.json(paginated([]));
      }),
    );
    renderPage();

    // Wait for the feed to render
    expect(await screen.findByRole('link', { name: /ООО Ромашка/ })).toBeInTheDocument();
    expect(queueCalled).toBe(false);
  });

  // ── Slice 10: back link ───────────────────────────────────────────────────

  it('renders a back link with supplier name that routes to /suppliers/:id', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: /← ООО Ромашка/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/suppliers/1');
  });

  // ── Slice 11: error notification fires exactly once ───────────────────────

  it('shows a red notification exactly once when feed status is error', async () => {
    const spy = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () => HttpResponse.json(FEED_ERROR)),
    );
    renderPage();

    await screen.findByText(/ошибка разбора файла/i);
    await waitFor(() => {
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: FEED_ERROR.error }),
      );
    });

    spy.mockRestore();
  });

  // ── Slice 12: done notification fires exactly once ────────────────────────

  it('shows a green notification exactly once when feed status is done', async () => {
    const spy = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () => HttpResponse.json(FEED_DONE)),
      http.get('/api/supplier-feed/feeds/42/queue/', () => HttpResponse.json(paginated([]))),
    );
    renderPage();

    await screen.findByText('Готово');
    await waitFor(() => {
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'green', message: 'Все строки разобраны' }),
      );
    });

    spy.mockRestore();
  });

  // ── Slice 13: dedup — no duplicate notification on re-render ─────────────

  it('does not show a duplicate notification when React Query re-delivers the same data', async () => {
    const spy = vi.spyOn(notifications, 'show').mockImplementation(() => '');
    let callCount = 0;
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () => {
        callCount++;
        return HttpResponse.json(FEED_ERROR);
      }),
    );
    renderPage();

    await screen.findByText(/ошибка разбора файла/i);
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());

    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));
    expect(spy).toHaveBeenCalledOnce();

    spy.mockRestore();
  });

  // ── Slice 14: load-more — page 2 entries appear after clicking button ─────

  it('appends page-2 entries to the list when "Загрузить ещё" is clicked', async () => {
    const PAGE2_URL = 'http://localhost/api/supplier-feed/feeds/42/queue/?page=2';
    const ENTRY_3 = {
      id: 3,
      feed: 42,
      supplier_sku: 'SUP-003',
      data: {},
      match_candidates: [{ product_id: 30, score: 0.8, sku: 'CAT-030' }],
      product: null,
      skipped: false,
      created_at: '2026-05-26T10:00:02Z',
    };

    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('page') === '2') {
          return HttpResponse.json(paginated([ENTRY_3]));
        }
        return HttpResponse.json(paginated([ENTRY_1, ENTRY_2], PAGE2_URL));
      }),
    );

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('SUP-001')).toBeInTheDocument();
    expect(screen.getByText('SUP-002')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /загрузить ещё/i }));

    await waitFor(() => {
      expect(screen.getByText('SUP-003')).toBeInTheDocument();
    });
    // Page 1 still visible
    expect(screen.getByText('SUP-001')).toBeInTheDocument();
  });

  // ── Slice 15: no load-more button when last page ──────────────────────────

  it('hides "Загрузить ещё" when there are no more pages', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1])),
      ),
    );
    renderPage();

    await screen.findByText('SUP-001');
    expect(screen.queryByRole('button', { name: /загрузить ещё/i })).not.toBeInTheDocument();
  });

  // ── Slice 16: spinner on "Загрузить ещё" while fetching ──────────────────

  it('shows spinner on "Загрузить ещё" button while next page is loading', async () => {
    const PAGE2_URL = 'http://localhost/api/supplier-feed/feeds/42/queue/?page=2';
    let resolvePage2: (() => void) | undefined;
    const page2Promise = new Promise<void>((res) => { resolvePage2 = res; });

    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('page') === '2') {
          await page2Promise;
          return HttpResponse.json(paginated([ENTRY_2]));
        }
        return HttpResponse.json(paginated([ENTRY_1], PAGE2_URL));
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    const loadMoreBtn = screen.getByRole('button', { name: /загрузить ещё/i });
    await user.click(loadMoreBtn);

    // While page 2 is in-flight the button should be disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /загрузить ещё/i })).toBeDisabled();
    });

    resolvePage2!();
    await waitFor(() => {
      expect(screen.getByText('SUP-002')).toBeInTheDocument();
    });
  });

  // ── Slice 17: optimistic removal works across pages ───────────────────────

  it('removes a resolved entry from page 2 immediately via optimistic update', async () => {
    const PAGE2_URL = 'http://localhost/api/supplier-feed/feeds/42/queue/?page=2';
    const ENTRY_P2 = {
      id: 99,
      feed: 42,
      supplier_sku: 'SUP-P2',
      data: {},
      match_candidates: [{ product_id: 99, score: 0.9, sku: 'CAT-099' }],
      product: null,
      skipped: false,
      created_at: '2026-05-26T10:00:03Z',
    };

    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('page') === '2') {
          return HttpResponse.json(paginated([ENTRY_P2]));
        }
        return HttpResponse.json(paginated([ENTRY_1], PAGE2_URL));
      }),
      http.post('/api/supplier-feed/feeds/42/queue/99/resolve/', () =>
        new HttpResponse(null, { status: 200 }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    await user.click(screen.getByRole('button', { name: /загрузить ещё/i }));
    await screen.findByText('SUP-P2');

    await user.click(screen.getAllByRole('button', { name: /пропустить/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('SUP-P2')).not.toBeInTheDocument();
    });
    // Page 1 entry still visible
    expect(screen.getByText('SUP-001')).toBeInTheDocument();
  });

  // ── Slice 18 (tracer): "Найти вручную" button appears on each entry ────────

  it('each entry card has a "Найти вручную" button', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1, ENTRY_2])),
      ),
    );
    renderPage();

    await screen.findByText('SUP-001');
    const btns = screen.getAllByRole('button', { name: /найти вручную/i });
    expect(btns).toHaveLength(2);
  });

  // ── Slice 19: clicking "Найти вручную" opens modal with product search ──────

  it('clicking "Найти вручную" opens a modal with a product search input', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1])),
      ),
      http.get('/api/products/products/', () => HttpResponse.json(paginated([]))),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    await user.click(screen.getByRole('button', { name: /найти вручную/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: /поиск/i })).toBeInTheDocument();
  });

  // ── Slice 20: < 2 chars does not trigger listProducts ───────────────────────

  it('typing fewer than 2 characters does not trigger a listProducts request', async () => {
    let productsQueried = false;
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1])),
      ),
      http.get('/api/products/products/', () => {
        productsQueried = true;
        return HttpResponse.json(paginated([]));
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    await user.click(screen.getByRole('button', { name: /найти вручную/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: /поиск/i }), 'а');

    // Wait past the 300 ms debounce window
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(productsQueried).toBe(false);
  });

  // ── Slice 21: ≥ 2 chars shows product options; confirm disabled until selected

  it('typing ≥ 2 characters shows matching products; confirm is disabled until one is picked', async () => {
    const PRODUCT = { id: 99, name: 'Товар Тест', sku: 'SKU-099' };
    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1])),
      ),
      http.get('/api/products/products/', () =>
        HttpResponse.json(paginated([PRODUCT])),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    await user.click(screen.getByRole('button', { name: /найти вручную/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: /поиск/i }), 'те');

    // Wait for the Select to appear (debounce + query)
    const productSelect = await screen.findByPlaceholderText('Выбрать из результатов...', {}, { timeout: 1500 });

    // Confirm is disabled before a product is selected
    expect(screen.getByRole('button', { name: /выбрать/i })).toBeDisabled();

    // Pick a product
    await user.click(productSelect);
    await user.click(await screen.findByRole('option', { name: /Товар Тест/i }));

    // Confirm becomes enabled
    expect(screen.getByRole('button', { name: /выбрать/i })).toBeEnabled();
  });

  // ── Slice 22: confirming posts resolveMatchQueueEntry({product_id}) ──────────

  it('confirming in the manual search modal POSTs resolveMatchQueueEntry with product_id and removes the entry', async () => {
    const PRODUCT = { id: 99, name: 'Товар Тест', sku: 'SKU-099' };
    let resolveBody: unknown;

    server.use(
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json(paginated([ENTRY_1])),
      ),
      http.get('/api/products/products/', () =>
        HttpResponse.json(paginated([PRODUCT])),
      ),
      http.post('/api/supplier-feed/feeds/42/queue/1/resolve/', async ({ request }) => {
        resolveBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('SUP-001');
    await user.click(screen.getByRole('button', { name: /найти вручную/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: /поиск/i }), 'те');

    const productSelect = await screen.findByPlaceholderText('Выбрать из результатов...', {}, { timeout: 1500 });
    await user.click(productSelect);
    await user.click(await screen.findByRole('option', { name: /Товар Тест/i }));

    await user.click(screen.getByRole('button', { name: /выбрать/i }));

    await waitFor(() => {
      expect(resolveBody).toMatchObject({ product_id: 99 });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('SUP-001')).not.toBeInTheDocument();
    });
  });
});
