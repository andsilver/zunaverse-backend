import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { AuthMiddleware } from 'src/auth/auth.middleware';
import { QueueModule } from 'src/queue/queue.module';
import { NftController } from './nft.controller';

@Module({
  controllers: [NftController],
  imports: [
    QueueModule,
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
  ],
})
export class NftModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(NftController);
  }
}
