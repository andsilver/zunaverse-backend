import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { UserController } from './user.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
  ],
  controllers: [UserController],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(UserController);
  }
}
