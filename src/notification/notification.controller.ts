import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PAGINATION } from 'src/consts';
import { Nft } from 'src/database/entities/Nft';
import { Notification } from 'src/database/entities/Notification';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';

@Controller('notifications')
export class NotificationController {
  @Get()
  @UseGuards(AuthGuard)
  async getNotifications(@CurrentUser() user: User) {
    const notifications = await Notification.createQueryBuilder('n1')
      .where('n1.userId = :userId AND unread = true', { userId: user.id })
      .innerJoinAndMapOne(
        'n1.nft',
        Nft,
        'n2',
        'n1.tokenId = n2.tokenId AND n1.tokenAddress = n2.tokenAddress',
      )
      .orderBy('n1.createdAt', 'DESC')
      .limit(PAGINATION)
      .getMany();

    return notifications;
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
