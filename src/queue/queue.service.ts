import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';

import { INftPin } from './consumers/nft_pin.interface';
import { QueueName } from './queue.enum';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QueueName.NFT_PIN) private nftPinQueue: Queue<INftPin>,
    @InjectQueue(QueueName.BULK_PROCESSOR)
    private bulkProcessQueue: Queue<number>,
  ) {}

  async processBulkMint(requestId: number) {
    return await this.bulkProcessQueue.add(requestId, {
      jobId: requestId,
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  async pinNft(nft: INftPin) {
    return await this.nftPinQueue.add(nft, {
      jobId: nft.tokenId,
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }
}
