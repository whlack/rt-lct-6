import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Field } from './index';

afterEach(cleanup);
it('names a select by its caption independently of its options', () => {
  render(
    <Field label="Вуз">
      <select defaultValue="">
        <option value="">Выберите вуз</option>
        <option value="one">Университет</option>
      </select>
    </Field>,
  );
  const control = screen.getByRole('combobox', { name: 'Вуз' });
  expect(screen.getByLabelText('Вуз', { exact: true })).toBe(control);
});

it('keeps captions distinct when several fields appear in one form', () => {
  render(
    <form>
      <Field label="Комментарий">
        <textarea />
      </Field>
      <Field label="Название">
        <input />
      </Field>
    </form>,
  );
  expect(screen.getByLabelText('Комментарий', { exact: true }).tagName).toBe(
    'TEXTAREA',
  );
  expect(screen.getByLabelText('Название', { exact: true }).tagName).toBe(
    'INPUT',
  );
});
