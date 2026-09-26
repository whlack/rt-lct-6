import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusPage } from '../pages/status';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchInterval: 15_000 } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusPage />
    </QueryClientProvider>
  );
}
