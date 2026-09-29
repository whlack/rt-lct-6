import { useMutation, useQueryClient } from '@tanstack/react-query';
export function jsonBody(data: unknown, method = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}
export function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}
export function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—';
}
export function employeeName(
  value:
    | {
        name?: string | null;
        displayName?: string | null;
        email?: string | null;
        subject?: string;
        keycloakSubject?: string;
      }
    | null
    | undefined,
) {
  return (
    value?.displayName ||
    value?.name ||
    value?.email ||
    value?.subject ||
    value?.keycloakSubject ||
    'Не назначен'
  );
}
export function useAction<T, R>(
  action: (input: T) => Promise<R>,
  keys: string[] = [],
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await Promise.all(
        keys.map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
    onError: async () => {
      // A concurrent transition may invalidate the card even when our request failed.
      await Promise.all(
        keys.map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}
