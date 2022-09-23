import { Controller, Get } from '@nestjs/common';
import { In } from 'typeorm';
import { Collection } from './database/entities/Collection';
import { Transaction } from './database/entities/Transaction';
import { User } from './database/entities/User';

@Controller()
export class AppController {
  @Get('health')
  healthCheck() {
    return { success: true };
  }

  @Get('home')
  async getTopSellers() {
    const [featuredUsers, sellers, buyers, collections] = await Promise.all([
      User.find({
        order: {
          id: 'asc',
        },
        take: 20,
      }),
      Transaction.createQueryBuilder('t')
        .select('SUM(usd) as amount, seller')
        .groupBy('seller')
        .orderBy('amount', 'DESC')
        .limit(20)
        .getRawMany(),
      Transaction.createQueryBuilder('t')
        .select('SUM(usd) as amount, buyer')
        .groupBy('buyer')
        .orderBy('amount', 'DESC')
        .limit(20)
        .getRawMany(),
      Collection.find({ order: { createdAt: 'ASC' }, take: 20 }),
    ]);

    const users = await User.find({
      where: {
        pubKey: In(
          [...sellers, ...buyers].map((u) =>
            (u.seller || u.buyer).toLowerCase(),
          ),
        ),
      },
    });

    return {
      featuredUsers,
      sellers: sellers.map((s) =>
        users.find((u) => u.pubKey === s.seller.toLowerCase()),
      ),
      buyers: buyers.map((s) =>
        users.find((u) => u.pubKey === s.buyer.toLowerCase()),
      ),
      collections,
    };
  }
}
