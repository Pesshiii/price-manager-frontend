import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SnapshotFieldsPage } from '../pages/SnapshotFieldsPage';
import { TransformRulesPage } from '../pages/TransformRulesPage';

describe('Transform route stubs', () => {
  it('SnapshotFieldsPage renders without crashing', async () => {
    server.use(http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })));
    renderWithProviders(
      <Routes>
        <Route path="/transform/snapshot-fields" element={<SnapshotFieldsPage />} />
      </Routes>,
      { route: '/transform/snapshot-fields' },
    );
    expect(await screen.findByText(/Поля снимков/)).toBeInTheDocument();
  });

  it('TransformRulesPage renders without crashing', async () => {
    server.use(
      http.get('/api/supplier-feed/mappings/2/', () =>
        HttpResponse.json({ id: 2, name: 'Test Mapping', supplier: 1 }),
      ),
      http.get('/api/transform/rules/', () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
      http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
    );
    renderWithProviders(
      <Routes>
        <Route path="/suppliers/:id/mappings/:mappingId/rules" element={<TransformRulesPage />} />
      </Routes>,
      { route: '/suppliers/1/mappings/2/rules' },
    );
    expect(await screen.findByRole('heading', { name: /Правила трансформации/i })).toBeInTheDocument();
  });
});
