import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class WritterAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user) throw new UnauthorizedException();
    if (!request.user.permission.admin && !request.user.permission.writer)
      throw new UnauthorizedException();

    return true;
  }
}
