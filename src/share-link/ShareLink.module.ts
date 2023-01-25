import { Module } from '@nestjs/common';
import { ShareLinkController } from './ShareLink.controller';

@Module({
  controllers: [ShareLinkController],
})
export class ShareLinkModule {}
