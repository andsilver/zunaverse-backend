import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { IsNull } from 'typeorm';
import { BulkMintRequest } from 'src/database/entities/BulkMintRequest';
import { TempNft } from 'src/database/entities/TempNft';

import { QueueName } from '../queue.enum';

@Processor(QueueName.BULK_PROCESSOR)
export class BulkProcessorConsumer {
  private readonly logger = new Logger(BulkProcessorConsumer.name);

  @OnQueueActive()
  onActive(job: Job<number>) {
    this.logger.log(`Started: ${job.id}`);
  }

  @Process()
  async process(job: Job<number>) {
    const requestId = job.data;

    const [request, totalNfts, tempNfts] = await Promise.all([
      BulkMintRequest.findOneBy({ id: requestId }),
      TempNft.countBy({ requestId }),
      TempNft.find({
        where: { requestId, tokenUri: IsNull() },
        order: {
          id: 'ASC',
        },
      }),
    ]);

    if (request.status === 'init' || request.status === 'uploading') {
      if (totalNfts < request.totalNfts) {
        request.errorMessage =
          'Nfts are still in uploading or not a valid request';
        throw new Error(request.errorMessage);
      }

      if (totalNfts > request.totalNfts) {
        await request.removeRequest();
        throw new Error('Invalid minting request, removed');
      }
    }
    request.status = 'processing';
    request.errorMessage = '';
    await request.save();

    for (const tempNft of tempNfts) {
      try {
        await tempNft.pin();
      } catch (err) {
        request.errorMessage = `Failed at: ${tempNft.id}`;
        request.status = 'failed';
        await request.save();

        this.logger.error(request.errorMessage);
        console.error(err);
        throw new Error(err);
      }
    }
    request.status = 'success';
    await request.save();
  }
}
