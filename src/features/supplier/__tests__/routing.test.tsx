/**
 * Issue #2 — supplier foundation: routes + nav
 *
 * Tests verify public behaviour (URL → page, redirect, nav highlight).
 * We follow the established pattern: MemoryRouter + inline Routes for routing
 * tests (avoids the createMemoryRouter data-router AbortSignal issue with MSW),
 * and render AppLayout directly with a mocked auth context for nav tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';

// ── shared helpers ─────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function renderAt(path: string, element: React.ReactElement) {
  render(
    <QueryClientProvider client={makeClient()}>
      <MantineProvider defaultColorScheme="light">
        <MemoryRouter initialEntries={[path]}>
          {element}
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

// ── routing tests ──────────────────────────────────────────────────────────
// These render individual page components under test paths; they verify
// the correct page is reachable, independent of RequireAuth.

import { SuppliersPage } from '../pages/SuppliersPage';
import { FeedsPage } from '../pages/FeedsPage';
import { FeedNewPage } from '../pages/FeedNewPage';
import { FeedDetailPage } from '../pages/FeedDetailPage';
import { MappingsPage } from '../pages/MappingsPage';
import { LinksPage } from '../pages/LinksPage';

describe('supplier routing', () => {
  it('FeedsPage renders at /suppliers/feeds', () => {
    renderAt('/suppliers/feeds', (
      <Routes>
        <Route path="/suppliers/feeds" element={<FeedsPage />} />
      </Routes>
    ));
    expect(screen.getByText(/выгрузки/i)).toBeInTheDocument();
  });

  it('SuppliersPage renders at /suppliers', async () => {
    server.use(
      http.get('/api/suppliers/', () => HttpResponse.json([])),
    );
    renderAt('/suppliers', (
      <Routes>
        <Route path="/suppliers">
          <Route index element={<SuppliersPage />} />
        </Route>
      </Routes>
    ));
    expect(await screen.findByRole('heading', { name: /поставщики/i })).toBeInTheDocument();
  });

  it('FeedNewPage renders at /suppliers/feeds/new', () => {
    renderAt('/suppliers/feeds/new', (
      <Routes>
        <Route path="/suppliers/feeds/new" element={<FeedNewPage />} />
      </Routes>
    ));
    expect(screen.getByText(/новая выгрузка/i)).toBeInTheDocument();
  });

  it('FeedDetailPage renders at /suppliers/feeds/:id with the id', async () => {
    server.use(
      http.get('/api/supplier-feed/feeds/42/', () =>
        HttpResponse.json({
          id: 42, supplier: 1, feed_mapping: null, status: 'matched',
          total: 0, matched: 0, queued: 0, skipped: 0,
          error: null, created_at: '2026-05-26T10:00:00Z', updated_at: '2026-05-26T10:00:00Z',
        }),
      ),
      http.get('/api/suppliers/', () => HttpResponse.json([])),
      http.get('/api/supplier-feed/feeds/42/queue/', () =>
        HttpResponse.json({ count: 0, next: null, results: [] }),
      ),
    );
    renderAt('/suppliers/feeds/42', (
      <Routes>
        <Route path="/suppliers/feeds/:id" element={<FeedDetailPage />} />
      </Routes>
    ));
    expect(await screen.findByText(/выгрузка #42/i)).toBeInTheDocument();
  });

  it('MappingsPage renders at /suppliers/mappings', () => {
    renderAt('/suppliers/mappings', (
      <Routes>
        <Route path="/suppliers/mappings" element={<MappingsPage />} />
      </Routes>
    ));
    expect(screen.getByText(/конфигурации/i)).toBeInTheDocument();
  });

  it('LinksPage renders at /suppliers/links', () => {
    renderAt('/suppliers/links', (
      <Routes>
        <Route path="/suppliers/links" element={<LinksPage />} />
      </Routes>
    ));
    // Match the page heading specifically, not the nav sub-item
    expect(screen.getByRole('heading', { name: /связи/i })).toBeInTheDocument();
  });
});

// ── nav highlight ──────────────────────────────────────────────────────────
// Mock useAuth so AppLayout can render without a live AuthProvider.

vi.mock('@/auth/AuthContext', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/auth/AuthContext')>();
  return {
    ...mod,
    useAuth: () => ({ user: { id: 1, username: 'tester' }, login: vi.fn(), logout: vi.fn() }),
  };
});

import { AppLayout } from '@/layout/AppLayout';

beforeEach(() => {
  server.use(
    http.get('/api/auth/me/', () =>
      HttpResponse.json({ id: 1, username: 'tester' }),
    ),
  );
});

function renderNav(path: string) {
  render(
    <QueryClientProvider client={makeClient()}>
      <MantineProvider defaultColorScheme="light">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('AppLayout nav — Поставщики', () => {
  it('nav item is active on /suppliers/feeds', async () => {
    renderNav('/suppliers/feeds');
    await waitFor(() => {
      const text = screen.getByText('Поставщики');
      // Mantine sets data-active on the NavLink root element
      const root = text.closest('[data-active]');
      expect(root).toHaveAttribute('data-active', 'true');
    });
  });

  it('nav item is active on /suppliers/mappings', async () => {
    renderNav('/suppliers/mappings');
    await waitFor(() => {
      const text = screen.getByText('Поставщики');
      const root = text.closest('[data-active]');
      expect(root).toHaveAttribute('data-active', 'true');
    });
  });
});
