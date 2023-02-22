import { Body, Controller, Logger, Post } from '@nestjs/common';
import { IWebhook } from '@moralisweb3/streams-typings';

import { eventManager } from '../shared/utils/contract-events';
import { ContractType } from 'src/shared/types';
import { IndexerService } from 'src/indexer/indexer.service';
import { StreamEvent } from 'src/database/entities/StreamEvent';

@Controller('stream')
export class StreamController {
  logger = new Logger(StreamController.name);

  constructor(private indexer: IndexerService) {}

  @Post('market')
  async marketStream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    this.logger.log(`Stream Market:`);

    const existing = await StreamEvent.findOneBy({
      blockNumber: +body.block.number,
      txHash: body.logs[0].transactionHash,
      logIndex: +body.logs[0].logIndex,
    });

    if (existing) {
      this.logger.log('Event existing, returning earlier');
      return;
    }

    await eventManager.saveLogs(body.block, body.logs, ContractType.Market);
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

    await eventManager.saveLogs(body.block, body.logs, ContractType.Market);

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

    const existing = await StreamEvent.findOneBy({
      blockNumber: +body.block.number,
      txHash: body.logs[0].transactionHash,
      logIndex: +body.logs[0].logIndex,
    });

    if (existing) {
      this.logger.log('Event existing, returning earlier');
      return;
    }
    await eventManager.saveLogs(body.block, body.logs, ContractType.ERC721);
    this.logger.log(`Stream NFTs success: ${body.streamId}`);
    this.indexer.queueIndex();
  }
}
