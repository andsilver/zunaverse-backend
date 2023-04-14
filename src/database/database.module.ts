import fs from 'fs';
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
import { Notification } from './entities/Notification';
import { Transaction } from './entities/Transaction';
import { Follow } from './entities/Follow';
import { Report } from './entities/Report';
import { UserBuyHistory } from './entities/UserBuyHistory';
import { Reward } from './entities/Reward';
import { RewardDetail } from './entities/RewardDetail';
import { Currency } from './entities/Currency';
import { ShortLink } from './entities/ShortLink';
import { StreamEvent } from './entities/StreamEvent';
import { TempNft } from './entities/TempNft';
import { BulkMintRequest } from './entities/BulkMintRequest';
import { SearchView } from './views/Search';
import { FavCollection } from './entities/FavCollection';
import { CollectionCurrencyView } from './views/CollectionCurrency';
import { UserCategoryView } from './views/UserCategory';
import { UserCurrencyView } from './views/UserCurrency';
import { UserSellAmountView } from './views/UserSellAmount';
import { Showcase } from './entities/Showcase';

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
      ssl:
        process.env.NODE_ENV == 'production'
          ? {
              ca: fs.readFileSync(process.env.DB_CERT_PATH).toString(),
            }
          : false,
      entities: [
        User,
        Nft,
        Collection,
        Favorite,
        Bid,
        Ask,
        Activity,
        Notification,
        Transaction,
        Follow,
        Report,
        UserBuyHistory,
        Reward,
        RewardDetail,
        Currency,
        ShortLink,
        StreamEvent,
        TempNft,
        BulkMintRequest,
        SearchView,
        FavCollection,
        CollectionCurrencyView,
        UserCategoryView,
        UserCurrencyView,
        UserSellAmountView,
        Showcase,
      ],
      synchronize: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
