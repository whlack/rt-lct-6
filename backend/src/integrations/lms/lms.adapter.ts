import { Injectable } from '@nestjs/common';
import { SyncFailure, type SyncAdapter } from '../sync-adapter.js';
@Injectable()
export class LmsAdapter implements SyncAdapter {
  readonly source = 'LMS';
  readonly availability = 'NOT_IMPLEMENTED';
  execute(): Promise<void> {
    return Promise.reject(new SyncFailure('SOURCE_NOT_IMPLEMENTED'));
  }
}
