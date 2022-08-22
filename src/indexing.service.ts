import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Indexer } from './indexer';

@Injectable()
export class IndexingService implements OnApplicationBootstrap {
  indexer: Indexer;

  constructor() {
    this.indexer = new Indexer();
  }

  onApplicationBootstrap() {
    // this.indexer.indexFromStartBlock();
  }

  @Cron('*/30 * * * * *')
  handleCron() {
    this.indexer.index();
  }
}
