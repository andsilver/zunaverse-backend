import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';

@Module({
  controllers: [RewardsController],
})
export class RewardsModule {}
