import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import { FeaturedUser } from 'src/database/entities/FeaturedUser';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { FeaturedCollection } from 'src/database/entities/FeaturedCollection';
import { User } from 'src/database/entities/User';
import { UserPermission } from 'src/database/entities/UserPermission';
import { UserCategoryView } from 'src/database/views/UserCategory';
import { Currency } from 'src/database/entities/Currency';
import { UserCurrencyView } from 'src/database/views/UserCurrency';
import { PAGINATION } from 'src/consts';
import { buildPagination } from 'src/shared/utils/helper';
import { UserSellAmountView } from 'src/database/views/UserSellAmount';
import { Nft } from 'src/database/entities/Nft';
import { Follow } from 'src/database/entities/Follow';
import { FeaturedBlog } from 'src/database/entities/FeaturedBlog';

@Controller('admin')
export class AdminController {
  constructor(private dataSource: DataSource) {}

  @Get('users')
  @UseGuards(AdminAuthGuard)
  async getUsers(@Query() query: any) {
    const {
      page,
      orderBy,
      category,
      search,
      currency,
      featured,
      featuredOnly,
      size,
    } = query;

    const qb = User.createQueryBuilder('u')
      .leftJoinAndSelect('u.permission', 'p')
      .leftJoinAndMapOne(
        'u.sold',
        UserSellAmountView,
        't',
        't.seller = u.pubKey',
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
        (sub) =>
          sub
            .select('COUNT(id)', 'followers')
            .from(Follow, 'f')
            .where('u.pubKey = f.user'),
        'followers',
      );

    if (search) {
      qb.where('(u.name ILIKE :search OR u.pubKey ILIKE :search)', { search });
    }

    if (category) {
      qb.innerJoin(UserCategoryView, 'uc', 'u.id = uc.id').andWhere(
        `uc.categories && '{${category.toLowerCase()}}' = true`,
      );
    }

    if (currency) {
      const currencies = await Currency.findBy({
        symbol: In(currency.split(',')),
      });
      qb.innerJoin(UserCurrencyView, 'ucv', 'ucv.id = u.id').andWhere(
        `ucv.currency && '{${currencies
          .map((c) => c.address)
          .join(',')}}' = true`,
      );
    }
    const currentPage = +(page || 1);
    const total = await qb.getCount();

    if (featured || featuredOnly) {
      if (featuredOnly) {
        qb.innerJoinAndMapOne(
          'u.featured',
          FeaturedUser,
          'fu',
          'fu.userId = u.id',
        );
      } else {
        qb.leftJoinAndMapOne(
          'u.featured',
          FeaturedUser,
          'fu',
          'fu.userId = u.id',
        );
      }
    }

    if (orderBy === 'creations') {
      qb.orderBy('creates', 'DESC');
    } else if (orderBy === 'followers') {
      qb.orderBy('followers', 'DESC');
    } else if (orderBy === 'featured') {
      qb.orderBy('fu.order', 'ASC');
    } else {
      qb.orderBy('t.amount', 'DESC', 'NULLS LAST');
    }

    const pageSize = size <= 50 ? size : PAGINATION;

    const { entities, raw } = await qb
      .take(pageSize)
      .skip((currentPage - 1) * pageSize)
      .getRawAndEntities();

    return {
      data: entities.map((e, index) => ({
        ...e,
        followers: +raw[index].followers,
        following: Boolean(+raw[index].following),
        creates: +raw[index].creates,
      })),
      pagination: buildPagination(total, currentPage),
    };
  }

  @Post('users/:id')
  @UseGuards(AdminAuthGuard)
  async updateUser(@Param('id') userId: string, @Body() body: any) {
    const user = await User.findOne({
      where: {
        id: +userId,
      },
      relations: {
        permission: true,
      },
    });

    if (!user) {
      throw new UnprocessableEntityException('User not found');
    }

    if (!user.permission) {
      user.permission = new UserPermission();
    }
    user.permission.admin = !!body.admin;
    user.permission.writer = !!body.writer;

    await user.save();

    return user;
  }

  @Post('users/:id/feature')
  @UseGuards(AdminAuthGuard)
  async featureUser(@Param('id', { transform: (v) => +v }) userId: number) {
    const featured = await FeaturedUser.findOneBy({
      userId,
    });

    if (featured) {
      return await featured.remove();
    }
    const last = await FeaturedUser.findOne({
      where: {},
      order: {
        order: 'DESC',
      },
    });
    const order = (last ? last.order : 0) + 1;

    return await FeaturedUser.create({
      userId,
      order,
    }).save();
  }

  @Patch('users/feature')
  @UseGuards(AdminAuthGuard)
  async updateFeaturedUsersOrder(
    @Body() body: { id: number; order: number }[],
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const e of body) {
        await queryRunner.manager.update(
          FeaturedUser,
          { id: e.id },
          { order: e.order },
        );
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.error(err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return { success: true };
  }

  @Post('collections/feature')
  @UseGuards(AdminAuthGuard)
  async featureCollection(@Body() { collectionId }: { collectionId: number }) {
    const featured = await FeaturedCollection.findOneBy({
      collectionId,
    });

    if (featured) {
      return await featured.remove();
    }
    const last = await FeaturedCollection.findOne({
      where: {},
      order: {
        order: 'DESC',
      },
    });
    const order = (last ? last.order : 0) + 1;

    return await FeaturedCollection.create({
      collectionId,
      order,
    }).save();
  }

  @Patch('collections/feature')
  @UseGuards(AdminAuthGuard)
  async updateFeaturedCollectionOrder(
    @Body() body: { id: number; order: number }[],
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const e of body) {
        await queryRunner.manager.update(
          FeaturedCollection,
          { id: e.id },
          { order: e.order },
        );
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.error(err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return { success: true };
  }

  @Post('blogs/feature')
  @UseGuards(AdminAuthGuard)
  async featureBlog(@Body() { blogId }: { blogId: number }) {
    const featured = await FeaturedBlog.findOneBy({
      blogId,
    });

    if (featured) {
      return await featured.remove();
    }
    const last = await FeaturedBlog.findOne({
      where: {},
      order: {
        order: 'DESC',
      },
    });
    const order = (last ? last.order : 0) + 1;

    return await FeaturedBlog.create({
      blogId,
      order,
    }).save();
  }

  @Patch('blogs/feature')
  @UseGuards(AdminAuthGuard)
  async updateFeaturedBlogOrder(@Body() body: { id: number; order: number }[]) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const e of body) {
        await queryRunner.manager.update(
          FeaturedBlog,
          { id: e.id },
          { order: e.order },
        );
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.error(err);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return { success: true };
  }
}
