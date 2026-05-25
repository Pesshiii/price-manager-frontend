import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
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

  it('selecting a column for a bound characteristic stores under characteristics.<name>', async () => {
    // After the EAV-import refactor only bound chars are rendered as table rows;
    // the catalog discovery happens via the search-driven autocomplete.
    const user = userEvent.setup();
    const onChange = vi.fn<(m: ImportMapping) => void>();
    renderWithProviders(
      <ImportMappingStep
        columns={['SKU', 'Color']}
        characteristicTypes={[charType]}
        mapping={{ characteristics: { color: { column: '' } } }}
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

  it('clicking "Добавить вариант" appends an empty dynamic group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(m: ImportMapping) => void>();
    renderWithProviders(
      <ImportMappingStep
        columns={['attr_name', 'attr_value', 'attr_unit']}
        characteristicTypes={[]}
        mapping={{}}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Добавить вариант/ }));

    expect(onChange).toHaveBeenCalledWith({
      dynamic_characteristics: [{ name_column: '', value_column: '' }],
    });
  });

  it('picking a column for "Имя из колонки" emits the spec patch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(m: ImportMapping) => void>();
    renderWithProviders(
      <ImportMappingStep
        columns={['attr_name', 'attr_value', 'attr_unit']}
        characteristicTypes={[]}
        mapping={{ dynamic_characteristics: [{ name_column: '', value_column: '' }] }}
        onChange={onChange}
      />,
    );

    const nameSelect = screen.getByRole('textbox', { name: 'Имя из колонки (группа 1)' });
    await user.click(nameSelect);
    await user.click(await screen.findByRole('option', { name: 'attr_name' }));

    expect(onChange).toHaveBeenCalledWith({
      dynamic_characteristics: [{ name_column: 'attr_name', value_column: '' }],
    });
  });

  it('keeps stable DOM identity for unaffected dynamic rows on edit', async () => {
    // Memoization guard: editing row 0 must not remount row 1's inputs. We
    // detect remounts by tagging the row's container with a DOM property and
    // checking it survives a re-render driven by parent state change.
    const user = userEvent.setup();
    type Renderable = { mapping: ImportMapping };
    let lastMapping: ImportMapping = {
      dynamic_characteristics: [
        { name_column: '', value_column: '' },
        { name_column: '', value_column: '' },
      ],
    };

    function Harness({ mapping }: Renderable) {
      const [m, setM] = useState<ImportMapping>(mapping);
      lastMapping = m;
      return (
        <ImportMappingStep
          columns={['c1', 'c2', 'c3']}
          characteristicTypes={[]}
          mapping={m}
          onChange={setM}
        />
      );
    }

    renderWithProviders(<Harness mapping={lastMapping} />);

    const row1 = screen.getByTestId('dynamic-row-1');
    // Tag the row node — if React remounts it during the edit, the tag is lost.
    (row1 as unknown as { __tag: string }).__tag = 'survivor';

    const row0NameSelect = screen.getByRole('textbox', { name: 'Имя из колонки (группа 1)' });
    await user.click(row0NameSelect);
    await user.click(await screen.findByRole('option', { name: 'c1' }));

    const row1After = screen.getByTestId('dynamic-row-1');
    expect((row1After as unknown as { __tag?: string }).__tag).toBe('survivor');
    expect(lastMapping.dynamic_characteristics?.[0].name_column).toBe('c1');
    expect(lastMapping.dynamic_characteristics?.[1].name_column).toBe('');
  });

  it('removing the only dynamic group drops the key from the mapping', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(m: ImportMapping) => void>();
    renderWithProviders(
      <ImportMappingStep
        columns={['attr_name', 'attr_value']}
        characteristicTypes={[]}
        mapping={{
          dynamic_characteristics: [
            { name_column: 'attr_name', value_column: 'attr_value' },
          ],
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Удалить группу 1' }));

    expect(onChange).toHaveBeenCalledWith({});
  });
});
