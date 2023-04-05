import { Controller, Get, Query } from '@nestjs/common';
import { ACTIVITY_EVENTS, PAGINATION } from 'src/consts';
import { Activity } from 'src/database/entities/Activity';
import { Nft } from 'src/database/entities/Nft';
import { User } from 'src/database/entities/User';
import { buildPagination } from 'src/shared/utils/helper';

@Controller('activities')
export class ActivityController {
  @Get()
  async filterActivities(@Query() query: any) {
    const { categories, collectionId, order, orderBy, page, size } = query;
    const address = query.address
      ? (query.address as string).toLowerCase()
      : '';

    let qb = Activity.createQueryBuilder('a')
      .innerJoinAndMapOne('a.user', User, 'u1', 'u1.pubKey = a.userAddress')
      .leftJoinAndMapOne('a.receiver', User, 'u2', 'u2.pubKey = a.receiver')
      .leftJoinAndMapOne(
        'a.nft',
        Nft,
        'n',
        'n.tokenId = a.tokenId AND n.tokenAddress = a.tokenAddress',
      )
      .innerJoinAndMapOne('n.owner', User, 'u3', 'u3.id = n.ownerId')
      .orderBy(`a.${orderBy || 'createdAt'}`, order || 'DESC');

    if (address) {
      qb = qb.where('(a.userAddress = :address OR a.receiver = :address)', {
        address,
      });
    }

    if (collectionId) {
      qb = qb.andWhere('a.collectionId = :collectionId', { collectionId });
    }

    if (categories) {
      const events = [];

      for (const c of categories.split(',')) {
        if (typeof ACTIVITY_EVENTS[c] === 'string') {
          events.push(ACTIVITY_EVENTS[c]);
        } else {
          events.push(...Object.values(ACTIVITY_EVENTS[c]));
        }
      }

      qb = qb.andWhere('a.event IN (:...events)', { events });
    }

    const pageSize = +size || PAGINATION;
    const currentPage = +(page || 1);
    const total = await qb.getCount();
    const data = await qb
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { data, pagination: buildPagination(total, currentPage, pageSize) };
  }
}
