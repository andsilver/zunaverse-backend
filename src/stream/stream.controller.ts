import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { IWebhook } from '@moralisweb3/streams-typings';

import { eventManager } from '../shared/utils/contract-events';
import { IndexerService } from 'src/indexer/indexer.service';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { IndexDto } from 'src/bulk-mint/bulk-mint.dto';

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
    console.log(body);

    if (await eventManager.saveLogs(body.block, body.logs)) {
      this.logger.log(`Stream Market Success: ${body.streamId}`);
      this.indexer.queueIndex();
    } else {
      this.logger.log('Already existing');
    }
  }

  @Post('market2')
  async market2Stream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    this.logger.log(`Stream Market:`);
    console.log(body);

    if (await eventManager.saveLogs(body.block, body.logs)) {
      this.logger.log(`Stream Market 2 Success: ${body.streamId}`);
      this.indexer.queueIndex();
    } else {
      this.logger.log('Already existing');
    }
  }

  @Post('nfts')
  async nftsStream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    this.logger.log(`Stream NFTs:`);
    console.log(body);

    if (await eventManager.saveLogs(body.block, body.logs)) {
      this.logger.log(`Stream NFTs success: ${body.streamId}`);
      this.indexer.queueIndex();
    } else {
      this.logger.log('Already existing');
    }
  }

  @Post('add')
  @UseGuards(AuthGuard)
  async addStreamEvent(@Body() body: IndexDto) {
    const { block, logs } = body;

    this.logger.log('Adding stream:');
    console.log(body);

    if (await eventManager.saveLogs(block, logs)) {
      this.logger.log('Added stream.');
      this.indexer.queueIndex();
    } else {
      this.logger.log('Already existing');
    }
  }
}
