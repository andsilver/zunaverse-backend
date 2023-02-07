import { forwardRef, Module } from '@nestjs/common';
import { StreamModule } from 'src/stream/stream.module';
import { IndexerService } from './indexer.service';

@Module({
  providers: [IndexerService],
  exports: [IndexerService],
  imports: [forwardRef(() => StreamModule)],
})
export class IndexerModule {}
