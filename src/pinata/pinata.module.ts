import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { PinataController } from './pinata.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
  ],
  controllers: [PinataController],
})
export class PinataModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(PinataController);
  }
}
