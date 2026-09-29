import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { Subject, firstValueFrom, of } from 'rxjs';
import { UploadLimitInterceptor } from '../../../common/upload-limit.interceptor.js';

test('upload admission releases capacity on cancellation and handler failure', async () => {
  const interceptor = new UploadLimitInterceptor();
  // Only HTTP request identity is used by this interceptor.
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'fixture' } }) }),
  } as ExecutionContext;
  const pending = new Subject();
  const first = interceptor
    .intercept(context, { handle: () => pending })
    .subscribe();
  const second = interceptor
    .intercept(context, { handle: () => pending })
    .subscribe();
  assert.throws(
    () => interceptor.intercept(context, { handle: () => of(null) }),
    /UPLOAD_LIMIT_REACHED/,
  );
  first.unsubscribe();
  await assert.rejects(
    firstValueFrom(
      interceptor.intercept(context, {
        handle: () => {
          throw new Error('handler failed');
        },
      }),
    ),
    /handler failed/,
  );
  assert.equal(
    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of('accepted') }),
    ),
    'accepted',
  );
  second.unsubscribe();
});
