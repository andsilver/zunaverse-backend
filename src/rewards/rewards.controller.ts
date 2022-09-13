import { Controller, Get, Param, Query } from '@nestjs/common';
import { PAGINATION } from 'src/consts';
import { Nft } from 'src/database/entities/Nft';
import { Reward } from 'src/database/entities/Reward';
import { RewardDetail } from 'src/database/entities/RewardDetail';
import { Transaction } from 'src/database/entities/Transaction';
import { User } from 'src/database/entities/User';
import { Between, FindOptionsWhere, In } from 'typeorm';

@Controller('rewards')
export class RewardsController {
  @Get()
  async filterRewardsHistory(@Query() query: any) {
    const where: FindOptionsWhere<Reward> = {};

    if (query.rewardType) {
      where.rewardType = query.rewardType;
    }

    if (query.start && query.end) {
      where.createdAt = Between(new Date(query.start), new Date(query.end));
    } else if (query.start) {
      where.createdAt = Between(new Date(query.start), new Date());
    } else if (query.end) {
      where.createdAt = Between(new Date(2022, 9, 1), new Date(query.end));
    }

    const rewards = await Reward.find({
      where,
      skip: query.offset || 0,
      take: PAGINATION,
      order: {
        createdAt: 'DESC',
      },
    });
    return rewards;
  }

  @Get(':id')
  async getRewardsDetails(@Param('id') id: string) {
    const reward = await Reward.findOneBy({ id: +id });
    const details = await RewardDetail.createQueryBuilder('rd')
      .where('rd.rewardId = :id', { id })
      .leftJoinAndMapOne(
        'rd.user',
        User,
        'Users',
        'Users.pubKey ILIKE rd.userPubKey',
      )
      .leftJoinAndMapOne('rd.nft', Nft, 'n', 'n.id = rd.nftId')
      .getMany();

    if (reward.rewardType === 'buyback') {
      const transactions = await Transaction.find({
        where: {
          id: In(reward.transactionIds),
        },
      });
      return { reward, details, transactions };
    }

    return { reward, details };
  }
}
