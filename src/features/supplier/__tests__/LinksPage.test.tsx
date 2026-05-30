/**
 * Issue #8 — LinksPage: SupplierLink management
 * TDD: vertical RED→GREEN slices, one behaviour at a time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { LinksPage } from '../pages/LinksPage';

// ── fixtures ──────────────────────────────────────────────────────────────────

const SUPPLIER = { id: 1, name: 'Acme Corp' };

const LINK = {
  id: 1,
  supplier: { id: 1, name: 'Acme Corp' },
  supplier_sku: 'SUPP-001',
  product: { id: 42, name: 'Товар Alpha', sku: 'INT-042' },
  created_at: '2026-05-26T10:00:00Z',
};

const PRODUCT = { id: 99, name: 'Товар Beta', sku: 'INT-099' };

// ── helpers ───────────────────────────────────────────────────────────────────

function baseHandlers(links = [LINK]) {
  return [
    http.get('/api/supplier-feed/links/', () => HttpResponse.json(links)),
    http.get('/api/suppliers/', () => HttpResponse.json([SUPPLIER])),
  ];
}

function renderPage(route = '/suppliers/links') {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/links" element={<LinksPage />} />
    </Routes>,
    { route },
  );
}

// ── Slice 1: tracer — rows render ─────────────────────────────────────────────

describe('LinksPage', () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  it('renders link rows with supplier name and product name from nested objects', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('SUPP-001')).toBeInTheDocument();
      // "Acme Corp" also appears as a Select option label, so use getAllByText
      expect(screen.getAllByText('Acme Corp')[0]).toBeInTheDocument();
      expect(screen.getByText('Товар Alpha')).toBeInTheDocument();
      expect(screen.getByText('INT-042')).toBeInTheDocument();
    });
  });

  // ── Slice 4: delete button calls DELETE and removes row ─────────────────

  it('delete button calls DELETE /supplier-feed/links/1/ and removes the row', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let deleteCalled = false;
    server.use(
      http.delete('/api/supplier-feed/links/1/', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get('/api/supplier-feed/links/', () =>
        deleteCalled ? HttpResponse.json([]) : HttpResponse.json([LINK]),
      ),
    );

    renderPage();

    const deleteBtn = await screen.findByRole('button', { name: /удалить/i });
    await user.click(deleteBtn);

    expect(deleteCalled).toBe(true);

    await waitFor(() => {
      expect(screen.queryByText('SUPP-001')).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore(); // Only restore confirm — not all mocks (avoids clearing matchMedia)
  });

  // ── Slice 5: "Переназначить" opens reassignment modal ───────────────────

  it('"Переназначить" button opens a reassignment modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const reassignBtn = await screen.findByRole('button', { name: /переназначить/i });
    await user.click(reassignBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ── Slice 6: typing in modal product search calls /products/products/?q= ──

  it('typing in the reassignment modal product search calls GET /api/products/products/?q=', async () => {
    let capturedUrl: string | null = null;
    server.use(
      http.get('/api/products/products/', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ count: 1, next: null, previous: null, results: [PRODUCT] });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Open the reassignment modal
    const reassignBtn = await screen.findByRole('button', { name: /переназначить/i });
    await user.click(reassignBtn);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Type in the product search
    const searchInput = screen.getByPlaceholderText(/название или артикул/i);
    await user.type(searchInput, 'Beta');

    await waitFor(() => {
      expect(capturedUrl).toContain('q=Beta');
    }, { timeout: 1500 });
  });

  // ── Slice 7: select product + submit → PATCH + row updates ─────────────

  it('selecting a product and submitting PATCHes /supplier-feed/links/1/ with product_id and updates the row', async () => {
    let patchBody: unknown;
    const updatedLink = { ...LINK, product: { id: 99, name: 'Товар Beta', sku: 'INT-099' } };

    server.use(
      http.patch('/api/supplier-feed/links/1/', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json(updatedLink);
      }),
      http.get('/api/products/products/', () =>
        HttpResponse.json({ count: 1, next: null, previous: null, results: [PRODUCT] }),
      ),
      // After update, refetch returns updated link
      http.get('/api/supplier-feed/links/', () => HttpResponse.json([updatedLink])),
    );

    const user = userEvent.setup();
    renderPage();

    // Open modal
    const reassignBtn = await screen.findByRole('button', { name: /переназначить/i });
    await user.click(reassignBtn);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Type to trigger product search
    const searchInput = screen.getByPlaceholderText(/название или артикул/i);
    await user.type(searchInput, 'Beta');

    // Wait for the Select with product options to appear
    const productSelect = await screen.findByPlaceholderText('Выбрать из результатов...', {}, { timeout: 1500 });
    await user.click(productSelect);
    const option = await screen.findByRole('option', { name: /Товар Beta/i });
    await user.click(option);

    // Click Сохранить
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(patchBody).toMatchObject({ product_id: 99 });
    });

    // Modal should close and row should show updated product name
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Товар Beta')).toBeInTheDocument();
    });
  });

  // ── Slice 8: both filters applied simultaneously ─────────────────────────

  it('supplier + SKU filters together send both params in the API request', async () => {
    let capturedUrl: string | null = null;
    server.use(
      http.get('/api/supplier-feed/links/', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([LINK]);
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Select supplier
    const supplierInput = await screen.findByPlaceholderText('Все поставщики');
    await user.click(supplierInput);
    await user.click(await screen.findByRole('option', { name: 'Acme Corp' }));

    // Type SKU filter
    const skuInput = screen.getByPlaceholderText('Поиск по артикулу');
    await user.type(skuInput, 'SUPP');

    await waitFor(() => {
      expect(capturedUrl).toContain('supplier=1');
      expect(capturedUrl).toContain('supplier_sku=SUPP');
    }, { timeout: 1500 });
  });

  // ── Slice 3: SKU input writes ?supplier_sku= to URL ─────────────────────

  it('typing in the SKU input writes ?supplier_sku= to the URL', async () => {
    let capturedUrl: string | null = null;
    server.use(
      http.get('/api/supplier-feed/links/', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([LINK]);
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const skuInput = await screen.findByPlaceholderText('Поиск по артикулу');
    await user.type(skuInput, 'SUPP-001');

    await waitFor(() => {
      expect(capturedUrl).toContain('supplier_sku=SUPP-001');
    }, { timeout: 1500 });
  });

  // ── Slice 2: supplier filter writes ?supplier= to URL ────────────────────

  it('selecting a supplier writes ?supplier=1 to the URL and re-fetches', async () => {
    let capturedUrl: string | null = null;
    server.use(
      http.get('/api/supplier-feed/links/', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([LINK]);
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const supplierInput = await screen.findByPlaceholderText('Все поставщики');
    await user.click(supplierInput);
    const option = await screen.findByRole('option', { name: 'Acme Corp' });
    await user.click(option);

    await waitFor(() => {
      expect(capturedUrl).toContain('supplier=1');
    });
  });
});
