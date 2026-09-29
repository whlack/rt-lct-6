import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, configureSession, ApiError } from './http';
afterEach(() => {
  configureSession(undefined);
  vi.unstubAllGlobals();
});
describe('authenticated API transport', () => {
  it('refreshes the in-memory token and preserves multipart content type', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"id":"file"}', { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const token = vi.fn().mockResolvedValue('fresh-token');
    configureSession(token);
    const body = new FormData();
    body.set('file', new File(['content'], 'document.pdf'));
    await api('/api/projects/project/files', { method: 'POST', body });
    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(token).toHaveBeenCalledOnce();
    expect(headers.get('authorization')).toBe('Bearer fresh-token');
    expect(headers.has('content-type')).toBe(false);
  });
  it('expires the session on 401 but keeps it on a forbidden operation', async () => {
    const expire = vi.fn();
    configureSession(async () => 'token', expire);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    await expect(api('/api/projects')).rejects.toMatchObject({ status: 403 });
    expect(expire).not.toHaveBeenCalled();
    await expect(api('/api/projects')).rejects.toBeInstanceOf(ApiError);
    expect(expire).toHaveBeenCalledOnce();
  });
  it('refuses authenticated requests without a session and external paths', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(api('/api/projects')).rejects.toMatchObject({ status: 401 });
    configureSession(async () => 'token');
    await expect(api('https://external.test/api/projects')).rejects.toThrow(
      'Unsupported API path',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not leak server error messages and propagates cancellation', async () => {
    configureSession(async () => 'token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"private-data"}', { status: 500 }),
        ),
    );
    await expect(api('/api/projects')).rejects.not.toThrow('private-data');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    );
    await expect(api('/api/projects')).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
