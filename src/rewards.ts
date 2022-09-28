// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './app.module';
import { RewardsService } from './rewards.service';

async function bootstrap() {
  NestFactory.createApplicationContext(AppModule).then((appContext) => {
    const rewardsHandler = appContext.get(RewardsService);
    Logger.log('Started Reward...');
    rewardsHandler
      .releaseBuybackRewards()
      .then(() => Logger.log('Finished'))
      .catch((err) => Logger.error(err, 'Failed!'))
      .finally(() => {
        appContext.close();
      });
  });
}
bootstrap();
