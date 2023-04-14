import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  buildPagination,
  convertIpfsIntoReadable,
} from 'src/shared/utils/helper';
import { UserCategoryView } from 'src/database/views/UserCategory';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { Currency } from 'src/database/entities/Currency';
import { UserCurrencyView } from 'src/database/views/UserCurrency';
import { UserSellAmountView } from 'src/database/views/UserSellAmount';
import { Transaction } from 'src/database/entities/Transaction';
import moment from 'moment';
import { Showcase } from 'src/database/entities/Showcase';
import { selectNfts } from 'src/database/query-helper';

@Controller('user')
export class UserController {
  constructor(
    private moralis: MoralisService,
    private dataSource: DataSource,
  ) {}

  @Get('filter')
  async filterUsers(@Query() query: any, @CurrentUser() user: User) {
    const { page, orderBy, category, search, currency } = query;

    const qb = User.createQueryBuilder('u')
      .leftJoinAndMapOne(
        'u.sold',
        UserSellAmountView,
        't',
        't.seller = u.pubKey',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(id)', 'creates')
            .from(Nft, 'n')
            .where('n.creatorId = u.id'),
        'creates',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(id)', 'followers')
            .from(Follow, 'f')
            .where('u.pubKey = f.user'),
        'followers',
      );

    if (search) {
      qb.where('(u.name ILIKE :search OR u.pubKey ILIKE :search)', { search });
    }

    if (category) {
      qb.innerJoin(UserCategoryView, 'uc', 'u.id = uc.id').andWhere(
        `uc.categories && '{${category.toLowerCase()}}' = true`,
      );
    }

    if (currency) {
      const currencies = await Currency.findBy({
        symbol: In(currency.split(',')),
      });
      qb.innerJoin(UserCurrencyView, 'ucv', 'ucv.id = u.id').andWhere(
        `ucv.currency && '{${currencies
          .map((c) => c.address)
          .join(',')}}' = true`,
      );
    }

    if (user) {
      qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(id)', 'following')
            .from(Follow, 'f')
            .where('u.pubKey = f.user AND f.followee = :address', {
              address: user.pubKey,
            }),
        'following',
      );
    }

    const currentPage = +(page || 1);
    const total = await qb.getCount();

    if (orderBy === 'creations') {
      qb.orderBy('creates', 'DESC');
    } else if (orderBy === 'followers') {
      qb.orderBy('followers', 'DESC');
    } else {
      qb.orderBy('t.amount', 'DESC', 'NULLS LAST');
    }

    const { entities, raw } = await qb
      .take(PAGINATION)
      .skip((currentPage - 1) * PAGINATION)
      .getRawAndEntities();

