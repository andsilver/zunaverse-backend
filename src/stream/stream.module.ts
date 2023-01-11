import { MiddlewareConsumer, Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { StreamAuthMiddleware } from './stream-auth.middleware';
import { StreamController } from './stream.controller';

@Module({
  controllers: [StreamController],
  imports: [SharedModule],
})
export class StreamModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StreamAuthMiddleware).forRoutes(StreamController);
  }
}
