// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from './app.module';
import { FixService } from './fix.service';

async function bootstrap() {
  NestFactory.createApplicationContext(AppModule).then((appContext) => {
    const fixer = appContext.get(FixService);
    Logger.log('Started...');
    // fixer
    //   .updateUSD()
    //   .then(() => Logger.log('Finished'))
    //   .catch((err) => Logger.error(err, 'Failed!'))
    //   .finally(() => {
    //     appContext.close();
    //   });
  });
}
bootstrap();
