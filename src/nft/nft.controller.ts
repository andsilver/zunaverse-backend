import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ACTIVITY_EVENTS, PAGINATION } from 'src/consts';
import { Activity } from 'src/database/entities/Activity';
import { Ask } from 'src/database/entities/Ask';
import { Bid } from 'src/database/entities/Bid';
import { Collection } from 'src/database/entities/Collection';
import { Favorite } from 'src/database/entities/Favorite';

import { Nft } from 'src/database/entities/Nft';
import { Notification } from 'src/database/entities/Notification';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { ILike } from 'typeorm';

@Controller('nft')
export class NftController {
  @Post()
  @UseGuards(AuthGuard)
  async createNFT(@CurrentUser() user: User, @Body() body: any) {
    const {
      name,
      image,
      description,
      category,
      royaltyFee,
      signature,
      collectionId,
      tokenId,
      properties,
      tokenUri,
      onSale,
    } = body;

    if (!signature) {
      throw new BadRequestException('Need to sign voucher');
    }

    let collection: Collection;

    if (collectionId) {
      collection = await Collection.findOneBy({ id: collectionId });

      if (!collection) {
        throw new BadRequestException('Invalid collection');
      }
    }

    const nft = Nft.create({
      name,
      image,
      description,
      category,
      royaltyFee,
      signature,
      collectionId: collectionId || null,
      tokenId,
      properties,
      tokenUri,
      minted: false,
      owner: user,
      creator: user,
      onSale,
    });
    await nft.save();

    if (collectionId) {
      await collection.calculateMetrics();
    }

    const acitivity = Activity.create({
      userAddress: user.pubKey,
      event: ACTIVITY_EVENTS.MINT,
      createdAt: `${Date.now()}`,
      nft: nft.id,
      collectionId: nft.collectionId,
    });
    await acitivity.save();

    return nft;
  }

  @Get('filter')
  async filterNFTs(@CurrentUser() user: User, @Query() query: any) {
    const {
      search,
      categories,
      saleType,
      userAddress,
      creatorAddress,
      category,
      collectionId,
      offset,
      size,
    } = query;

    let qb = Nft.createQueryBuilder('Nfts')
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.ownerId')
      .leftJoinAndMapOne(
        'Nfts.collection',
        Collection,
        'Collections',
        'Collections.id = Nfts.collectionId',
      )
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
            .where('Nfts.id = f.nftId'),
        'favorites',
      )
      .skip(offset || 0)
      .take(size && size < 50 ? size : PAGINATION);

    if (userAddress) {
      qb = qb.where('Users.pubKey ILIKE :userAddress', { userAddress });
    }

    if (creatorAddress) {
      const creator = await User.findByPubKey(creatorAddress);

      if (creator) {
        qb = qb.andWhere('Nfts.creatorId = :creatorId', {
          creatorId: creator.id,
        });
      }
    }

    if (collectionId) {
      qb = qb.andWhere('Collections.id = :collectionId', {
        collectionId: +collectionId,
      });
    }

    if (categories) {
      const c = categories.split(',');

      if (c.length) {
        qb = qb.andWhere('Nfts.category IN (:...categories)', {
          categories: c,
        });
      }
    }

    if (category) {
      qb = qb.andWhere('Nfts.category = :category', {
        category,
      });
    }

    if (search) {
      qb = qb.andWhere(
        `(Nfts.name ILIKE '%${search}%' OR Nfts.description ILIKE '%${search}%')`,
      );
    }

    if (saleType) {
      if (saleType === 'Buy Now') {
        qb = qb.andWhere('Nfts.currentAskId IS NOT NULL');
      } else if (saleType === 'Open to bids') {
        qb = qb.andWhere('Nfts.onSale = true');
      } else if (saleType === 'Not for sale') {
        qb = qb.andWhere('(Nfts.onSale = false AND Nfts.currentAskId IS NULL)');
      }
    }

