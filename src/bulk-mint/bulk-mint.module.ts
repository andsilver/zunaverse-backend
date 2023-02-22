import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { IndexerModule } from 'src/indexer/indexer.module';
import { QueueModule } from 'src/queue/queue.module';
import { BulkMintController } from './bulk-mint.controller';
import { BulkMintService } from './bulk-mint.service';

@Module({
  controllers: [BulkMintController],
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
    QueueModule,
    IndexerModule,
  ],
  providers: [BulkMintService],
  exports: [BulkMintService],
})
export class BulkMintModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(BulkMintController);
  }
}
