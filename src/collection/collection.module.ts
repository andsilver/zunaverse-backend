import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { SharedModule } from 'src/shared/shared.module';
import { CollectionController } from './collection.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
    SharedModule,
  ],
  controllers: [CollectionController],
})
export class CollectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(CollectionController);
  }
}
