import { OnQueueActive, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BulkMintRequest } from 'src/database/entities/BulkMintRequest';

import { TempNft } from 'src/database/entities/TempNft';
import { QueueName } from '../queue.enum';
import { INftPin } from './nft_pin.interface';

@Processor(QueueName.NFT_PIN)
export class NftPinConsumer {
  private readonly logger = new Logger(NftPinConsumer.name);

  @OnQueueActive()
  onActive(job: Job<INftPin>) {
    this.logger.log(`Started: ${job.id}`);
  }

  @Process()
  async process(job: Job<INftPin>) {
    const { tokenId } = job.data;

    const nft = await TempNft.findOneBy({ tokenId });

    if (!nft) {
      this.logger.log(`Temp nft: ${nft.tokenId} does not exist`);
      return;
    }
    await nft.pin();
  }

  @OnQueueFailed()
  async onError(job: Job<INftPin>, err: Error) {
    this.logger.error(`Failed at: ${job.id}`);
    console.error(job.data);
    console.error(err);

    const { requestId } = job.data;

    const req = await BulkMintRequest.findOneBy({ id: requestId });

    req.status = 'failed';
    await req.save();
  }
}
