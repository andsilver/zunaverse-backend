import { Controller, Get, Query } from '@nestjs/common';
import { In, IsNull, Not } from 'typeorm';
import { Collection } from './database/entities/Collection';
import { Currency } from './database/entities/Currency';
import { Transaction } from './database/entities/Transaction';
import { User } from './database/entities/User';

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
    const currencies = {
      WBNB: process.env.WBNB_ADDRESS,
      ZUNA: process.env.ZUNA_ADDRESS,
    };
    const sellers = await Transaction.createQueryBuilder('t')
      .where('currency = :currency', { currency: currencies[currency] })
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
    const currencies = {
      WBNB: process.env.WBNB_ADDRESS,
      ZUNA: process.env.ZUNA_ADDRESS,
    };
    const buyers = await Transaction.createQueryBuilder('t')
      .where('currency = :currency', { currency: currencies[currency] })
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
}
