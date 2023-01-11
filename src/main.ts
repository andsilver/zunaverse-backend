// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import Moralis from 'moralis';

import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.setGlobalPrefix('/api');
  app.enableCors();

  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
