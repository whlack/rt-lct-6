export type ApiStatus = { status: 'ok' };

export async function getApiStatus(): Promise<ApiStatus> {
  const response = await fetch('/api/ready');
  if (!response.ok) {
    throw new Error('API недоступен');
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('status' in payload) ||
    payload.status !== 'ok'
  ) {
    throw new Error('Некорректный ответ API');
  }
  return { status: 'ok' };
}
