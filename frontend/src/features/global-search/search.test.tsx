import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SessionContext } from '../../shared/session';
import { configureSession } from '../../shared/api';
import { CommandPalette } from './index';

afterEach(() => {
  cleanup();
  configureSession(undefined);
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('does not open a previous section while a new project search is pending', async () => {
  // jsdom does not implement native dialog methods; browser acceptance checks the real modal.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  configureSession(async () => 'test-token');
  const close = vi.fn();
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <SessionContext.Provider
        value={{
          authenticated: true,
          can: (permission) => permission === 'projects.read',
          login: async () => {},
          logout: async () => {},
        }}
      >
        <MemoryRouter>
          <CommandPalette
            onClose={close}
            sections={[{ path: '/', title: 'Главная', icon: 'dashboard' }]}
          />
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('option', { name: 'Главная' })).toBeTruthy();
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Договор 42' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole('option', { name: 'Главная' })).toBeNull();
  await vi.waitFor(() => expect(resolve).toBeDefined());
  resolve(
    new Response(
      JSON.stringify({
        rows: [
          {
            id: 'project',
            program: { id: 'program', name: 'Программа' },
            product: null,
            university: { id: 'university', name: 'Вуз' },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 8,
      }),
    ),
  );
  await screen.findByRole('option', { name: 'Программа · Вуз' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(close).toHaveBeenCalledOnce();
  cache.clear();
});
