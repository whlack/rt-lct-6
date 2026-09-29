import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { attachmentDisposition } from '../../../common/attachment-disposition.js';

test('downloads preserve Cyrillic file names without invalid HTTP headers or header injection', async () => {
  const fileName = "Договор '№1'.pdf";
  const server = createServer((_request, response) => {
    response.setHeader('Content-Disposition', attachmentDisposition(fileName));
    response.end('file');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(
      'http://127.0.0.1:' + (server.address() as AddressInfo).port,
    );
    assert.equal(await response.text(), 'file');
    assert.equal(
      decodeURIComponent(
        response.headers.get('content-disposition')!.split("UTF-8''")[1],
      ),
      fileName,
    );
    assert.equal(
      /[\r\n]/.test(attachmentDisposition('x\r\nX-Header: value.pdf')),
      false,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
