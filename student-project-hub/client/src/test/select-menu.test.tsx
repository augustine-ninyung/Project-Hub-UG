import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SelectMenu } from '@/components/ui/select-menu';

const OPTIONS = [
  { value: '', label: 'Any role' },
  { value: 'STUDENT', label: 'Students' },
  { value: 'ADMIN', label: 'Admins' },
];

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <SelectMenu
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      options={OPTIONS}
      aria-label="Role"
    />
  );
}

describe('SelectMenu', () => {
  it('picks an option, marks the filter active, and can go back to "any"', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger).toHaveTextContent('Any role');
    expect(trigger).toHaveAttribute('data-active', 'false');

    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: 'Admins' }));
    expect(onChange).toHaveBeenLastCalledWith('ADMIN');
    expect(trigger).toHaveTextContent('Admins');
    expect(trigger).toHaveAttribute('data-active', 'true');

    // The empty "any" value round-trips, even though Radix reserves "".
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: 'Any role' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(trigger).toHaveAttribute('data-active', 'false');
  });
});
