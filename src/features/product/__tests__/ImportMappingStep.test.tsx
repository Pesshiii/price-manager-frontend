import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ImportMappingStep } from '../components/import/ImportMappingStep';
import type { CharacteristicType, ImportMapping } from '../types';

const charType: CharacteristicType = {
  id: 1,
  name: 'color',
  label: 'Цвет',
  value_type: 'string',
  options: [],
  unit: '',
  required: false,
  categories: [],
};

function getRowSelect(rowLabel: string) {
  const row = screen.getByText(rowLabel).closest('tr');
  if (!row) throw new Error(`row ${rowLabel} not found`);
  return within(row as HTMLElement).getByRole('textbox');
}

describe('ImportMappingStep', () => {
  it('selecting a column for SKU emits {column}', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(m: ImportMapping) => void>();
    renderWithProviders(
      <ImportMappingStep
        columns={['SKU', 'Name', 'Color']}
        characteristicTypes={[charType]}
        mapping={{}}
        onChange={onChange}
      />,
    );

    await user.click(getRowSelect('SKU *'));
    const option = await screen.findByRole('option', { name: 'SKU' });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith({ sku: { column: 'SKU' } });
  });

  it('selecting a column for characteristic stores under characteristics.<name>', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(m: ImportMapping) => void>();
    renderWithProviders(
      <ImportMappingStep
        columns={['SKU', 'Color']}
        characteristicTypes={[charType]}
        mapping={{}}
        onChange={onChange}
      />,
    );

    await user.click(getRowSelect('Цвет'));
    const option = await screen.findByRole('option', { name: 'Color' });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith({
      characteristics: { color: { column: 'Color' } },
    });
  });
});
