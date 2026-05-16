import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { PreviewPanel } from '../components/PreviewPanel';

describe('PreviewPanel', () => {
  it('shows upload hint when no session', () => {
    renderWithProviders(
      <PreviewPanel
        result={undefined}
        isLoading={false}
        isFetching={false}
        isError={false}
        hasSession={false}
        stepLabel="reader"
      />,
    );
    expect(screen.getByText(/Загрузите файл/)).toBeInTheDocument();
  });

  it('shows loader while loading', () => {
    renderWithProviders(
      <PreviewPanel
        result={undefined}
        isLoading={true}
        isFetching={true}
        isError={false}
        hasSession={true}
        stepLabel="reader"
      />,
    );
    expect(screen.getByText(/Загружаем превью/)).toBeInTheDocument();
  });

  it('renders success data', () => {
    renderWithProviders(
      <PreviewPanel
        result={{
          columns: ['a', 'b'],
          rows: [
            ['1', '2'],
            ['3', '4'],
          ],
          total_rows: 2,
          returned_rows: 2,
        }}
        isLoading={false}
        isFetching={false}
        isError={false}
        hasSession={true}
        stepLabel="reader"
      />,
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders error from PreviewError result', () => {
    renderWithProviders(
      <PreviewPanel
        result={{ error: { step_index: 2, message: 'KeyError: foo' } }}
        isLoading={false}
        isFetching={false}
        isError={false}
        hasSession={true}
        stepLabel="step #2"
      />,
    );
    expect(screen.getByText(/KeyError/)).toBeInTheDocument();
  });
});
