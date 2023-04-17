import { EvmChain } from '@moralisweb3/common-evm-utils';
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import Moralis from 'moralis';
import { ILike, In } from 'typeorm';
import Web3 from 'web3';

import { Ask } from './database/entities/Ask';
import { Bid } from './database/entities/Bid';
import { Collection } from './database/entities/Collection';
import { Currency } from './database/entities/Currency';
import { Favorite } from './database/entities/Favorite';
import { Follow } from './database/entities/Follow';
import { Nft } from './database/entities/Nft';
import { Transaction } from './database/entities/Transaction';
import { User } from './database/entities/User';
import { SearchView } from './database/views/Search';
import { UserSellAmountView } from './database/views/UserSellAmount';
import { CurrentUser } from './shared/decorators/current-user.decorator';
import { fromWei } from './shared/utils/currency';
import { FavCollection } from './database/entities/FavCollection';
import { FeaturedUser } from './database/entities/FeaturedUser';
import { FeaturedCollection } from './database/entities/FeaturedCollection';

@Controller()
export class AppController {
  @Get('health')
  healthCheck() {
    return { success: true };
  }

  @Get('home')
  async getHomeData(@CurrentUser() user: User) {
    const nftFilterQb = Nft.createQueryBuilder('n')
      .innerJoinAndMapOne('n.owner', User, 'u', 'u.id = n.ownerId')
      .leftJoinAndMapOne(
        'n.currentAsk',
        Ask,
        'a',
        'a.tokenId = n.tokenId AND a.tokenAddress = n.tokenAddress',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f.id)', 'favorites')
            .from(Favorite, 'f')
            .where('f.tokenId = n.tokenId AND f.tokenAddress = n.tokenAddress'),
        'favorites',
      )
      .orderBy('favorites', 'DESC')
      .limit(20);

    const [featuredUsers, featuredCollections, nfts] = await Promise.all([
      FeaturedUser.createQueryBuilder('fu')
        .innerJoinAndMapOne('fu.user', User, 'u', 'u.id = fu.userId')
        .leftJoinAndMapOne(
          'u.sold',
          UserSellAmountView,
          't',
          't.seller = u.pubKey',
        )
        .addSelect(
          (sub) =>
            sub
              .select('COUNT(f.id)', 'followers')
              .from(Follow, 'f')
              .where('f.user = u.pubKey'),
          'followers',
        )
        .addSelect(
          (sub) =>
            sub
              .select('COUNT(id)', 'creates')
              .from(Nft, 'n')
              .where('n.creatorId = u.id'),
          'creates',
        )
        .addSelect(
          user
            ? (sub) =>
                sub
                  .select('COUNT(id)', 'following')
                  .from(Follow, 'f')
                  .where('u.pubKey = f.user AND f.followee = :address', {
                    address: user.pubKey,
                  })
            : ('0' as any),
          'following',
        )
        .orderBy('fu.order', 'ASC')
        .getRawAndEntities(),
      FeaturedCollection.createQueryBuilder('fc')
        .innerJoinAndMapOne(
          'fc.collection',
          Collection,
          'c',
          'fc.collectionId = c.id',
        )
        .innerJoinAndMapOne('c.owner', User, 'u', 'u.id = c.ownerId')
        .orderBy('fc.order', 'ASC')
        .getMany(),
      user
        ? nftFilterQb
            .addSelect(
              (sub) =>
                sub
                  .select('COUNT(f.id)', 'favorited')
                  .from(Favorite, 'f')
                  .where(
                    'f.tokenId = n.tokenId AND f.tokenAddress = n.tokenAddress AND f.userAddress = :address',
                    {
                      address: user.pubKey,
                    },
                  ),
              'favorited',
            )
            .getRawAndEntities()
        : nftFilterQb.getRawAndEntities(),
    ]);
    const collections = featuredCollections.map((fc) => fc.collection);

    if (user) {
      const favorited = await FavCollection.findOneBy({
        userAddress: user.pubKey,
        collectionId: collections[0].id,
      });
      collections[0].favorited = !!favorited;
    }

