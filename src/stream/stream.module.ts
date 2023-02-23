import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { IndexerModule } from 'src/indexer/indexer.module';
import { SharedModule } from 'src/shared/shared.module';
import { StreamAuthMiddleware } from './stream-auth.middleware';
import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';

@Module({
  controllers: [StreamController],
  providers: [StreamService],
  imports: [SharedModule, IndexerModule],
  exports: [StreamService],
})
export class StreamModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(StreamAuthMiddleware)
      .exclude({ path: 'api/stream/add', method: RequestMethod.POST })
      .forRoutes(StreamController);
    consumer.apply(AuthMiddleware).forRoutes(StreamController);
  }
}
