import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SYNC_ADAPTERS,
  sources,
  type SyncAdapter,
  type SyncSource,
} from '../../../integrations/sync-adapter.js';
@Injectable()
export class SyncRegistry {
  constructor(
    @Inject(SYNC_ADAPTERS) private readonly adapters: readonly SyncAdapter[],
  ) {
    if (
      adapters.length !== sources.length ||
      sources.some(
        (source) =>
          adapters.filter((adapter) => adapter.source === source).length !== 1,
      )
    )
      throw new Error('Exactly one adapter per integration source is required');
  }
  get(source: string): SyncAdapter {
    const adapter = this.adapters.find((adapter) => adapter.source === source);
    if (!adapter) throw new NotFoundException('SOURCE_NOT_FOUND');
    return adapter;
  }
  all(): readonly SyncAdapter[] {
    return sources.map((source) => this.get(source));
  }
  source(value: string): SyncSource {
    return this.get(value).source;
  }
}
