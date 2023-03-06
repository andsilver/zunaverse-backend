import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ILike, In, IsNull, Not } from 'typeorm';
import Web3 from 'web3';
import { Collection } from './database/entities/Collection';
import { Currency } from './database/entities/Currency';
import { Transaction } from './database/entities/Transaction';
import { User } from './database/entities/User';
import { SearchView } from './database/views/Search';

@Controller()
export class AppController {
  @Get('health')
  healthCheck() {
    return { success: true };
  }

  @Get('home')
  async getHomeData() {
    const [featuredUsers, collections] = await Promise.all([
      User.find({
        order: {
          featured: 'desc',
          id: 'asc',
        },
        take: 20,
        where: {
          avatar: Not(IsNull()),
        },
      }),
      Collection.find({
        where: {
          featured: true,
        },
        order: { order: 'ASC', createdAt: 'ASC' },
        relations: ['owner'],
        take: 20,
      }),
    ]);

    for (const collection of collections) {
      await collection.loadPostImages();
    }

    return {
      featuredUsers,
      collections,
    };
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
}
