import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { BulkProcessorConsumer } from './consumers/bulk_processor.consumer';
import { QueueName } from './queue.enum';
import { QueueService } from './queue.service';

@Module({
  providers: [QueueService, BulkProcessorConsumer],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.NFT_PIN,
      },
      {
        name: QueueName.BULK_PROCESSOR,
      },
    ),
  ],
  exports: [QueueService],
})
export class QueueModule {}
