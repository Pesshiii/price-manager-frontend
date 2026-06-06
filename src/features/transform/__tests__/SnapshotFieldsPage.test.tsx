import { describe, expect, it, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw';
import { notifications } from '@mantine/notifications';
import { SnapshotFieldsPage } from '../pages/SnapshotFieldsPage';
import type { SnapshotField } from '../types';

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

const FIELDS: SnapshotField[] = [
  { id: 1, slug: 'price', name: 'Цена', value_type: 'number', description: 'Цена товара' },
  { id: 2, slug: 'in_stock', name: 'Наличие', value_type: 'boolean', description: '' },
];

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/transform/snapshot-fields" element={<SnapshotFieldsPage />} />
    </Routes>,
    { route: '/transform/snapshot-fields' },
  );
}

beforeEach(() => {
  vi.mocked(notifications.show).mockClear();
});

describe('SnapshotFieldsPage', () => {
  it('renders list of snapshot fields from API', async () => {
    server.use(http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: FIELDS.length, next: null, previous: null, results: FIELDS })));
    renderPage();
    expect(await screen.findByText('price')).toBeInTheDocument();
    expect(screen.getByText('Цена')).toBeInTheDocument();
    expect(screen.getByText('Наличие')).toBeInTheDocument();
  });

  it('opens create modal and POSTs on submit', async () => {
    let postedBody: unknown;
    server.use(
      http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: FIELDS.length, next: null, previous: null, results: FIELDS })),
      http.post('/api/transform/snapshot-fields/', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json(
          { slug: 'weight', name: 'Вес', value_type: 'number', description: '', id: 99 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('price');

    await user.click(screen.getByRole('button', { name: /новое поле/i }));
    const dialog = await screen.findByRole('dialog');
    const [slugInput, nameInput] = Array.from(dialog.querySelectorAll('input'));
    await user.type(slugInput, 'weight');
    await user.type(nameInput, 'Вес');
    await user.click(screen.getByRole('button', { name: /создать/i }));

    await waitFor(() => expect(postedBody).toMatchObject({ slug: 'weight', name: 'Вес' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('opens edit modal pre-filled and PATCHes on save', async () => {
    let patchedBody: unknown;
    server.use(
      http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: FIELDS.length, next: null, previous: null, results: FIELDS })),
      http.patch('/api/transform/snapshot-fields/1/', async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({ ...FIELDS[0], name: 'Цена опт' });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const editButtons = await screen.findAllByLabelText(/редактировать/i);
    await user.click(editButtons[0]);

    await screen.findByRole('dialog');
    const nameInput = screen.getByDisplayValue('Цена');
    await user.clear(nameInput);
    await user.type(nameInput, 'Цена опт');
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => expect(patchedBody).toMatchObject({ name: 'Цена опт' }));
  });

  it('deletes a field when user confirms', async () => {
    let deleted = false;
    server.use(
      http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: FIELDS.length, next: null, previous: null, results: FIELDS })),
      http.delete('/api/transform/snapshot-fields/1/', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    const deleteButtons = await screen.findAllByLabelText(/удалить/i);
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(deleted).toBe(true));
  });

  it('shows red notification on 409 delete', async () => {
    server.use(
      http.get('/api/transform/snapshot-fields/', () => HttpResponse.json({ count: FIELDS.length, next: null, previous: null, results: FIELDS })),
      http.delete('/api/transform/snapshot-fields/1/', () =>
        HttpResponse.json({}, { status: 409 }),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    const deleteButtons = await screen.findAllByLabelText(/удалить/i);
    await user.click(deleteButtons[0]);

    await waitFor(() =>
      expect(vi.mocked(notifications.show)).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Поле используется в правилах' }),
      ),
    );
  });
});
