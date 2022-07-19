import { ConfigModule } from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { User } from './entities/User';
import { Nft } from './entities/Nft';
import { Collection } from './entities/Collection';
import { Favorite } from './entities/Favorite';
import { Bid } from './entities/Bid';
import { Ask } from './entities/Ask';
import { Activity } from './entities/Activity';
import { EthBlock } from './entities/EthBlock';
import { Notification } from './entities/Notification';
import { Transaction } from './entities/Transaction';
import { Follow } from './entities/Follow';
import { Report } from './entities/Report';
import { UserBuyHistory } from './entities/UserBuyHistory';
// import { TopSeller } from './views/TopSeller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        User,
        Nft,
        Collection,
        Favorite,
        Bid,
        Ask,
        Activity,
        EthBlock,
        Notification,
        Transaction,
        Follow,
        Report,
        UserBuyHistory,
        // TopSeller,
      ],
      synchronize: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
