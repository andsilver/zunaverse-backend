import { Module } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';
import { MoralisService } from './services/moralis.service';

@Module({
  providers: [CloudinaryService, MoralisService],
  exports: [CloudinaryService, MoralisService],
})
export class SharedModule {}