    return {
      data: entities.map((e, index) => ({
        ...e,
        followers: +raw[index].followers,
        following: Boolean(+raw[index].following),
        creates: +raw[index].creates,
      })),
      pagination: buildPagination(total, currentPage),
    };
  }

  @Get('revenue')
  @UseGuards(AuthGuard)
  async getUserRevenue(@CurrentUser() user: User) {
    const transactions = await Transaction.createQueryBuilder('t')
      .where(
        '(t.buyer = :pubKey OR t.seller = :pubKey) AND (t.createdAt > :date)',
        {
          pubKey: user.pubKey,
          date: moment().startOf('month').format('YYYY-MM-DD'),
        },
      )
      .orderBy('t.createdAt', 'DESC')
      .getMany();

    const lastMonthTransactions = await Transaction.createQueryBuilder('t')
      .where(
        '(t.buyer = :pubKey OR t.seller = :pubKey) AND (t.createdAt > :date1 AND t.createdAt < :date2)',
        {
          pubKey: user.pubKey,
          date1: moment()
            .subtract(1, 'month')
            .startOf('month')
            .format('YYYY-MM-DD'),
          date2: moment().startOf('month').format('YYYY-MM-DD'),
        },
      )
      .getMany();

    const lastMonthVolume = lastMonthTransactions.reduce(
      (a, b) => a + b.usd,
      0,
    );

    const total = transactions.reduce((a, b) => a + b.usd, 0);
    const sales = transactions.reduce(
      (a, b) => a + (b.seller === user.pubKey ? b.usd : 0),
      0,
    );
    const investment = transactions.reduce(
      (a, b) => a + (b.buyer === user.pubKey ? b.usd : 0),
      0,
    );
    const netchange = sales - investment;

    const daily = transactions.reduce((a, b) => {
      const day = moment(b.createdAt).format('YYYY-MM-DD');

      if (moment().subtract(1, 'week').isBefore(day)) {
        (a[day] = a[day] || []).push({
          ...b,
          weekday: moment(b.createdAt).format('ddd'),
        });
      }
      return a;
    }, {});

    const chartData = Object.values(daily).map((v: any[]) => {
      const sale = v.reduce(
        (a, b) => a + (b.seller === user.pubKey ? b.usd : 0),
        0,
      );
      const buy = v.reduce(
        (a, b) => a + (b.buyer === user.pubKey ? b.usd : 0),
        0,
      );
      return {
        sale,
        buy,
        weekday: v[0].weekday,
      };
    });
    const data = {
      labels: chartData.map((c) => c.weekday),
      datasets: [
        {
          label: 'Income',
          data: chartData.map((c) => c.sale.toFixed(2)),
          backgroundColor: '#49CDBD',
          borderRadius: 12,
          borderSkipped: false,
          barThickness: 14,
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 2,
        },
        {
          label: 'Investment',
          data: chartData.map((c) => c.buy.toFixed(2)),
          backgroundColor: '#0D9BFE',
          borderRadius: 12,
          borderSkipped: false,
          barThickness: 14,
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 2,
        },
      ],
    };

    return {
      total: total.toFixed(2),
      sales: sales.toFixed(2),
      investment: investment.toFixed(2),
      netchange: netchange.toFixed(2),
      data,
      change: Math.round((total / lastMonthVolume) * 100) - 100,
    };
  }

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

    const [
      followers,
      followings,
      collectedItems,
      createdItems,
      onSale,
      likedItems,
    ] = await Promise.all([
      await Follow.count({
        where: {
          user: profile.pubKey,
        },
      }),
      Follow.count({
        where: { followee: profile.pubKey },
      }),
      Nft.countBy({
        owner: {
          pubKey: profile.pubKey,
        },
      }),
      Nft.countBy({
        creator: {
          pubKey: profile.pubKey,
        },
      }),
      Nft.countBy({
        owner: {
          pubKey: profile.pubKey,
        },
        currentAskId: Not(IsNull()),
      }),
      Favorite.countBy({
        userAddress: profile.pubKey,
      }),
    ]);

    profile.followers = followers;
    profile.followings = followings;
    profile.collectedItems = collectedItems;
    profile.createdItems = createdItems;
    profile.onSaleItems = onSale;
    profile.likedItems = likedItems;

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

  @Get(':address/rewards')
  @UseGuards(AuthGuard)
  async getUserRewards(@Param('address') address: string) {
    const staticRewards = [
      205 * 10 ** 9 * 10 ** 9,
      120 * 10 ** 9 * 10 ** 9,
      14 * 10 ** 9 * 10 ** 9,
      70 * 10 ** 8 * 10 ** 9,
      36 * 10 ** 8 * 10 ** 9,
      2 * 10 ** 9 * 10 ** 9,
    ];
    const buybackRewards = [300000, 120000, 9850, 4000, 2000, 800];

    const rewardDetails = await RewardDetail.findBy({
      userPubKey: address,
    });

    const amount = rewardDetails.reduce((sum, r) => {
      const rewardAmount =
        r.rewardType === 'buyback'
          ? buybackRewards[r.rewardTier]
          : staticRewards[r.rewardTier];
      return rewardAmount + sum;
    }, 0);

    return { amount };
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

  @Get(':address/showcase')
  async getUserShowcase(@Param('address') address: string) {
    address = address.toLowerCase();

    const user = await User.findByPubKey(address);

    if (!user) {
      throw new UnprocessableEntityException('User not found');
    }

    const qb = Showcase.createQueryBuilder('s')
      .where('s.userId = :userId', {
        userId: user.id,
      })
      .innerJoinAndMapOne('s.nft', Nft, 'n', 'n.id = s.nftId');

    const { entities, raw } = await selectNfts<Showcase>(qb)
      .orderBy('s.order', 'ASC')
      .getRawAndEntities();

    const data = entities.map((e, index) => {
      e.nft.favorites = +raw[index].favorites;
      e.nft.favorited = !!+raw[index].favorited;
      return e;
    });
    return data;
  }

  @Post(':address/showcase/remove')
  @UseGuards(AuthGuard)
  async removeItemsFromShowCase(
    @Param('address') address: string,
    @Body() body: number[],
    @CurrentUser() currentUser: User,
  ) {
    address = address.toLowerCase();

    if (currentUser.pubKey !== address) {
      throw new BadRequestException('Not the showcase owner');
    }

    await Showcase.delete({
      id: In(body),
      userId: currentUser.id,
    });

    return { success: true };
  }

  @Patch(':address/showcase')
  @UseGuards(AuthGuard)
  async updateShowcase(
    @Param('address') address: string,
    @Body() body: { id: number; order: number }[],
    @CurrentUser() currentUser: User,
  ) {
    address = address.toLowerCase();

    if (currentUser.pubKey !== address) {
      throw new BadRequestException('Not the showcase owner');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const e of body) {
        await queryRunner.manager.update(
          Showcase,
          { id: e.id, userId: currentUser.id },
          { order: e.order },
        );
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return { success: true };
  }

  @Get(':address/nfts/liked')
  async getUserFavoritedNfts(
    @Param('address') address: string,
    @Query() query: any,
    @CurrentUser() user: User,
  ) {
    address = address.toLowerCase();

    const { page, size, search, category, saleType, currency } = query;

    let qb = Favorite.createQueryBuilder('f')
      .where('f.userAddress = :address', { address })
      .innerJoinAndMapOne(
        'f.nft',
        Nft,
        'n',
        'f.tokenId = n.tokenId AND f.tokenAddress = n.tokenAddress',
      )
      .leftJoinAndMapOne('n.highestBid', Bid, 'b', 'b.id = n.highestBidId')
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

    if (category) {
      const c = category.split(',');

      if (c.length) {
        qb = qb.andWhere('n.category IN (:...categories)', {
          categories: c,
        });
      }
    }

    if (search) {
      qb = qb.andWhere(
        `(n.name ILIKE '%${search}%' OR n.description ILIKE '%${search}%')`,
      );
    }

    if (saleType) {
      if (saleType === 'Buy Now') {
        qb = qb.andWhere('a.amount IS NOT NULL');
      } else if (saleType === 'Open to bids') {
        qb = qb.andWhere('n.onSale = true');
      } else if (saleType === 'Not for sale') {
        qb = qb.andWhere('(n.onSale = false AND a.amount IS NULL)');
      }
    }

    if (currency) {
      const currencies = (
        await Currency.findBy({
          symbol: In(currency.split(',')),
        })
      ).map((c) => c.address);

      qb.andWhere('a.currency IN (:...currencies)', { currencies });
    }

    const pageSize = +size || PAGINATION;
    const currentPage = +(page || 1);
    const total = await qb.getCount();

    const { entities, raw } = await qb
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .orderBy('f.createdAt', 'DESC')
      .getRawAndEntities();

    const data = entities.map((e: any, index) => ({
      ...e.nft,
      favorited: user ? raw[index].favorited : false,
      favorites: raw[index].favorites,
      image: convertIpfsIntoReadable(e.nft.image, e.nft.tokenAddress),
      favoritedAt: e.createdAt,
    }));

    return {
      data,
      pagination: buildPagination(total, currentPage, pageSize),
    };
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
    const { page, currency, order, orderBy } = query;
    address = address.toLowerCase();

    const qb = Bid.createQueryBuilder('Bids')
      .innerJoinAndMapOne(
        'Bids.nft',
        Nft,
        'Nfts',
        'Bids.tokenId = Nfts.tokenId AND Bids.tokenAddress = Nfts.tokenAddress',
      )
      .leftJoinAndMapOne(
        'Nfts.currentAsk',
        Ask,
        'a',
        'Nfts.currentAskId = a.id',
      )
      .innerJoin(User, 'owner', 'owner.id = Nfts.ownerId')
      .innerJoinAndMapOne(
        'Bids.bidder',
        User,
        'Users',
        'Users.pubKey = Bids.bidder',
      )
      .where('owner.pubKey = :address', { address });

    if (currency) {
      const currencies = (
        await Currency.findBy({
          symbol: In(currency.split(',')),
        })
      ).map((c) => c.address);
      qb.andWhere('Bids.currency IN (:...currencies)', { currencies });
    }

    if (orderBy === 'createdAt') {
      qb.orderBy('Bids.createdAt', order || 'DESC');
    } else if (orderBy === 'price') {
      qb.addSelect(
        (sb) =>
          sb
            .select('Bids.amount * c.usd', 'usd')
            .from(Currency, 'c')
            .where('Bids.currency = c.address'),
        'price',
      ).orderBy('price', order || 'DESC');
    }

    const currentPage = +(page || 1);
    const total = await qb.getCount();

    const data = await qb
      .take(PAGINATION)
      .skip((currentPage - 1) * PAGINATION)
      .getMany();

    return {
      data,
      pagination: buildPagination(total, currentPage),
    };
  }

  @Get(':address/bids/outgoing')
  async getUserOutgoingBids(
    @Param('address') address: string,
    @Query() query: any,
  ) {
    const { page, currency, order, orderBy } = query;
    address = address.toLowerCase();

    const qb = Bid.createQueryBuilder('Bids')
      .innerJoinAndMapOne(
        'Bids.nft',
        Nft,
        'Nfts',
        'Bids.tokenId = Nfts.tokenId AND Bids.tokenAddress = Nfts.tokenAddress',
      )
      .leftJoinAndMapOne(
        'Nfts.currentAsk',
        Ask,
        'a',
        'Nfts.currentAskId = a.id',
      )
      .innerJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.owner')
      .where('Bids.bidder = :address', { address });

    if (currency) {
      const currencies = (
        await Currency.findBy({
          symbol: In(currency.split(',')),
        })
      ).map((c) => c.address);
      qb.andWhere('Bids.currency IN (:...currencies)', { currencies });
    }

    if (orderBy === 'createdAt') {
      qb.orderBy('Bids.createdAt', order || 'DESC');
    } else if (orderBy === 'price') {
      qb.addSelect(
        (sb) =>
          sb
            .select('Bids.amount * c.usd', 'usd')
            .from(Currency, 'c')
            .where('Bids.currency = c.address'),
        'price',
      ).orderBy('price', order || 'DESC');
    }

    const currentPage = +(page || 1);
    const total = await qb.getCount();

    const data = await qb
      .take(PAGINATION)
      .skip((currentPage - 1) * PAGINATION)
      .getMany();

    return {
      data,
      pagination: buildPagination(total, currentPage),
    };
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
