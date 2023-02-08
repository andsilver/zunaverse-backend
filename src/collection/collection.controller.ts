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
import { FindOptionsWhere, ILike } from 'typeorm';
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
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { join } from 'path';

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
      body.image = secure_url;
    }

    if (banner) {
      const { secure_url } = await uploadBannerImageCloudinary(banner[0].path);
      body.banner = secure_url;
    }

    const { name, description, category } = body;

    name && (collection.name = name);
    description && (collection.description = description);
    category && (collection.category = category);

    console.log(collection);

    await collection.save();

    return { success: true };
  }

  @Get('download-csv')
  async downloadCSV(@Res() res: Response) {
    res.setHeader('content-type', 'text/csv');
    res.send(readFileSync(join(process.env.UPLOAD_FOLDER, 'Bulk Imports.csv')));
  }

  @Get(':id')
  async getCollection(@Param('id') id: number) {
    const collection = await Collection.findOne({
      where: { id },
      relations: ['owner'],
    });
    const shortLink = await ShortLink.findOneBy({
      collectionId: collection.id,
    });
    collection.shortLink = shortLink;
    return collection;
  }

  @Get('')
  async getCollections(@Query() query: any) {
    const { offset, owner, orderBy, order, category, search } = query;

    const where: FindOptionsWhere<Collection> = {};

    if (owner) {
      where.owner = {
        pubKey: ILike(owner),
      };
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const collections = await Collection.find({
      where,
      take: PAGINATION,
      skip: +offset || 0,
      relations: ['owner'],
      order: {
        [orderBy || 'createdAt']: order || 'ASC',
      },
    });

    for (const collection of collections) {
      await collection.loadPostImages();
    }

    return collections;
  }
}
