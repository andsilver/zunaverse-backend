import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthMiddleware } from 'src/auth/auth.middleware';
import { SharedModule } from 'src/shared/shared.module';
import { BlogController } from './blog.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
    SharedModule,
  ],
  controllers: [BlogController],
})
export class BlogModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(BlogController);
  }
}
