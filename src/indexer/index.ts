import { Logger } from '@nestjs/common';

import { StreamEvent } from 'src/database/entities/StreamEvent';
import { StreamService } from 'src/stream/stream.service';

export class Indexer {
  logger = new Logger(Indexer.name);
  inProgress = false;

  stream: StreamService;

  retries = 0;

  async index(stream: StreamService) {
    if (this.inProgress || this.retries === 5) {
      return;
    }
    this.stream = stream;

    try {
      this.inProgress = true;

      const events = await StreamEvent.find({
        where: {
          processed: false,
        },
        order: {
          blockNumber: 'ASC',
          logIndex: 'ASC',
        },
      });

      if (events.length) {
        this.logger.log('Indexing events');
        await this.processLogs(events);
      }
      this.retries = 0;
    } catch (err) {
      this.logger.error(err);
      this.retries += 1;
    }
    this.inProgress = false;
  }

  async processLogs(events: StreamEvent[]) {
    for (const e of events) {
      const { event, logIndex, data, address, txHash, blockTimestamp } = e;

      console.log(e);

      switch (event.name) {
        case 'Transfer':
          await this.stream.handleTransfer(
            data.tokenId,
            address,
            txHash,
            data.from,
            data.to,
            logIndex,
            blockTimestamp,
          );
          break;
        case 'BulkPriceSet':
          await this.stream.handleBulkPriceSet(data.tokenIds);
          break;
        case 'OfferAccepted':
        case 'Bought':
          const { seller, buyer, offer, tokenId } = data;

          await this.stream.handleOffer(
            tokenId,
            (data.tokenAddress || process.env.MEDIA_CONTRACT).toLowerCase(),
            txHash,
            logIndex,
            offer,
            seller.toLowerCase(),
            buyer.toLowerCase(),
          );
          break;
        case 'RemovePrice':
          await this.stream.handlePriceRemoval(data.tokenId, txHash);
          break;
        default:
          throw new Error(`Unhandled event: ${e.id}: ${event.name}`);
      }
      e.processed = true;
      await e.save();
      this.logger.log(`Indexed ${e.id}: ${event.name} - ${address}`);
    }
  }
}
