import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { ProductDetailPage } from '../pages/ProductDetailPage';

const PRODUCT = {
  id: 42,
  sku: 'SKU-42',
  name: 'Test Product',
  category: null,
  brand: null,
  description: '',
  status: 'active',
  characteristics: {},
  image_urls: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const SUPPLIER = { id: 7, name: 'Поставщик Альфа' };

const SNAPSHOT_1 = {
  id: 1,
  product: 42,
  supplier: 7,
  source_feed: 3,
  data: { price: 199.9, in_stock: true },
  updated_at: '2026-01-10T12:00:00Z',
};

const SNAPSHOT_2 = {
  id: 2,
  product: 42,
  supplier: 7,
  source_feed: 4,
  data: { price: 210.0, weight: 1.5 },
  updated_at: '2026-01-11T12:00:00Z',
};

const PAGINATED_EMPTY = { count: 0, next: null, previous: null, results: [] };

function baseHandlers(overrides: { snapshots?: unknown[]; suppliers?: unknown[] } = {}) {
  return [
    http.get('/api/products/products/42/', () => HttpResponse.json(PRODUCT)),
    http.get('/api/products/categories/', () => HttpResponse.json(PAGINATED_EMPTY)),
    http.get('/api/products/brands/', () => HttpResponse.json(PAGINATED_EMPTY)),
    http.get('/api/transform/snapshots/', () =>
      HttpResponse.json(overrides.snapshots ?? []),
    ),
    http.get('/api/suppliers/', () => HttpResponse.json(overrides.suppliers ?? [])),
  ];
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/:id" element={<ProductDetailPage />} />
    </Routes>,
    { route: '/products/42' },
  );
}

describe('ProductDetailPage — snapshots section', () => {
  it('shows section header when snapshots exist', async () => {
    server.use(...baseHandlers({ snapshots: [SNAPSHOT_1], suppliers: [SUPPLIER] }));
    renderPage();
    expect(await screen.findByRole('button', { name: /снимки поставщиков/i })).toBeInTheDocument();
  });

  it('does not render snapshots section when snapshots are empty', async () => {
    server.use(...baseHandlers({ snapshots: [] }));
    renderPage();
    await screen.findByRole('heading', { name: 'Test Product' });
    expect(screen.queryByRole('button', { name: /снимки поставщиков/i })).not.toBeInTheDocument();
  });

  it('table is collapsed by default and opens on toggle click', async () => {
    server.use(...baseHandlers({ snapshots: [SNAPSHOT_1], suppliers: [SUPPLIER] }));
    const user = userEvent.setup();
    renderPage();

    const toggle = await screen.findByRole('button', { name: /снимки поставщиков/i });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('derives table columns dynamically from slugs across all snapshots', async () => {
    // SNAPSHOT_1 has price + in_stock, SNAPSHOT_2 has price + weight → 3 unique slugs
    server.use(
      ...baseHandlers({ snapshots: [SNAPSHOT_1, SNAPSHOT_2], suppliers: [SUPPLIER] }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /снимки поставщиков/i }));

    expect(await screen.findByRole('columnheader', { name: /поставщик/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'price' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'in_stock' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'weight' })).toBeInTheDocument();
  });

  it('shows supplier name resolved from supplier ID', async () => {
    server.use(...baseHandlers({ snapshots: [SNAPSHOT_1], suppliers: [SUPPLIER] }));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /снимки поставщиков/i }));

    expect(await screen.findByText('Поставщик Альфа')).toBeInTheDocument();
  });
});
