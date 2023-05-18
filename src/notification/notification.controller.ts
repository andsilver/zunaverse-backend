import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PAGINATION } from 'src/consts';
import { Nft } from 'src/database/entities/Nft';
import { Notification } from 'src/database/entities/Notification';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { buildPagination, checkRevealDate } from 'src/shared/utils/helper';

@Controller('notifications')
export class NotificationController {
  @Get()
  @UseGuards(AuthGuard)
  async getNotifications(@CurrentUser() user: User, @Query() query: any) {
    const { page, unread, size } = query;

    const qb = Notification.createQueryBuilder('n1')
      .where('n1.userId = :userId', { userId: user.id })
      .innerJoinAndMapOne(
        'n1.nft',
        Nft,
        'n2',
        'n1.tokenId = n2.tokenId AND n1.tokenAddress = n2.tokenAddress',
      )
      .orderBy('n1.createdAt', 'DESC');

    if (unread) {
      qb.andWhere('n1.unread = true');
    }

    const pageSize = +size || PAGINATION;
    const currentPage = +(page || 1);
    const total = await qb.getCount();

    const data = await qb
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getMany();

    data.forEach((d) => {
      d.nft = checkRevealDate(d.nft);
    });

    return { data, pagination: buildPagination(total, currentPage, pageSize) };
  }

  @Post('read')
  @UseGuards(AuthGuard)
  async markAsRead(@CurrentUser() user: User) {
    await Notification.update(
      {
        user: {
          id: user.id,
        },
        unread: true,
      },
      {
        unread: false,
      },
    );
    return { success: true };
  }
}
