import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { defer, finalize } from 'rxjs';
import { positiveInteger } from '../config/jobs.js';
import { currentUser, type AuthRequest } from '../modules/auth/auth.types.js';

@Injectable()
export class UploadLimitInterceptor implements NestInterceptor {
  private total = 0;
  private readonly users = new Map<string, number>();
  intercept(context: ExecutionContext, next: CallHandler) {
    const id = currentUser(context.switchToHttp().getRequest<AuthRequest>()).id;
    const active = this.users.get(id) ?? 0;
    // Run before Multer allocates a file buffer. These limits bound each API replica's memory.
    if (
      this.total >= positiveInteger('MAX_ACTIVE_UPLOADS', 4) ||
      active >= positiveInteger('MAX_ACTIVE_UPLOADS_PER_USER', 2)
    )
      throw new HttpException(
        'UPLOAD_LIMIT_REACHED',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    this.total++;
    this.users.set(id, active + 1);
    return defer(() => next.handle()).pipe(
      finalize(() => {
        this.total--;
        const remaining = (this.users.get(id) ?? 1) - 1;
        if (remaining) this.users.set(id, remaining);
        else this.users.delete(id);
      }),
    );
  }
}
