import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UnprocessableEntityException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ILike } from 'typeorm';

import { ACTIVITY_EVENTS, PAGINATION } from 'src/consts';
import { Activity } from 'src/database/entities/Activity';
import { Ask } from 'src/database/entities/Ask';
import { Bid } from 'src/database/entities/Bid';
import { Favorite } from 'src/database/entities/Favorite';
import { Follow } from 'src/database/entities/Follow';
import { Nft } from 'src/database/entities/Nft';
import { Report } from 'src/database/entities/Report';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  uploadBannerImageCloudinary,
  uploadImageCloudinary,
} from 'src/shared/utils/cloudinary';
import { RewardDetail } from 'src/database/entities/RewardDetail';

@Controller('user')
export class UserController {
  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Request() req: any) {
    return req.user;
  }

  @Get(':address')
  async getProfile(
    @Param('address') address: string,
    @CurrentUser() user: User,
  ) {
    const profile = await User.findByPubKey(address);

    if (!profile) {
      throw new UnprocessableEntityException('User does not exist');
    }

    profile.followers = await Follow.count({
      where: {
        user: ILike(profile.pubKey),
      },
    });

    profile.followings = await Follow.count({
      where: { followee: ILike(profile.pubKey) },
    });

    if (user) {
      const following = await Follow.findOneBy({
        user: ILike(profile.pubKey),
        followee: ILike(user.pubKey),
      });
      profile.following = !!following;
      const report = await Report.findOneBy({
        userAddress: ILike(address),
        reporter: ILike(user.pubKey),
      });
      profile.reported = !!report;
    }
    return profile;
  }

  @Patch(':address')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'avatar' }, { name: 'banner' }]),
  )
  @UseGuards(AuthGuard)
  async updateProfile(
    @Param('address') address: string,
    @Body() body: any,
    @CurrentUser() currentUser: User,
    @UploadedFiles()
    files: { avatar: Express.Multer.File[]; banner: Express.Multer.File[] },
  ) {
    const user = await User.findByPubKey(address);

    if (!user) {
      throw new UnprocessableEntityException({
        message: 'User not found',
      });
    }

    if (user.id !== currentUser.id) {
      throw new ForbiddenException('Not allowed');
    }

    const { avatar, banner } = files;

    if (avatar) {
      const [{ secure_url: avatarUrl }, { secure_url: thumbnailUrl }] =
        await Promise.all([
          uploadImageCloudinary(avatar[0].path, 200),
          uploadImageCloudinary(avatar[0].path, 60),
        ]);
      body.avatar = avatarUrl;
      body.thumbnailUrl = thumbnailUrl;
    }

    if (banner) {
      const { secure_url } = await uploadBannerImageCloudinary(banner[0].path);
      body.banner = secure_url;
    }

    for (const key of Object.keys(body)) {
      user[key] = body[key];
    }
    await user.save();
  }

  @Get(':address/nfts/liked')
  async getUserFavoritedNfts(
    @Param('address') address: string,
    @Query() query: any,
    @CurrentUser() user: User,
  ) {
    const { offset } = query;
    let qb = Favorite.createQueryBuilder('f')
      .where('f.userAddress = :address', { address })
      .innerJoinAndMapOne('f.nft', Nft, 'n', 'f.nftId = n.id')
      .leftJoinAndMapOne('n.currentAsk', Ask, 'a', 'n.currentAskId = a.id')
      .leftJoinAndMapOne('n.owner', User, 'u', 'u.id = n.ownerId')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f1.id)', 'favorites')
            .from(Favorite, 'f1')
            .where('n.id = f1.nftId'),
        'favorites',
      );

    if (user) {
      qb = qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(f2.id)', 'favorited')
            .from(Favorite, 'f2')
            .where('n.id = f2.nftId AND f2.userAddress ILIKE :address', {
              address: user.pubKey,
            }),
        'favorited',
      );
    }

    const { entities, raw } = await qb
      .offset(+offset || 0)
      .take(PAGINATION)
      .getRawAndEntities();

    return entities.map((e: any, index) => ({
      ...e.nft,
      favorited: user ? raw[index].favorited : false,
      favorites: raw[index].favorites,
      image: e.nft.image.replace('ipfs://', process.env.PINATA_GATE_WAY),
    }));
  }

  @Get(':address/followers')
  async getFollowers(@Param('address') address: string, @Query() query: any) {
    const { entities, raw } = await Follow.createQueryBuilder('f')
      .where('f.user ILIKE :address', { address })
      .innerJoinAndMapOne('f.profile', User, 'u', 'f.followee ILIKE u.pubKey')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f1.id)', 'followers')
            .from(Follow, 'f1')
            .where('f.followee ILIKE f1.user'),
        'followers',
      )
      .getRawAndEntities();

    return entities.map((e: any, index) => ({
      profile: e.profile,
      followers: raw[index].followers,
    }));
  }

  @Get(':address/following')
  async getFollowees(@Param('address') address: string, @Query() query: any) {
    const { entities, raw } = await Follow.createQueryBuilder('f')
      .where('f.followee ILIKE :address', { address })
      .innerJoinAndMapOne('f.profile', User, 'u', 'f.user ILIKE u.pubKey')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f1.id)', 'followers')
            .from(Follow, 'f1')
            .where('f.user ILIKE f1.user'),
        'followers',
      )
      .getRawAndEntities();

    return entities.map((e: any, index) => ({
      profile: e.profile,
      followers: raw[index].followers,
    }));
  }

  @Get(':address/bids/incoming')
  async getUserIncomingBids(
    @Param('address') address: string,
    @Query() query: any,
  ) {
    const { offset } = query;

    const bids = await Bid.createQueryBuilder('Bids')
      .leftJoinAndMapOne('Bids.nft', Nft, 'Nfts', 'Bids.nftId = Nfts.id')
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.owner')
      .where('Users.pubKey ILIKE :address', { address })
      .orderBy('Bids.createdAt', 'DESC')
      .offset(+offset || 0)
      .take(PAGINATION)
      .getMany();

    return bids;
  }

  @Get(':address/bids/outgoing')
  async getUserOutgoingBids(
    @Param('address') address: string,
    @Query() query: any,
  ) {
    const { offset } = query;

    const bids = await Bid.createQueryBuilder('Bids')
      .leftJoinAndMapOne('Bids.nft', Nft, 'Nfts', 'Bids.nftId = Nfts.id')
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.owner')
      .where('Bids.bidder ILIKE :address', { address })
      .orderBy('Bids.createdAt', 'DESC')
      .offset(+offset || 0)
      .take(PAGINATION)
      .getMany();

    return bids;
  }

  @Get(':address/activities')
  async getUserActivities(
    @Param('address') address: string,
    @Query() query: any,
  ) {
    const { offset } = query;

    const activities = await Activity.createQueryBuilder('Activities')
      .where('Activities.userAddress ILIKE :address', { address })
      .orWhere('Activities.receiver ILIKE :address', { address })
      .leftJoinAndMapOne(
        'Activities.user',
        User,
        'Users1',
        'Users1.pubKey ILIKE Activities.userAddress',
      )
      .leftJoinAndMapOne(
        'Activities.receiver',
        User,
        'Users2',
        'Users2.pubKey ILIKE Activities.receiver',
      )
      .leftJoinAndMapOne(
        'Activities.nft',
        Nft,
        'Nfts',
        'Nfts.id = Activities.nft',
      )
      .orderBy('Activities.createdAt', 'DESC')
      .offset(+offset || 0)
      .take(PAGINATION)
      .getMany();

    return activities;
  }

  @Post(':address/follow')
  @UseGuards(AuthGuard)
  async followUser(
    @CurrentUser() user: User,
    @Param('address') address: string,
  ) {
    const follow = await Follow.findOneBy({
      user: ILike(address),
      followee: ILike(user.pubKey),
    });

    if (follow) {
      await follow.remove();
    } else {
      await Follow.create({
        user: address,
        followee: user.pubKey,
      }).save();
    }
    await Activity.create({
      event: ACTIVITY_EVENTS.FOLLOWINGS,
      createdAt: Date.now().toString(),
      userAddress: user.pubKey,
      receiver: address,
    }).save();
    return { success: true };
  }

  @Get(':address/rewards')
  @UseGuards(AuthGuard)
  async getRewards(@Param('address') address: string, @Query() query: any) {
    let qb = RewardDetail.createQueryBuilder('rd');

    if (query.rewardType) {
      qb = qb.andWhere(`rewardType = :rewardType`, {
        rewardType: query.rewardType,
      });
    }

    if (query.startDate || query.endDate) {
      qb = qb.andWhere('rd.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(
          query.startDate || new Date(2022, 9, 1),
        ).toISOString(),
        endDate: new Date(query.endDate || new Date()).toISOString(),
      });
    }

    return qb
      .where('rd.userPubKey ILIKE :address', { address })
      .leftJoinAndMapOne('rd.nft', Nft, 'n', 'n.id = rd.nftId')
      .orderBy('rd.createdAt', 'DESC')
      .skip(+query.offset || 0)
      .take(PAGINATION)
      .getMany();
  }
}
