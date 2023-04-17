import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { In } from 'typeorm';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { join } from 'path';

import { PAGINATION } from 'src/consts';
import { Collection } from 'src/database/entities/Collection';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { CloudinaryService } from 'src/shared/services/cloudinary.service';
import {
  uploadBannerImageCloudinary,
  uploadImageCloudinary,
} from 'src/shared/utils/cloudinary';
import { ShortLink } from 'src/database/entities/ShortLink';
import { BulkMintRequest } from 'src/database/entities/BulkMintRequest';
import { FavCollection } from 'src/database/entities/FavCollection';
import { buildPagination } from 'src/shared/utils/helper';
import { CollectionCurrencyView } from 'src/database/views/CollectionCurrency';
import { Currency } from 'src/database/entities/Currency';
import { FeaturedCollection } from 'src/database/entities/FeaturedCollection';

@Controller('collection')
export class CollectionController {
  constructor(private cloudinary: CloudinaryService) {}

  @Post('')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'image' }, { name: 'banner' }]),
  )
  @UseGuards(AuthGuard)
  async createCollection(
    @Body() body: any,
    @CurrentUser() user: User,
    @UploadedFiles()
    files: { image: Express.Multer.File[]; banner: Express.Multer.File[] },
  ) {
    const { image, banner } = files;

    if (image) {
      const { secure_url } = await this.cloudinary.uploadImageCloudinary(
        image[0].path,
        200,
      );
      body.image = secure_url;
    }

    if (banner) {
      const { secure_url } = await this.cloudinary.uploadBannerImageCloudinary(
        banner[0].path,
      );
      body.banner = secure_url;
    }

    const collection = Collection.create(body);
    collection.owner = user;
    await collection.save();

    await ShortLink.create({
      id: randomUUID(),
      collectionId: collection.id,
    }).save();

    return collection;
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'image' }, { name: 'banner' }]),
  )
  @UseGuards(AuthGuard)
  async updatecollection(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: User,
    @UploadedFiles()
    files: { image: Express.Multer.File[]; banner: Express.Multer.File[] },
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

    const { image, banner } = files;

    if (image) {
      const { secure_url } = await uploadImageCloudinary(image[0].path, 200);
      collection.image = secure_url;
    }

    if (banner) {
      const { secure_url } = await uploadBannerImageCloudinary(banner[0].path);
      collection.banner = secure_url;
    }

    const { name, description, category, twitter, website, instagram } = body;

    name && (collection.name = name);
    description && (collection.description = description);
    category && (collection.category = category);
    twitter && (collection.twitter = twitter);
    website && (collection.website = website);
    instagram && (collection.instagram = instagram);

    await collection.save();

    return { success: true };
  }

  @Get('download-csv')
  async downloadCSV(@Res() res: Response) {
    res.setHeader('content-type', 'text/csv');
    res.send(readFileSync(join(process.env.UPLOAD_FOLDER, 'Bulk Imports.csv')));
  }

  @Get(':id')
  async getCollection(@Param('id') id: number, @CurrentUser() user: User) {
    const collectionId = +id;

    const [collection, shortLink, favorites, favorited] = await Promise.all([
      Collection.findOne({
        where: { id: collectionId },
        relations: ['owner'],
      }),
      ShortLink.findOneBy({
        collectionId,
      }),
      FavCollection.countBy({
        collectionId,
      }),
      user
        ? FavCollection.findOneBy({ collectionId, userAddress: user.pubKey })
        : Promise.resolve(null),
    ]);
    collection.shortLink = shortLink;
    collection.favorites = favorites;
    collection.favorited = !!favorited;
    return collection;
  }

  @Post(':id/favorite')
  @UseGuards(AuthGuard)
  async favoriteCollection(@CurrentUser() user: User, @Param('id') id: string) {
    const fav = await FavCollection.findOneBy({
      collectionId: +id,
      userAddress: user.pubKey,
    });

    if (fav) {
      await fav.remove();
    } else {
      await FavCollection.create({
        collectionId: +id,
        userAddress: user.pubKey,
      }).save();
    }
    return { success: true };
  }

  @Get('')
  async getCollections(@Query() query: any) {
    const {
      page,
      owner,
      orderBy,
      category,
      search,
      currency,
      order,
      featuredOnly,
      featured,
    } = query;

    const qb = Collection.createQueryBuilder('c').innerJoinAndMapOne(
      'c.owner',
      User,
      'u',
      'u.id = c.ownerId',
    );

    if (owner) {
      qb.where('u.pubKey = :pubKey', {
        pubKey: owner.toLowerCase(),
      });
    }

    if (category) {
      qb.andWhere('c.category IN (:...category)', {
        category: category.split(','),
      });
    }

    if (search) {
      qb.andWhere('c.name ILIKE :search', { search: `%${search}%` });
    }

    if (currency) {
      const currencies = await Currency.findBy({
        symbol: In(currency.split(',')),
      });
      qb.innerJoin(CollectionCurrencyView, 'cc', 'cc.id = c.id').andWhere(
        `cc.currency && '{${currencies
          .map((c) => c.address)
          .join(',')}}' = true`,
      );
    }

    if (featured || featuredOnly) {
      if (featuredOnly) {
        qb.innerJoinAndMapOne(
          'c.featured',
          FeaturedCollection,
          'fc',
          'fc.collectionId = c.id',
        );
      } else {
        qb.leftJoinAndMapOne(
          'c.featured',
          FeaturedCollection,
          'fc',
          'fc.collectionId = c.id',
        );
      }
    }
    const currentPage = +(page || 1);
    const total = await qb.getCount();

    if (orderBy === 'popular') {
      qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(f.id)', 'popular')
            .from(FavCollection, 'f')
            .where('c.id = f.collectionId'),
        'popular',
      ).orderBy('popular', 'DESC');
    } else if (orderBy === 'volume') {
      qb.orderBy('c.totalVolume', 'DESC');
    } else if (orderBy === 'createdAt') {
      qb.orderBy('c.createdAt', order || 'DESC');
    } else if (orderBy === 'featured') {
      qb.orderBy('fc.order', 'ASC');
    }
    const data = await qb
      .take(PAGINATION)
      .skip((currentPage - 1) * PAGINATION)
      .getMany();

    return {
      data,
      pagination: buildPagination(total, currentPage),
    };
  }

  @Post(':id/bulk-mint/request')
  @UseGuards(AuthGuard)
  async bulkMintRequest(
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

    const { totalNfts } = body;

    const req = await BulkMintRequest.create({
      totalNfts,
      userId: user.id,
      collectionId: collection.id,
    }).save();

    return req;
  }

  @Get(':id/bulk-mints')
  @UseGuards(AuthGuard)
  async getBulkImports(@Param('id') id: string) {
    const requests = await BulkMintRequest.find({
      where: {
        collectionId: +id,
      },
      order: {
        createdAt: 'DESC',
      },
    });
    return requests;
  }
}
