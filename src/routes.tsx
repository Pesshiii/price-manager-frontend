import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AppLayout } from '@/layout/AppLayout';
import { RequireAuth } from '@/auth/RequireAuth';
import { DataframeListPage } from '@/features/dataframe/pages/DataframeListPage';
import { DataframeEditorPage } from '@/features/dataframe/pages/DataframeEditorPage';
import { ProductListPage } from '@/features/product/pages/ProductListPage';
import { ProductDetailPage } from '@/features/product/pages/ProductDetailPage';
import { ProductEditorPage } from '@/features/product/pages/ProductEditorPage';
import { CategoriesPage } from '@/features/product/pages/CategoriesPage';
import { BrandsPage } from '@/features/product/pages/BrandsPage';
import { CharacteristicTypesPage } from '@/features/product/pages/CharacteristicTypesPage';
import { ImportPage } from '@/features/product/pages/ImportPage';
import { FeedsPage } from '@/features/supplier/pages/FeedsPage';
import { FeedNewPage } from '@/features/supplier/pages/FeedNewPage';
import { FeedDetailPage } from '@/features/supplier/pages/FeedDetailPage';
import { MappingsPage } from '@/features/supplier/pages/MappingsPage';
import { LinksPage } from '@/features/supplier/pages/LinksPage';

/**
 * Route configuration array — exported so tests can use `createMemoryRouter`
 * without touching the DOM History API.
 */
export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      // ── Suppliers ──────────────────────────────────────────────────────
      {
        path: 'suppliers',
        children: [
          { index: true, element: <Navigate to="feeds" replace /> },
          { path: 'feeds', element: <FeedsPage /> },
          { path: 'feeds/new', element: <FeedNewPage /> },
          { path: 'feeds/:id', element: <FeedDetailPage /> },
          { path: 'mappings', element: <MappingsPage /> },
          { path: 'links', element: <LinksPage /> },
        ],
      },
      // ── Products ───────────────────────────────────────────────────────
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/new', element: <ProductEditorPage /> },
      { path: 'products/import', element: <ImportPage /> },
      { path: 'products/categories', element: <CategoriesPage /> },
      { path: 'products/brands', element: <BrandsPage /> },
      { path: 'products/characteristics', element: <CharacteristicTypesPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'products/:id/edit', element: <ProductEditorPage /> },
      // ── Misc ───────────────────────────────────────────────────────────
      { path: 'prices', element: <PlaceholderPage title="Цены" /> },
      { path: 'dataframe', element: <DataframeListPage /> },
      { path: 'dataframe/new', element: <DataframeEditorPage /> },
      { path: 'dataframe/:id', element: <DataframeEditorPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routeConfig);

/**
 * @deprecated Use `routeConfig` in tests to avoid the DOM History API.
 * Kept for the old named export so import sites don't break.
 */
export const supplierRouteConfig = routeConfig;

function PlaceholderPage({ title }: { title: string }) {
  return <h2>{title} — раздел в разработке</h2>;
}
