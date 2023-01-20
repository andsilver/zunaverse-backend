import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Currency } from './database/entities/Currency';
import { Indexer } from './indexer';
import { fetchCoins } from './shared/utils/coingecko';

@Injectable()
export class CronService implements OnApplicationBootstrap {
  indexer: Indexer;

  constructor() {
    // this.indexer = new Indexer();
  }

  onApplicationBootstrap() {
    this.fetchCoins();
  }

  // @Cron('*/10 * * * * *')
  // handleCron() {
  //   if (!process.env.NO_INDEXING) {
  //     this.indexer.index();
  //   }
  // }

  @Cron('*/30 * * * *')
  async fetchCoins() {
    const currencies = await Currency.find({});
    const prices = await fetchCoins(currencies.map((c) => c.coinId));

    currencies.map((c) => {
      c.usd = +prices[c.coinId].current_price;
    });
    await Currency.save(currencies);
  }
}