    if (user) {
      qb = qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(f.id)', 'favorited')
            .from(Favorite, 'f')
            .where('Nfts.id = f.nftId AND f.userAddress ILIKE :address', {
              address: user.pubKey,
            }),
        'favorited',
      );
    }
    const { raw, entities } = await qb.getRawAndEntities();

    return entities.map((e, index) => {
      e.favorites = +raw[index].favorites;
      e.favorited = !!+raw[index].favorited;
      e.image = e.image.replace('ipfs://', process.env.PINATA_GATE_WAY);
      return e;
    });
  }

  @Post(':id/favorite')
  @UseGuards(AuthGuard)
  async favorite(@Param('id') id: string, @CurrentUser() user: User) {
    const nft = await Nft.findOne({ where: { id: +id } });

    if (!nft) {
      throw new UnprocessableEntityException('Nft not found');
    }

    const favorite = await Favorite.findOne({
      where: {
        nftId: +id,
        userAddress: ILike(user.pubKey),
      },
    });

    if (favorite) {
      await favorite.remove();
    } else {
      await Favorite.create({
        nftId: +id,
        userAddress: user.pubKey,
      }).save();

      const activity = new Activity();
      activity.event = ACTIVITY_EVENTS.LIKES;
      activity.createdAt = Date.now().toString();
      activity.userAddress = user.pubKey;
      activity.nft = nft.id;
      activity.collectionId = nft.collectionId;
      await activity.save();

      const notification = Notification.create({
        nftId: nft.id,
        user: nft.owner,
        text: 'Someone favorited your nft',
        metadata: {
          from: user.pubKey,
        },
      });
      await notification.save();
    }

    return { success: true };
  }

  @Post(':id/collection')
  @UseGuards(AuthGuard)
  async addCollection(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: any,
  ) {
    const { collectionId } = body;

    const nft = await Nft.findOneBy({ id: +id });

    if (!nft) {
      throw new UnprocessableEntityException('Nft not found');
    }

    const collection = await Collection.findOne({
      where: { id: +collectionId },
      relations: ['owner'],
    });

    if (!collection) {
      throw new UnprocessableEntityException('Collection not found');
    }

    if (collection.owner.id !== user.id) {
      throw new BadRequestException('User is not the owner of the collection');
    }
    nft.collection = collection;
    await nft.save();

    return { success: true };
  }

  @Get(':id')
  async getOneNft(@Param('id') id: string, @CurrentUser() user: User) {
    const nft = await Nft.createQueryBuilder('Nfts')
      .where('Nfts.id = :id', { id: +id })
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Nfts.ownerId = Users.id')
      .leftJoinAndMapOne(
        'Nfts.creator',
        User,
        'Users2',
        'Nfts.creatorId = Users2.id',
      )
      .leftJoinAndMapOne(
        'Nfts.currentAsk',
        Ask,
        'Asks',
        'Asks.id = Nfts.currentAskId',
      )
      .leftJoinAndMapOne(
        'Nfts.collection',
        Collection,
        'c',
        'c.id = Nfts.collectionId',
      )
      .getOne();

    if (!nft) {
      throw new UnprocessableEntityException('The nft does not exist');
    }
    const favorites = await Favorite.count({
      where: {
        nftId: +id,
      },
    });
    nft.favorites = favorites;
    nft.favorited = user
      ? !!(await Favorite.findOne({
          where: { nftId: +id, userAddress: ILike(user.pubKey) },
        }))
      : false;

    nft.image = nft.image.replace('ipfs://', process.env.PINATA_GATE_WAY);

    return nft;
  }

  @Get(':id/activities')
  async getNftActivities(@Param('id') id: string, @Query() query: any) {
    const { offset } = query;

    const activities = await Activity.createQueryBuilder('a')
      .where('a.nft = :id', { id: +id })
      .leftJoinAndMapOne('a.user', User, 'u', 'u.pubKey ILIKE a.userAddress')
      .orderBy('a.createdAt', 'DESC')
      .offset(+offset || 0)
      .take(PAGINATION)
      .getMany();

    return activities;
  }

  @Get(':id/bids')
  async getNftBids(@Param('id') id: string, @Query() query: any) {
    const { offset } = query;

    const bids = await Bid.createQueryBuilder('Bids')
      .leftJoinAndMapOne(
        'Bids.bidder',
        User,
        'Users',
        'Users.pubKey ILIKE Bids.bidder',
      )
      .where('Bids.nftId = :id', { id: +id })
      .orderBy('Bids.createdAt', 'DESC')
      .offset(+offset || 0)
      .take(PAGINATION)
      .getMany();

    return bids;
  }

  @Post(':id/bids')
  @UseGuards(AuthGuard)
  async createBid(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const nft = await Nft.findOne({ where: { id: +id }, relations: ['owner'] });

    if (nft.owner.pubKey === user.pubKey) {
      throw new ForbiddenException('Cannot bid on your own nft');
    }

    if (!nft.onSale) {
      throw new ForbiddenException('NFT is not listed for sale');
    }

    const bid = Bid.create(body) as Bid;
    bid.nftId = nft.id;
    bid.bidder = user.pubKey;

    await bid.save();

    const activity = new Activity();
    activity.amount = bid.amount;
    activity.currency = bid.currency;
    activity.createdAt = Date.now().toString();
    activity.event = ACTIVITY_EVENTS.BIDS.NEW_BID;
    activity.userAddress = user.pubKey;
    activity.nft = nft.id;
    activity.collectionId = nft.collectionId;
    await activity.save();

    const notification = new Notification();
    notification.text = 'New bid on your NFT';
    notification.user = nft.owner;
    notification.nftId = nft.id;
    notification.metadata = {
      activityId: activity.id,
      offer: {
        amount: bid.amount,
        currency: bid.currency,
      },
      from: user.pubKey,
    };
    await notification.save();

    return { success: true };
  }

  @Delete(':id/sale')
  @UseGuards(AuthGuard)
  async removeFromSale(@CurrentUser() user: User, @Param('id') id: string) {
    const nft = await Nft.findOne({ where: { id: +id }, relations: ['owner'] });

    if (nft.owner.pubKey !== user.pubKey) {
      throw new ForbiddenException('Not the nft owner');
    }

    nft.onSale = false;

    await Bid.delete({ nftId: nft.id });
    await nft.save();

    const activity = new Activity();
    activity.createdAt = Date.now().toString();
    activity.event = ACTIVITY_EVENTS.SALES.CANCEL;
    activity.userAddress = user.pubKey;
    activity.nft = nft.id;
    activity.collectionId = nft.collectionId;
    await activity.save();

    return { success: true };
  }

  @Post(':id/sale')
  @UseGuards(AuthGuard)
  async updateSale(
    @CurrentUser() user: User,
    @Body() body: any,
    @Param('id') id: string,
  ) {
    if (body.instantSale) {
      if (!body.typedData || !body.typedData.signature) {
        throw new BadRequestException('Signature is required');
      }

      if (!body.price || !body.price.amount || !body.price.currency) {
        throw new BadRequestException('Price is required');
      }
    }
    const nft = await Nft.findOne({ where: { id: +id }, relations: ['owner'] });
    const collection = await Collection.findOneBy({ id: nft.collectionId });

    if (nft.owner.pubKey !== user.pubKey) {
      throw new ForbiddenException('Not the nft owner');
    }

    if (nft.onSale !== body.onSale) {
      nft.onSale = !!body.onSale;

      const activity = new Activity();
      activity.createdAt = Date.now().toString();
      activity.event = nft.onSale
        ? ACTIVITY_EVENTS.SALES.PUT
        : ACTIVITY_EVENTS.SALES.CANCEL;
      activity.userAddress = user.pubKey;
      activity.nft = nft.id;
      activity.collectionId = nft.collectionId;
      await activity.save();
    }

    if (body.instantSale) {
      let ask = await Ask.findOneBy({ nftId: nft.id });

      if (!ask) {
        ask = new Ask();
        ask.nftId = nft.id;
      }
      ask.amount = body.price.amount;
      ask.currency = body.price.currency;
      ask.typedData = body.typedData;
      ask.owner = user.pubKey;
      ask.collectionId = nft.collectionId;
      await ask.save();
      nft.currentAskId = ask.id;

      const activity = new Activity();
      activity.amount = ask.amount;
      activity.currency = ask.currency;
      activity.createdAt = Date.now().toString();
      activity.event = ACTIVITY_EVENTS.SALES.PRICE_SET;
      activity.userAddress = user.pubKey;
      activity.nft = nft.id;
      activity.collectionId = nft.collectionId;
      await activity.save();
    } else {
      if (nft.currentAskId) {
        nft.currentAskId = null;
        await Ask.delete({ nftId: nft.id });
        const activity = new Activity();
        activity.createdAt = Date.now().toString();
        activity.event = ACTIVITY_EVENTS.SALES.PRICE_REMOVE;
        activity.userAddress = user.pubKey;
        activity.nft = nft.id;
        activity.collectionId = nft.collectionId;
        await activity.save();
      }
    }
    await nft.save();

    if (collection) {
      await collection.calculateFloorPrice();
    }

    return { success: true };
  }
}
