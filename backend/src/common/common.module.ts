import { Module } from '@nestjs/common';
import { UploadLimitInterceptor } from './upload-limit.interceptor.js';
@Module({
  providers: [UploadLimitInterceptor],
  exports: [UploadLimitInterceptor],
})
export class CommonModule {}
