let accessToken: (() => Promise<string>) | undefined;
let unauthorized: (() => void) | undefined;
export function configureSession(
  token: (() => Promise<string>) | undefined,
  expired?: () => void,
) {
  accessToken = token;
  unauthorized = expired;
}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const errors: Record<number, string> = {
  400: 'Проверьте поля формы.',
  401: 'Сессия завершена. Войдите снова.',
  403: 'Недостаточно прав для этой операции.',
  404: 'Запись не найдена или недоступна.',
  409: 'Операция недоступна в текущем состоянии. Обновите данные.',
  410: 'Срок хранения файла истёк. Создайте выгрузку заново.',
  413: 'Файл превышает допустимый размер.',
  429: 'Слишком много запросов. Повторите позже.',
};
async function request(
  path: string,
  init: RequestInit = {},
  authenticated = true,
) {
  if (!path.startsWith('/api/')) throw new Error('Unsupported API path');
  const headers = new Headers(init.headers);
  if (authenticated) {
    if (!accessToken) throw new ApiError(401, errors[401]);
    headers.set('Authorization', `Bearer ${await accessToken()}`);
  }
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw new Error('Сервер недоступен. Проверьте соединение и повторите.');
  }
  if (!response.ok) {
    if (response.status === 401 && authenticated) unauthorized?.();
    // Server messages may contain internal names or user data; show stable public messages.
    throw new ApiError(
      response.status,
      errors[response.status] ??
        'Не удалось выполнить операцию. Повторите позже.',
    );
  }
  return response;
}
export async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const response = await request(path, init, authenticated);
  if (response.status === 204 || response.headers.get('content-length') === '0')
    return undefined as T;
  const body = await response.text();
  return body ? (JSON.parse(body) as T) : (undefined as T);
}
export function queryString(values: object) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '')
      query.set(key, String(value));
  }
  const result = query.toString();
  return result ? `?${result}` : '';
}
export async function download(path: string) {
  const response = await request(path);
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  let filename = /filename="([^"]+)"/i.exec(disposition)?.[1] ?? 'download';
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      filename = 'download';
    }
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename.replace(/[/\\]/g, '_');
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
