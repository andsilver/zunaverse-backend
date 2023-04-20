import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { PAGINATION } from 'src/consts';
import { Blog } from 'src/database/entities/Blog';
import { FeaturedBlog } from 'src/database/entities/FeaturedBlog';
import { ShortLink } from 'src/database/entities/ShortLink';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { WritterAuthGuard } from 'src/shared/guards/writer-auth.guard';
import { uploadImageToCloudinary } from 'src/shared/utils/cloudinary';
import { buildPagination } from 'src/shared/utils/helper';

@Controller('blogs')
export class BlogController {
  @Get('')
  async getAll(@Query() query: any) {
    const {
      withDraft,
      featuredOnly,
      withFeature,
      exclude,
      tags,
      page,
      size,
      order,
      orderBy,
    } = query;

    const qb = Blog.createQueryBuilder('b');

    if (!withDraft) {
      qb.where('b.isDraft = false');
    }

    if (exclude) {
      qb.andWhere('b.id != :exclude', { exclude });
    }

    if (featuredOnly) {
      qb.innerJoinAndMapOne(
        'b.featured',
        FeaturedBlog,
        'fb',
        'b.id = fb.blogId',
      );
    } else if (withFeature) {
      qb.leftJoinAndMapOne(
        'b.featured',
        FeaturedBlog,
        'fb',
        'b.id = fb.blogId',
      );
    }

    if (tags) {
      qb.andWhere(`b.tags && '{${tags}}'`);
    }

    if (orderBy === 'featured') {
      qb.orderBy('fb.order', 'ASC');
    } else if (!orderBy || orderBy === 'updatedAt') {
      qb.orderBy('b.updatedAt', order || 'DESC');
    }

    const pageSize = size <= 50 ? size : PAGINATION;
    const currentPage = +(page || 1);

    const total = await qb.getCount();

    const data = await qb
      .take(PAGINATION)
      .skip((currentPage - 1) * pageSize)
      .getMany();

    return {
      data,
      pagination: buildPagination(total, currentPage),
    };
  }

  @Get(':id')
  async getBlog(@Param('id') id: string, @CurrentUser() user: User) {
    const blog = await Blog.findOneBy({ id: +id });
    const shortLink = await ShortLink.findOneBy({ blogId: blog.id });
    blog.shortLinkId = shortLink.id;

    if (blog.isDraft && !user.permission.admin && !user.permission.writer) {
      throw new UnprocessableEntityException('Blog not found');
    }
    return blog;
  }

  @Post()
  @UseGuards(WritterAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @CurrentUser() user: User,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { title, content, tags, isDraft } = body;

    if (!file) {
      throw new BadRequestException('Blog image is required');
    }
    const images = await this.uploadBlogImage(file.path);
    const blog = Blog.create({
      title,
      content,
      tags,
      isDraft,
      author: user.id,
      ...images,
    });
    await blog.save();

    await ShortLink.create({
      id: randomUUID(),
      blogId: blog.id,
    }).save();

    return blog;
  }

  @Patch(':id')
  @UseGuards(WritterAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const blog = await Blog.findOneBy({
      id: +id,
    });

    if (!blog) {
      throw new UnprocessableEntityException('Blog not found');
    }

    if (file?.path) {
      const images = await this.uploadBlogImage(file.path);
      body = {
        ...body,
        ...images,
      };
    }
    Object.assign(blog, body);

    return await blog.save();
  }

  @Delete(':id')
  @UseGuards(WritterAuthGuard)
  async remove(@Param('id') id: string) {
    await Blog.delete(+id);
    await ShortLink.delete({ blogId: +id });

    return { success: true };
  }

  private async uploadBlogImage(path: string) {
    const { secure_url: postImage } = await uploadImageToCloudinary(
      path,
      'blog',
    );
    const { secure_url: thumbnail } = await uploadImageToCloudinary(
      path,
      'blog',
      {
        crop: 'scale',
        width: 400,
      },
    );
    return { postImage, thumbnail };
  }
}
