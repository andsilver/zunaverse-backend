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
import { MoralisService } from 'src/shared/services/moralis.service';
import { convertIpfsIntoReadable } from 'src/shared/utils/helper';

@Controller('user')
export class UserController {
  constructor(private moralis: MoralisService) {}

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
    address = address.toLowerCase();

    const profile = await User.findByPubKey(address);

    if (!profile) {
      throw new UnprocessableEntityException('User does not exist');
    }

    profile.followers = await Follow.count({
      where: {
        user: profile.pubKey,
      },
    });

    profile.followings = await Follow.count({
      where: { followee: profile.pubKey },
    });

    if (user) {
      const following = await Follow.findOneBy({
        user: profile.pubKey,
        followee: user.pubKey,
      });
      profile.following = !!following;
      const report = await Report.findOneBy({
        userAddress: address,
        reporter: user.pubKey,
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
    address = address.toLowerCase();

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
    address = address.toLowerCase();

    const { offset } = query;
    let qb = Favorite.createQueryBuilder('f')
      .where('f.userAddress = :address', { address })
      .innerJoinAndMapOne(
        'f.nft',
        Nft,
        'n',
        'f.tokenId = n.tokenId AND f.tokenId = n.tokenAddress',
      )
      .leftJoinAndMapOne('n.currentAsk', Ask, 'a', 'n.currentAskId = a.id')
      .leftJoinAndMapOne('n.owner', User, 'u', 'u.id = n.ownerId')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f1.id)', 'favorites')
            .from(Favorite, 'f1')
            .where(
              'n.tokenId = f1.tokenId AND n.tokenAddress = f1.tokenAddress',
            ),
        'favorites',
      );

    if (user) {
      qb = qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(f2.id)', 'favorited')
            .from(Favorite, 'f2')
            .where(
              'n.tokenId = f2.tokenId AND n.tokenAddress = f2.tokenAddress AND f2.userAddress = :address',
              {
                address: user.pubKey,
              },
            ),
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
      image: convertIpfsIntoReadable(e.nft.image, e.nft.tokenAddress),
    }));
  }

  @Get(':address/followers')
  async getFollowers(@Param('address') address: string, @Query() query: any) {
    address = address.toLowerCase();

    const { entities, raw } = await Follow.createQueryBuilder('f')
      .where('f.user = :address', { address })
      .innerJoinAndMapOne('f.profile', User, 'u', 'f.followee = u.pubKey')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f1.id)', 'followers')
            .from(Follow, 'f1')
            .where('f.followee = f1.user'),
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
    address = address.toLowerCase();

    const { entities, raw } = await Follow.createQueryBuilder('f')
      .where('f.followee = :address', { address })
      .innerJoinAndMapOne('f.profile', User, 'u', 'f.user = u.pubKey')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f1.id)', 'followers')
            .from(Follow, 'f1')
            .where('f.user = f1.user'),
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
    address = address.toLowerCase();

    const bids = await Bid.createQueryBuilder('Bids')
      .innerJoinAndMapOne(
        'Bids.nft',
        Nft,
        'Nfts',
        'Bids.tokenId = Nfts.tokenId AND Bids.tokenAddress = Nfts.tokenAddress',
      )
      .innerJoin(User, 'owner', 'owner.id = Nfts.ownerId')
      .innerJoinAndMapOne(
        'Bids.bidder',
        User,
        'Users',
        'Users.pubKey = Bids.bidder',
      )
      .where('owner.pubKey = :address', { address })
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
    address = address.toLowerCase();

    const bids = await Bid.createQueryBuilder('Bids')
      .leftJoinAndMapOne(
        'Bids.nft',
        Nft,
        'Nfts',
        'Bids.tokenId = Nfts.tokenId AND Bids.tokenAddress = Nfts.tokenAddress',
      )
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.owner')
      .where('Bids.bidder = :address', { address })
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
      .where('Activities.userAddress = :address', { address })
      .orWhere('Activities.receiver = :address', { address })
      .leftJoinAndMapOne(
        'Activities.user',
        User,
        'Users1',
        'Users1.pubKey = Activities.userAddress',
      )
      .leftJoinAndMapOne(
        'Activities.receiver',
        User,
        'Users2',
        'Users2.pubKey = Activities.receiver',
      )
      .leftJoinAndMapOne(
        'Activities.nft',
        Nft,
        'Nfts',
        'Nfts.tokenId = Activities.tokenId AND Nfts.tokenAddress = Activities.tokenAddress',
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
    address = address.toLowerCase();

    const follow = await Follow.findOneBy({
      user: address,
      followee: user.pubKey,
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
    address = address.toLowerCase();

    let qb = RewardDetail.createQueryBuilder('rd').where(
      'rd.userPubKey = :address',
      { address },
    );

    if (query.rewardType) {
      qb = qb.andWhere(`rd.rewardType = :rewardType`, {
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
      .leftJoinAndMapOne('rd.nft', Nft, 'n', 'n.id = rd.nftId')
      .orderBy('rd.createdAt', 'DESC')
      .skip(+query.offset || 0)
      .take(PAGINATION)
      .getMany();
  }

  @Get(':address/others')
  async getOtherNfts(
    @Param('address') address: string,
    @Query() query: any,
    @CurrentUser() user: User,
  ) {
    address = address.toLowerCase();

    const owner = await User.findOrCreate(address);

    const { cursor } = query;
    const res = await this.moralis.getNftsByAddress(address, cursor);
    const nfts = res.result.filter(
      (item) =>
        item.token_address.toLowerCase() !==
        process.env.MEDIA_CONTRACT.toLowerCase(),
    );
    const result = await Promise.all(
      nfts.map((nft) => {
        const n = Nft.noramlizeMoralisNft(nft);
        n.owner = owner;
        return n;
      }),
    );

    if (!result.length) {
      return {
        result,
        page: res.page,
        total: res.total,
        cursor: res.cursor,
      };
    }

    const qb = Nft.createQueryBuilder('Nfts')
      .where(
        `(Nfts.tokenAddress, Nfts.tokenId) IN (${result
          .map((n) => `('${n.tokenAddress}','${n.tokenId}')`)
          .join(',')})`,
      )
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.ownerId')
      .leftJoinAndMapOne(
        'Nfts.currentAsk',
        Ask,
        'Asks',
        'Asks.id = Nfts.currentAskId',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f.id)', 'favorites')
            .from(Favorite, 'f')
            .where(
              'Nfts.tokenId = f.tokenId AND Nfts.tokenAddress = f.tokenAddress',
            ),
        'favorites',
      );

    if (user) {
      qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(f.id)', 'favorited')
            .from(Favorite, 'f')
            .where(
              'Nfts.tokenId = f.tokenId AND Nfts.tokenAddress = f.tokenAddress AND f.userAddress = :address',
              {
                address: user.pubKey,
              },
            ),
        'favorited',
      );
    }

    const { raw, entities } = await qb.getRawAndEntities();

    const existingNfts = entities.map((e, index) => {
      e.favorites = +raw[index].favorites;
      e.favorited = !!+raw[index].favorited;
      return e;
    });

    for (let i = 0; i < result.length; i++) {
      const existingNft = existingNfts.find(
        (n) =>
          n.tokenId === result[i].tokenId &&
          n.tokenAddress === result[i].tokenAddress,
      );

      if (existingNft) {
        result[i] = existingNft;
      }
    }

    return {
      result,
      page: res.page,
      total: res.total,
      cursor: res.cursor,
    };
  }
}
