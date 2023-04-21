import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { SharedModule } from 'src/shared/shared.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
    SharedModule,
  ],
  controllers: [AdminController],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(AdminController);
  }
}