    return {
      featuredUsers: featuredUsers.entities.map((u, index) => ({
        ...u.user,
        followers: +featuredUsers.raw[index].followers,
        following: Boolean(+featuredUsers.raw[index].following),
        creates: +featuredUsers.raw[index].creates,
      })),
      collections,
      popularNfts: nfts.entities.map((n, index) => ({
        ...n,
        favorites: +nfts.raw[index].favorites,
        favorited: !!nfts.raw[index].favorited,
      })),
    };
  }

  @Get('top-creators')
  async getTopCreators(@CurrentUser() user: User) {
    const res = await User.createQueryBuilder('u')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(id)', 'creates')
            .from(Nft, 'n')
            .where('n.creatorId = u.id'),
        'creates',
      )
      .addSelect(
        user
          ? (sub) =>
              sub
                .select('COUNT(id)', 'following')
                .from(Follow, 'f')
                .where('u.pubKey = f.user AND f.followee = :address', {
                  address: user.pubKey,
                })
          : ('0' as any),
        'following',
      )
      .orderBy('creates', 'DESC')
      .limit(5)
      .getRawAndEntities();

    return res.entities.map((u, index) => ({
      ...u,
      followers: +res.raw[index].followers,
      following: Boolean(+res.raw[index].following),
      creates: +res.raw[index].creates,
    }));
  }

  @Get('new-listings')
  async getNewListings() {
    const res = await Nft.createQueryBuilder('n')
      .innerJoinAndMapOne('n.owner', User, 'u', 'u.id = n.ownerId')
      .innerJoinAndMapOne('n.currentAsk', Ask, 'a', 'a.id = n.currentAskId')
      .limit(5)
      .orderBy('a.updatedAt', 'DESC')
      .getMany();

    return res;
  }

  @Get('top-sellers')
  async getTopSellers(@Query() query: any) {
    const { currency } = query;
    const c = await Currency.findOneBy({
      symbol: currency,
    });

    if (!c) {
      throw new UnprocessableEntityException('Currency does not exist');
    }
    const sellers = await Transaction.createQueryBuilder('t')
      .where('currency = :currency', { currency: c.address })
      .select('SUM(amount) as amount, SUM(usd) as usd, seller')
      .groupBy('seller')
      .leftJoinAndMapOne('t.user', User, 'u', 'u.pubKey = t.seller')
      .orderBy('amount', 'DESC')
      .limit(20)
      .getRawMany();

    const users = await User.find({
      where: {
        pubKey: In(sellers.map((u) => u.seller.toLowerCase())),
      },
    });

    return sellers.map((s) => ({
      ...users.find((u) => u.pubKey === s.seller.toLowerCase()),
      ...s,
    }));
  }

  @Get('top-buyers')
  async getTopBuyers(@Query() query: any) {
    const { currency } = query;

    const c = await Currency.findOneBy({
      symbol: currency,
    });

    if (!c) {
      throw new UnprocessableEntityException('Currency does not exist');
    }
    const buyers = await Transaction.createQueryBuilder('t')
      .where('currency = :currency', { currency: c.address })
      .select('SUM(amount) as amount, SUM(usd) as usd, buyer')
      .groupBy('buyer')
      .orderBy('amount', 'DESC')
      .limit(20)
      .getRawMany();

    const users = await User.find({
      where: {
        pubKey: In(buyers.map((u) => u.buyer.toLowerCase())),
      },
    });

    return buyers.map((s) => ({
      ...users.find((u) => u.pubKey === s.buyer.toLowerCase()),
      ...s,
    }));
  }

  @Get('currencies')
  async getCurrencies() {
    return await Currency.find({});
  }

  @Get('search')
  async search(@Query() query: any) {
    const { text } = query;

    if (!text || text.length < 2) {
      throw new BadRequestException('At least needs 2 characters');
    }
    if (Web3.utils.isAddress(text)) {
      return await SearchView.find({
        where: {
          address: text.toLowerCase(),
        },
        take: 6,
      });
    }

    const items = await Promise.all(
      ['nft', 'user', 'collection'].map((category) =>
        SearchView.find({
          where: [
            {
              name: ILike(`%${text}%`),
              category,
            },
            {
              description: ILike(`%${text}%`),
              category,
            },
          ],
          take: 6,
        }),
      ),
    );
    return items.reduce((result, entities) => [...result, ...entities], []);
  }

  @Get('/check-allowances')
  async checkAllownaces() {
    const users = await User.find();
    const coins = await Currency.find();

    for (const user of users) {
      const r: any = {
        user: user.pubKey,
        coins: [],
      };
      const allowances = await Promise.all(
        coins.map((c) =>
          Moralis.EvmApi.token.getTokenAllowance({
            chain: EvmChain.BSC,
            address: c.address,
            ownerAddress: user.pubKey,
            spenderAddress: process.env.MARKET_CONTRACT,
          }),
        ),
      );
      await new Promise((r) => setTimeout(r, 500));
      const balance = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: user.pubKey,
        chain: EvmChain.BSC,
        tokenAddresses: coins.map((c) => c.address),
      });

      r.coins = coins
        .map((coin, index) => {
          const allowance = fromWei(
            allowances[index].toJSON().allowance,
            coin.decimals,
          );
          const b = balance
            .toJSON()
            .find(
              (tb) =>
                tb.token_address.toLowerCase() === coin.address.toLowerCase(),
            );

          if (!b) {
            return null;
          }
          const tokenBalance = fromWei(b.balance, b.decimals);
          const tbusd = +tokenBalance * coin.usd;

          if (+allowance === 0) {
            return null;
          }
          return {
            token: coin.symbol,
            allowance,
            balance: tbusd,
          };
        })
        .filter(Boolean);

      if (r.coins.length) {
        console.log(`User: ${user.pubKey}`);
        console.log(r);
      }
    }
  }
}
