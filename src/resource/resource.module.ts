import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { SharedModule } from 'src/shared/shared.module';
import { ResourceController } from './resource.controller';

@Module({
  imports: [SharedModule],
  controllers: [ResourceController],
})
export class ResourceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(ResourceController);
  }
}
