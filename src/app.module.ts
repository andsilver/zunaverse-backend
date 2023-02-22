import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';

import { ActivityModule } from './activity/activity.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BidModule } from './bid/bid.module';
import { CollectionModule } from './collection/collection.module';
import { DatabaseModule } from './database/database.module';
import { FixService } from './fix.service';
import { CronService } from './cron.service';
import { NftModule } from './nft/nft.module';
import { NotificationModule } from './notification/notification.module';
import { PinataModule } from './pinata/pinata.module';
import { ReportModule } from './report/report.module';
import { RewardsService } from './rewards.service';
import { RewardsModule } from './rewards/rewards.module';
import { SharedModule } from './shared/shared.module';
import { StreamModule } from './stream/stream.module';
import { UserModule } from './user/user.module';
import { ShareLinkModule } from './share-link/ShareLink.module';
import { IndexerModule } from './indexer/indexer.module';
import { BulkMintModule } from './bulk-mint/bulk-mint.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UserModule,
    NftModule,
    CollectionModule,
    PinataModule,
    BidModule,
    ReportModule,
    ActivityModule,
    NotificationModule,
    RewardsModule,
    SharedModule,
    StreamModule,
    ShareLinkModule,
    IndexerModule,
    BulkMintModule,
    MulterModule.register({
      dest: process.env.UPLOAD_FOLDER,
    }),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService, CronService, FixService, RewardsService],
})
export class AppModule {}
