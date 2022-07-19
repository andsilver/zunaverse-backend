import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { PAGINATION } from 'src/consts';
import { Collection } from 'src/database/entities/Collection';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { ILike } from 'typeorm';

@Controller('collection')
export class CollectionController {
  @Post('')
  @UseGuards(AuthGuard)
  async createCollection(@Body() body: any, @CurrentUser() user: User) {
    const collection = Collection.create(body);
    collection.owner = user;
    await collection.save();
    return collection;
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async updatecollection(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: User,
  ) {
    const collection = await Collection.findOne({
      where: { id: +id },
      relations: ['owner'],
    });

    if (!collection) {
      throw new UnprocessableEntityException('Collection not found');
    }

    if (collection.owner.id !== user.id) {
      throw new ForbiddenException('Only owners can update their collections');
    }

    await Collection.update(id, body);

    return { success: true };
  }

  @Get(':id')
  async getCollection(@Param('id') id: number) {
    return await Collection.findOne({ where: { id }, relations: ['owner'] });
  }

  @Get('')
  async getCollections(@Query() query: any) {
    const { offset, owner } = query;

    return await Collection.find({
      where: owner
        ? {
            owner: {
              pubKey: ILike(owner),
            },
          }
        : {},
      take: PAGINATION,
      skip: +offset || 0,
      relations: ['owner'],
    });
  }
}
