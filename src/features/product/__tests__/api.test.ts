import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import {
  commitImport,
  listProducts,
  previewImport,
  updateProduct,
} from '../api';
import { emptyFilters, type ProductFilters } from '../types';

describe('product api', () => {
  it('listProducts serializes filters and repeats char__ params', async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get('/api/products/products/', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({ count: 0, next: null, previous: null, results: [] });
      }),
    );

    const filters: ProductFilters = {
      ...emptyFilters(),
      q: 'drill',
      category: 7,
      brand: 3,
      status: 'active',
      chars: { color: ['red', 'blue'], size: ['L'] },
      page: 2,
      pageSize: 25,
    };
    await listProducts(filters);

    expect(capturedUrl).not.toBeNull();
    const params = capturedUrl!.searchParams;
    expect(params.get('q')).toBe('drill');
    expect(params.get('category')).toBe('7');
    expect(params.get('brand')).toBe('3');
    expect(params.get('status')).toBe('active');
    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('25');
    expect(params.getAll('char__color')).toEqual(['red', 'blue']);
    expect(params.getAll('char__size')).toEqual(['L']);
  });

  it('updateProduct uses PATCH', async () => {
    let method: string | null = null;
    let body: unknown = null;
    server.use(
      http.patch('/api/products/products/42/', async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json({
          id: 42,
          sku: 'SKU-42',
          name: 'New name',
          category: null,
          brand: null,
          description: '',
          status: '',
          characteristics: {},
          image_urls: [],
          created_at: '',
          updated_at: '',
        });
      }),
    );

    const result = await updateProduct(42, { name: 'New name', characteristics: {} });
    expect(method).toBe('PATCH');
    expect(body).toEqual({ name: 'New name', characteristics: {} });
    expect(result.name).toBe('New name');
  });

  it('previewImport sends the expected body', async () => {
    let body: unknown = null;
    server.use(
      http.post('/api/products/import/preview/', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          rows: [],
          total: 0,
          returned: 0,
          valid: 0,
          invalid: 0,
        });
      }),
    );

    await previewImport({
      session_id: 'sid',
      instructions: { reader: { func: 'r', args: {} }, transforms: [] },
      mapping: { sku: { column: 'A' }, characteristics: { color: { column: 'B' } } },
      row_limit: 50,
    });
    expect(body).toEqual({
      session_id: 'sid',
      instructions: { reader: { func: 'r', args: {} }, transforms: [] },
      mapping: { sku: { column: 'A' }, characteristics: { color: { column: 'B' } } },
      row_limit: 50,
    });
  });

  it('commitImport hits /import/commit/ and returns an ImportJob envelope', async () => {
    let called = false;
    server.use(
      http.post('/api/products/import/commit/', () => {
        called = true;
        return HttpResponse.json(
          {
            id: '11111111-1111-1111-1111-111111111111',
            kind: 'commit',
            status: 'pending',
            result: null,
            error: '',
            created_at: '2026-01-01T00:00:00Z',
            started_at: null,
            finished_at: null,
          },
          { status: 202 },
        );
      }),
    );
    const job = await commitImport({
      session_id: 'sid',
      instructions: {},
      mapping: {},
    });
    expect(called).toBe(true);
    expect(job.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(job.kind).toBe('commit');
    expect(job.status).toBe('pending');
  });
});
