import {
  Body,
  Controller,
  Delete,
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
import { Resource } from 'src/database/entities/Resource';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { WritterAuthGuard } from 'src/shared/guards/writer-auth.guard';
import { buildPagination } from 'src/shared/utils/helper';

@Controller('resource')
export class ResourceController {
  @Get('')
  async getAll(@Query() query: any) {
    const { withDraft, page, size } = query;

    const qb = Resource.createQueryBuilder('r');

    if (!withDraft) {
      qb.where('r.isDraft = false');
    }

    const pageSize = +size <= 50 ? +size : PAGINATION;
    const currentPage = +(page || 1);

    const total = await qb.getCount();

    const data = await qb
      .take(pageSize)
      .skip((currentPage - 1) * pageSize)
      .getMany();

    return {
      data,
      pagination: buildPagination(total, currentPage),
    };
  }

  @Get(':id')
  async getResource(@Param('id') id: string, @CurrentUser() user: User) {
    const resource = await Resource.findOneBy({ id: +id });

    if (resource.isDraft) {
      if (!user || (!user.permission.admin && !user.permission.writer)) {
        throw new UnprocessableEntityException('Resource not found');
      }
    }
    return resource;
  }

  @Post()
  @UseGuards(WritterAuthGuard)
  async create(@CurrentUser() user: User, @Body() body: any) {
    const { title, description, icon, content, isDraft } = body;

    const resource = Resource.create({
      title,
      description,
      icon,
      content,
      isDraft,
      author: user.id,
    });
    await resource.save();

    return resource;
  }

  @Patch(':id')
  @UseGuards(WritterAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: User,
  ) {
    const resource = await Resource.findOneBy({
      id: +id,
    });

    if (!resource) {
      throw new UnprocessableEntityException('Resource not found');
    }

    if (!resource.isDraft && !user.permission.admin) {
      throw new ForbiddenException('Not allowed');
    }

    Object.assign(resource, body);
    await resource.save();

    return resource;
  }

  @Delete(':id')
  @UseGuards(WritterAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const resource = await Resource.findOneBy({ id: +id });

    if (!resource) {
      return { success: true };
    }

    if (!resource.isDraft && !user.permission.admin) {
      throw new ForbiddenException('Not allowed');
    }
    await Resource.delete(+id);

    return { success: true };
  }
}
