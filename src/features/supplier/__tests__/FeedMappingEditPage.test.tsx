import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { FeedMappingEditPage } from '../pages/FeedMappingEditPage';

const MAPPING = {
  id: 2,
  supplier: 1,
  name: 'Прайс Альфа',
  dataframe: 5,
  dataframe_detail: { id: 5, name: 'df-5' },
  supplier_sku_column: 'sku',
  identity_columns: [],
  variable_columns: [],
  auto_match_threshold: 0.8,
  product_name_column: null,
  product_sku_column: null,
};

const RULES = [
  { id: 1, feed_mapping: 2, priority: 1, target_field: 10, condition: null, formula: { type: 'literal', value: '0' } },
  { id: 2, feed_mapping: 2, priority: 2, target_field: 11, condition: null, formula: { type: 'literal', value: '1' } },
];

function baseHandlers(rules = RULES) {
  return [
    http.get('/api/supplier-feed/mappings/2/', () => HttpResponse.json(MAPPING)),
    http.get('/api/dataframe/pipelines/', () => HttpResponse.json([])),
    http.get('/api/transform/rules/', () => HttpResponse.json({ count: rules.length, next: null, previous: null, results: rules })),
  ];
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/suppliers/:id/mappings/:mappingId/edit" element={<FeedMappingEditPage />} />
      <Route path="/suppliers/:id/mappings/:mappingId/rules" element={<div>Страница правил</div>} />
    </Routes>,
    { route: '/suppliers/1/mappings/2/edit' },
  );
}

describe('FeedMappingEditPage — rules card', () => {
  it('shows rule count card after API resolves', async () => {
    server.use(...baseHandlers());
    renderPage();

    expect(await screen.findByText(/Правила трансформации \(2\)/)).toBeInTheDocument();
  });

  it('shows (0) when there are no rules', async () => {
    server.use(...baseHandlers([]));
    renderPage();

    expect(await screen.findByText(/Правила трансформации \(0\)/)).toBeInTheDocument();
  });

  it('card link navigates to the rules page', async () => {
    server.use(...baseHandlers());
    const user = userEvent.setup();
    renderPage();

    const link = await screen.findByRole('link', { name: /Правила трансформации/i });
    await user.click(link);

    await waitFor(() => {
      expect(screen.getByText('Страница правил')).toBeInTheDocument();
    });
  });
});
