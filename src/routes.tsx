import { createBrowserRouter, Navigate } from 'react-router-dom';
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
import { SuppliersPage } from '@/features/supplier/pages/SuppliersPage';

export const router = createBrowserRouter([
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
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/new', element: <ProductEditorPage /> },
      { path: 'products/import', element: <ImportPage /> },
      { path: 'products/categories', element: <CategoriesPage /> },
      { path: 'products/brands', element: <BrandsPage /> },
      { path: 'products/characteristics', element: <CharacteristicTypesPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'products/:id/edit', element: <ProductEditorPage /> },
      { path: 'prices', element: <PlaceholderPage title="Цены" /> },
      { path: 'dataframe', element: <DataframeListPage /> },
      { path: 'dataframe/new', element: <DataframeEditorPage /> },
      { path: 'dataframe/:id', element: <DataframeEditorPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function PlaceholderPage({ title }: { title: string }) {
  return <h2>{title} — раздел в разработке</h2>;
}
