import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { Currency } from './database/entities/Currency';
import { IndexerService } from './indexer/indexer.service';
import { fetchCoins } from './shared/utils/coingecko';
import { StreamService } from './stream/stream.service';

@Injectable()
export class CronService implements OnApplicationBootstrap {
  constructor(private indexer: IndexerService, private stream: StreamService) {}

  onApplicationBootstrap() {
    Logger.log('Application bootstrapped');
  }

  @Cron('*/5 * * * * *')
  handleCron() {
    if (!process.env.NO_INDEXING) {
      this.indexer.index();
    }
  }

  @Cron('*/50 * * * *')
  async fetchCoins() {
    const currencies = await Currency.find({});
    const prices = await fetchCoins(currencies.map((c) => c.coinId));

    currencies.map((c) => {
      c.usd = +prices[c.coinId].current_price;
    });
    await Currency.save(currencies);
  }
}
