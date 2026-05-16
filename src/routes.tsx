import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AppLayout } from '@/layout/AppLayout';
import { RequireAuth } from '@/auth/RequireAuth';
import { DataframeListPage } from '@/features/dataframe/pages/DataframeListPage';
import { DataframeEditorPage } from '@/features/dataframe/pages/DataframeEditorPage';

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
      { path: 'suppliers', element: <PlaceholderPage title="Поставщики" /> },
      { path: 'products', element: <PlaceholderPage title="Продукты" /> },
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
