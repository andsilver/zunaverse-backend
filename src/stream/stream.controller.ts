import { Body, Controller, Logger, Post } from '@nestjs/common';
import { IWebhook } from '@moralisweb3/streams-typings';

import { ContractEvents } from '../shared/utils/contract-events';
import { ContractType } from 'src/shared/types';
import { IndexerService } from 'src/indexer/indexer.service';

@Controller('stream')
export class StreamController {
  logger = new Logger(StreamController.name);

  eventManager: ContractEvents;

  constructor(private indexer: IndexerService) {
    this.eventManager = new ContractEvents();
  }

  @Post('market')
  async marketStream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    this.logger.log(`Stream Market:`);

    await this.eventManager.saveLogs(
      body.block,
      body.logs,
      ContractType.Market,
    );
    this.logger.log(`Stream Market Success: ${body.streamId}`);
    this.indexer.queueIndex();
  }

  @Post('market2')
  async market2Stream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    this.logger.log(`Stream Market:`);
    console.log(body);

    await this.eventManager.saveLogs(
      body.block,
      body.logs,
      ContractType.Market,
    );

    this.logger.log(`Stream Market 2 Success: ${body.streamId}`);
    this.indexer.queueIndex();
  }

  @Post('nfts')
  async nftsStream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    this.logger.log(`Stream NFTs:`);
    console.log(body);

    await this.eventManager.saveLogs(
      body.block,
      body.logs,
      ContractType.ERC721,
    );
    this.logger.log(`Stream NFTs success: ${body.streamId}`);
    this.indexer.queueIndex();
  }
}
