import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusPage } from './StatusPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

test('shows loading then a working API', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }),
  );
  renderPage();
  expect(screen.getByText('Подключаемся к API…')).toBeTruthy();
  expect(await screen.findByText('API работает')).toBeTruthy();
});

test('shows an error and retry action', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  renderPage();
  expect(await screen.findByText('API недоступен')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Повторить проверку' }),
  ).toBeTruthy();
});
