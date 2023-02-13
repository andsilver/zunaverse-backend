// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import Moralis from 'moralis';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));
  app.setGlobalPrefix('/api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
