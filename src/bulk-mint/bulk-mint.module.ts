import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { BulkMintController } from './bulk-mint.controller';
import { BulkMintService } from './bulk-mint.service';

@Module({
  controllers: [BulkMintController],
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
  ],
  providers: [BulkMintService],
  exports: [BulkMintService],
})
export class BulkMintModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(BulkMintController);
  }
}
