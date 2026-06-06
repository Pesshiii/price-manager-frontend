import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ConditionBuilder } from '../components/ConditionBuilder';
import type { Condition } from '../types';

function Wrapper({ initial }: { initial: Condition | null }) {
  const [value, setValue] = useState<Condition | null>(initial);
  return <ConditionBuilder value={value} onChange={setValue} />;
}

const INITIAL_CONDITION: Condition = { op: 'AND', conditions: [] };

describe('ConditionBuilder', () => {
  it('"Без условия" toggle hides leaf form and sets value to null', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ConditionBuilder value={INITIAL_CONDITION} onChange={onChange} />,
    );

    const toggle = screen.getByRole('switch', { name: /без условия/i });
    expect(toggle).not.toBeChecked();

    const user = userEvent.setup();
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('when value is null, "Без условия" toggle is checked and leaf form is hidden', () => {
    renderWithProviders(<ConditionBuilder value={null} onChange={vi.fn()} />);

    const toggle = screen.getByRole('switch', { name: /без условия/i });
    expect(toggle).toBeChecked();
    expect(screen.queryByText(/добавить условие/i)).not.toBeInTheDocument();
  });

  it('AND/OR SegmentedControl updates the combinator', async () => {
    renderWithProviders(<Wrapper initial={INITIAL_CONDITION} />);

    const user = userEvent.setup();
    const orButton = screen.getByRole('radio', { name: 'OR' });
    await user.click(orButton);

    expect(screen.getByRole('radio', { name: 'OR' })).toBeChecked();
  });

  it('adding a leaf appends a new row', async () => {
    renderWithProviders(<Wrapper initial={INITIAL_CONDITION} />);

    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: /удалить условие/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /добавить условие/i }));

    // After adding a leaf, the delete button appears
    expect(screen.getByRole('button', { name: /удалить условие/i })).toBeInTheDocument();
  });

  it('delete icon removes a leaf', async () => {
    const initial: Condition = {
      op: 'AND',
      conditions: [{ op: '==', source: 'feed', key: 'price', value: '100' }],
    };
    renderWithProviders(<Wrapper initial={initial} />);

    const user = userEvent.setup();
    const deleteBtn = screen.getByRole('button', { name: /удалить условие/i });
    await user.click(deleteBtn);

    expect(screen.queryByRole('button', { name: /удалить условие/i })).not.toBeInTheDocument();
  });

  it('key field is hidden when source is brand or category', async () => {
    const initial: Condition = {
      op: 'AND',
      conditions: [{ op: '==', source: 'feed', key: 'price', value: '100' }],
    };
    renderWithProviders(<Wrapper initial={initial} />);

    // key field visible for source=feed
    expect(screen.getByRole('textbox', { name: /ключ/i })).toBeInTheDocument();

    const user = userEvent.setup();
    // Change source to brand (Mantine Select renders as textbox role)
    await user.click(screen.getByRole('textbox', { name: /источник/i }));
    await user.click(await screen.findByRole('option', { name: 'brand' }));

    expect(screen.queryByRole('textbox', { name: /ключ/i })).not.toBeInTheDocument();
  });
});
