import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { FeaturedUser } from 'src/database/entities/FeaturedUser';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { FeaturedCollection } from 'src/database/entities/FeaturedCollection';

@Controller('admin')
export class AdminController {
  constructor(private dataSource: DataSource) {}

  @Post('users/feature')
  @UseGuards(AdminAuthGuard)
  async featureUser(@Body() { userId }: { userId: number }) {
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
  async updateFeaturedOrder(@Body() body: { id: number; order: number }[]) {
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
}
