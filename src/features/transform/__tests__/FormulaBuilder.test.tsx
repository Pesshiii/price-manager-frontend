import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { FormulaBuilder } from '../components/FormulaBuilder';
import type { Formula } from '../types';

function Wrapper({ initial }: { initial: Formula | null }) {
  const [value, setValue] = useState<Formula | null>(initial);
  return <FormulaBuilder value={value} onChange={setValue} />;
}

const COPY_FORMULA: Formula = { type: 'copy', source: 'feed', key: 'price' };

describe('FormulaBuilder', () => {
  it('renders copy fields when value is type copy', () => {
    renderWithProviders(<FormulaBuilder value={COPY_FORMULA} onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: /тип формулы/i })).toHaveValue('copy');
    expect(screen.getByRole('textbox', { name: /источник/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /ключ/i })).toBeInTheDocument();
  });

  it('switching type to literal renders value TextInput', async () => {
    renderWithProviders(<Wrapper initial={COPY_FORMULA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: /тип формулы/i }));
    await user.click(await screen.findByRole('option', { name: 'literal' }));

    expect(screen.getByRole('textbox', { name: /значение/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /источник/i })).not.toBeInTheDocument();
  });

  it('switching type to arithmetic renders op Select and two sub-formula slots', async () => {
    renderWithProviders(<Wrapper initial={COPY_FORMULA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: /тип формулы/i }));
    await user.click(await screen.findByRole('option', { name: 'arithmetic' }));

    expect(screen.getByRole('textbox', { name: /операция/i })).toBeInTheDocument();
    // Two sub-formula slots each have a type Select
    const subTypeSelects = screen.getAllByRole('textbox', { name: /тип/i });
    expect(subTypeSelects.length).toBeGreaterThanOrEqual(2);
  });

  it('switching type to map renders input slot and default TextInput', async () => {
    renderWithProviders(<Wrapper initial={COPY_FORMULA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: /тип формулы/i }));
    await user.click(await screen.findByRole('option', { name: 'map' }));

    expect(screen.getByRole('textbox', { name: /по умолчанию/i })).toBeInTheDocument();
  });

  it('switching type to if renders ConditionBuilder and then/else sub-formula slots', async () => {
    renderWithProviders(<Wrapper initial={COPY_FORMULA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: /тип формулы/i }));
    await user.click(await screen.findByRole('option', { name: 'if' }));

    // ConditionBuilder "Без условия" switch should be present
    expect(screen.getByRole('switch', { name: /без условия/i })).toBeInTheDocument();
    // then/else sub-formula type selects
    const subTypeSelects = screen.getAllByRole('textbox', { name: /тип/i });
    expect(subTypeSelects.length).toBeGreaterThanOrEqual(2);
  });

  it('switching to raw JSON mode shows Textarea and Alert warning', async () => {
    renderWithProviders(<FormulaBuilder value={COPY_FORMULA} onChange={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: /расширенный режим/i }));

    expect(screen.getByRole('textbox', { name: /json/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('switching back from invalid JSON stays in JSON mode with error', async () => {
    renderWithProviders(<Wrapper initial={COPY_FORMULA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: /расширенный режим/i }));

    const textarea = screen.getByRole('textbox', { name: /json/i });
    await user.clear(textarea);
    await user.type(textarea, 'not valid json');

    await user.click(screen.getByRole('switch', { name: /расширенный режим/i }));

    // Still in JSON mode - textarea still visible
    expect(screen.getByRole('textbox', { name: /json/i })).toBeInTheDocument();
    // Error message shown
    expect(screen.getByText(/невалидный json/i)).toBeInTheDocument();
  });

  it('switching back from valid JSON restores structured view', async () => {
    renderWithProviders(<Wrapper initial={COPY_FORMULA} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: /расширенный режим/i }));

    const textarea = screen.getByRole('textbox', { name: /json/i });
    fireEvent.change(textarea, { target: { value: '{"type":"literal","value":"hello"}' } });

    await user.click(screen.getByRole('switch', { name: /расширенный режим/i }));

    // Back to structured mode
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: /json/i })).not.toBeInTheDocument(),
    );
    // Literal type fields shown
    expect(screen.getByRole('textbox', { name: /тип формулы/i })).toHaveValue('literal');
  });
});
