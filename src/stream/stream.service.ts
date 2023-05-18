import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import axios from 'axios';
import Web3 from 'web3';

import MediaAbi from '../indexer/abis/Zuna.json';
import MarketAbi from '../indexer/abis/Market.json';
import { Activity } from 'src/database/entities/Activity';
import { Nft } from 'src/database/entities/Nft';
import { Ask } from 'src/database/entities/Ask';
import { Currency } from 'src/database/entities/Currency';
import { fromWei } from 'src/shared/utils/currency';
import { Transaction } from 'src/database/entities/Transaction';
import { User } from 'src/database/entities/User';
import { Notification } from 'src/database/entities/Notification';
import { Bid } from 'src/database/entities/Bid';
import { ACTIVITY_EVENTS, BURN_ADDRESSES } from 'src/consts';
import { Collection } from 'src/database/entities/Collection';
import { TempNft } from 'src/database/entities/TempNft';
import { Showcase } from 'src/database/entities/Showcase';

@Injectable()
export class StreamService {
  logger = new Logger(StreamService.name);

  private async _updateOfferActivity(
    nft: Nft,
    activity: Activity,
    erc20Address: string,
    amount: string,
    buyer: string,
    seller: string,
    txHash: string,
    txType: 'accept' | 'buy' | 'clone',
  ) {
    const currency = await Currency.findOneBy({
      address: erc20Address.toLowerCase(),
    });
    activity.event = 'Sale';
    activity.amount = fromWei(Web3.utils.toBN(amount), currency.decimals);
    activity.currency = erc20Address;

    await activity.save();

    const usd = +currency.usd * +activity.amount;

    const transaction = await Transaction.create({
      amount: +activity.amount,
      currency: activity.currency,
      txHash: activity.txHash,
      collectionId: nft.collectionId,
      buyer,
      seller,
      usd,
      ...nft.tokenIdentity,
    }).save();

    const [sellerUser, buyerUser] = await Promise.all([
      User.findByPubKey(seller),
      User.findByPubKey(buyer),
    ]);

    await Notification.create({
      user: txType === 'buy' || txType === 'clone' ? sellerUser : buyerUser,
      text:
        txType === 'buy'
          ? 'One of your nfts has been sold.'
          : txType === 'clone'
          ? 'Onf of your nfts has been cloned via affiliate link.'
          : 'One of your offers has been accepted.',
      metadata: {
        activityId: activity.id,
        from: (txType === 'buy' || txType === 'clone'
          ? buyer
          : seller
        ).toLowerCase(),
        offer: {
          amount: activity.amount,
          currency: activity.currency,
        },
        txHash,
      },
      ...nft.tokenIdentity,
    }).save();

    await Bid.delete({
      bidder: (buyer as string).toLowerCase(),
      ...nft.tokenIdentity,
    });

    if (nft.collection) {
      nft.collection.totalVolume += transaction.usd;
      await nft.collection.save();
    }
  }

  async handleClone(
    tokenId: string,
    txHash: string,
    logIndex: number,
    offer: any,
    seller: string,
    buyer: string,
  ) {
    this.logger.log(`handleClone: ${tokenId}`);

    const tokenAddress = process.env.MEDIA_CONTRACT.toLowerCase();

    // eslint-disable-next-line prefer-const
    let [nft, activity] = await Promise.all([
      Nft.createQueryBuilder('n')
        .where('n.tokenId = :tokenId AND n.tokenAddress = :tokenAddress', {
          tokenId,
          tokenAddress,
        })
        .leftJoinAndMapOne('n.owner', User, 'u', 'n.ownerId = u.id')
        .leftJoinAndMapOne(
          'n.collection',
          Collection,
          'c',
          'n.collectionId = c.id',
        )
        .getOne(),
      Activity.findOne({
        where: {
          txHash,
          logIndex: logIndex - 1,
        },
      }),
    ]);

    if (!activity) {
      throw new UnprocessableEntityException(`Transfer activity missing`);
    }

    const originalNft = await Nft.findOneBy({
      tokenId: offer.tokenId || offer[offer.length - 5],
      tokenAddress,
    });

    if (!nft) {
      const tempNft = await TempNft.findOneBy({
        name: 'Clone',
        tokenId,
      });

      if (!tempNft) {
        throw new UnprocessableEntityException(
          `Nft does not exist for tokenId: ${tokenId}`,
        );
      }
      const collection = await Collection.findOneBy({
        id: originalNft.collectionId,
      });

      nft = Nft.create({
        name: originalNft.name,
        category: originalNft.category,
        description: originalNft.description,
        royaltyFee: originalNft.royaltyFee,
        properties: originalNft.properties,
        tokenUri: originalNft.tokenUri,
        thumbnail: originalNft.thumbnail,
        collectionId: originalNft.collectionId,
        onSale: true,
        image: originalNft.image,
        owner: await User.findByPubKey(buyer),
        creatorId: originalNft.creatorId,
        minted: true,
        mintedAt: new Date(tempNft.createdAt).getTime().toString(),
        clonedFrom: originalNft.id,
        revealDate: `${collection.affiliation.revealDate}`,
        tokenId,
        tokenAddress,
      });
      await nft.save();
      nft.collection = await Collection.findOneBy({ id: nft.collectionId });

      await nft.collection.calculateMetrics();
      await nft.updateCollectionProperty();
      await tempNft.remove();
    } else {
      nft.clonedFrom = originalNft.id;
      nft.owner = await User.findByPubKey(buyer);
      nft.creator = originalNft.creator;
      await nft.save();
    }
    const erc20Address = offer.erc20Address || offer[offer.length - 4];
    const amount = offer.amount || offer[offer.length - 3];

    await this._updateOfferActivity(
      nft,
      activity,
      erc20Address,
      amount,
      buyer,
      seller,
      activity.txHash,
      'clone',
    );
    this.logger.log(`handleClone Success: ${tokenAddress}: ${tokenId}`);
  }

  async handleOffer(
    tokenId: string,
    tokenAddress: string,
    txHash: string,
    logIndex: number,
    offer: any,
    seller: string,
    buyer: string,
    buying: boolean,
  ) {
    this.logger.log(`handleOffer: ${tokenAddress}: ${tokenId}`);

    tokenAddress = tokenAddress.toLowerCase();

    const [nft, activity] = await Promise.all([
      Nft.createQueryBuilder('n')
        .where('n.tokenId = :tokenId AND n.tokenAddress = :tokenAddress', {
          tokenId,
          tokenAddress,
        })
        .leftJoinAndMapOne('n.owner', User, 'u', 'n.ownerId = u.id')
        .leftJoinAndMapOne(
          'n.collection',
          Collection,
          'c',
          'n.collectionId = c.id',
        )
        .getOne(),
      Activity.findOne({
        where: {
          txHash,
          logIndex: logIndex - 1,
        },
      }),
    ]);

    if (!nft) {
      throw new UnprocessableEntityException(
        `Nft does not exist for tokenId: ${tokenId}`,
      );
    }
    if (!activity) {
      throw new UnprocessableEntityException(`Transfer activity missing`);
    }

    const erc20Address = offer.erc20Address || offer[offer.length - 4];
    const amount = offer.amount || offer[offer.length - 3];

    await this._updateOfferActivity(
      nft,
      activity,
      erc20Address,
      amount,
      buyer,
      seller,
      activity.txHash,
      buying ? 'buy' : 'accept',
    );
    this.logger.log(`handleOffer Success: ${tokenAddress}: ${tokenId}`);
  }

  async handlePriceRemoval(tokenId: string, txHash: string) {
    this.logger.log(`handlePriceRemoval: ${tokenId}`);

    const nft = await Nft.findOne({
      where: {
        tokenId,
        tokenAddress: process.env.MEDIA_CONTRACT.toLowerCase(),
      },
      relations: ['owner'],
    });

    if (!nft) {
      throw new UnprocessableEntityException('The nft does not exist');
    }
    const ask = await Ask.findOneBy(nft.tokenIdentity);

    if (ask && Object.keys(ask.typedData).length > 0) {
      this.logger.log(`handlePriceRemoval Success: ${tokenId}`);
      return;
    }
    nft.currentAskId = null;
    nft.onSale = false;
    await Ask.delete(nft.tokenIdentity);
    await nft.save();

    const activity = new Activity();
    activity.createdAt = Date.now().toString();
    activity.event = ACTIVITY_EVENTS.SALES.PRICE_REMOVE;
    activity.userAddress = nft.owner.pubKey;
    activity.tokenAddress = nft.tokenAddress;
    activity.tokenId = tokenId;
    activity.collectionId = nft.collectionId;
    activity.txHash = txHash;
    await activity.save();

    const collection = await Collection.findOneBy({ id: nft.collectionId });

    await collection.calculateFloorPrice();

    this.logger.log(`handlePriceRemoval Success: ${tokenId}`);
  }

  async handleBulkPriceSet(tokenIds: string[]) {
    this.logger.log(`handleBulkPriceSet: ${tokenIds.join(', ')}`);

    const web3 = new Web3(
      new Web3.providers.HttpProvider(process.env.HTTPS_RPC_URL),
    );
    const contract = new web3.eth.Contract(
      MarketAbi as any,
      process.env.MARKET_CONTRACT,
    );

    let collection: Collection;

    for (const tokenId of tokenIds) {
      const offer = await contract.methods.prices(tokenId).call();

      if (+offer.amount === 0) {
        continue;
      }
      const tokenIdentity = {
        tokenId,
        tokenAddress: process.env.MEDIA_CONTRACT.toLowerCase(),
      };

      const nft = await Nft.findOne({
        where: tokenIdentity,
        relations: ['owner'],
      });

      if (!nft) {
        throw new UnprocessableEntityException(
          `Nft does not exist for ${tokenId}`,
        );
      }

      const currency = await Currency.findOneBy({
        address: offer.erc20Address.toLowerCase(),
      });

      let ask = await Ask.findOneBy(tokenIdentity);

      if (!ask) {
        ask = Ask.create({ ...tokenIdentity });
      }
      ask.currency = offer.erc20Address;
      ask.amount = fromWei(offer.amount, currency.decimals);
      ask.typedData = {};
      ask.owner = nft.owner.pubKey;
      ask.owner = nft.owner.pubKey;
      ask.collectionId = nft.collectionId;

      await ask.save();

      nft.currentAskId = ask.id;

      await nft.save();

      if (!collection) {
        collection = await Collection.findOneBy({ id: nft.collectionId });
      }
    }

    if (collection) {
      await collection.calculateFloorPrice();
    }
    this.logger.log(`handleBulkPriceSet Success: ${tokenIds.join(', ')}`);
  }

  async handleTransfer(
    tokenId: string,
    tokenAddress: string,
    transactionHash: string,
    from: string,
    to: string,
    logIndex: number,
    timestamp: string,
  ) {
    this.logger.log(`handleTransfer: ${tokenAddress}: ${tokenId}`);

    let nft = await Nft.findOneBy({ tokenId, tokenAddress });
    const isZunaNFT =
      tokenAddress.toLowerCase() === process.env.MEDIA_CONTRACT.toLowerCase();

    if (!nft) {
      if (!isZunaNFT || BURN_ADDRESSES.includes(to)) {
        return;
      }
      const tempNft = await TempNft.findOneBy({ tokenId });

      const web3 = new Web3(
        new Web3.providers.HttpProvider(process.env.HTTPS_RPC_URL),
      );
      const contract = new web3.eth.Contract(MediaAbi as any, tokenAddress);

      // nft was minted by bulk mint

      if (tempNft) {
        // first nft transaction after clone
        if (tempNft.name === 'Clone') {
          const tokenInfo = await contract.methods.getTokenInfo(tokenId).call();

          const collectionId = tokenInfo[2];
          const activity = Activity.create({
            txHash: transactionHash,
            logIndex,
            event: ACTIVITY_EVENTS.TRANSFERS,
            userAddress: from,
            receiver: to,
            createdAt: `${+timestamp * 1000}`,
            collectionId: +collectionId,
            tokenId,
            tokenAddress,
          });
          await activity.save();

          this.logger.log(
            `handleTransfer Success: ${tokenAddress}: ${tokenId}`,
          );
          return;
        }
        nft = await tempNft.saveAsNft(true);
      } else {
        const owner = await User.findOrCreate(to);

        const [tokenUri, tokenInfo] = await Promise.all([
          contract.methods.tokenURI(tokenId).call(),
          contract.methods.getTokenInfo(tokenId).call(),
        ]);
        const royalties = tokenInfo[1];
        const collectionId = tokenInfo[2];

        // not revealed yet
        if (!tokenUri) {
          const temp = TempNft.create({
            name: 'Clone',
            description: 'Clone',
            tokenId,
            royaltyFee: 0,
            properties: [],
            userId: owner.id,
          });
          await temp.save();

          const activity = Activity.create({
            txHash: transactionHash,
            logIndex,
            event: ACTIVITY_EVENTS.MINT,
            userAddress: to,
            createdAt: `${+timestamp * 1000}`,
            collectionId: +collectionId,
            tokenId,
            tokenAddress,
          });
          await activity.save();

          this.logger.log(
            `handleTransfer Success: ${tokenAddress}: ${tokenId}`,
          );
          return;
        } else {
          const url = tokenUri.replace('ipfs://', process.env.PINATA_GATE_WAY);
          const { data: metadata } = await axios.get(url);
          const { name, description, category, image, properties } = metadata;

          nft = Nft.create({
            name,
            description,
            category,
            image,
            properties,
            tokenUri,
            minted: true,
            owner,
            creator: owner,
            onSale: true,
            tokenId,
            tokenAddress,
            collectionId: +collectionId,
            royaltyFee: +royalties,
            mintedAt: `${+timestamp * 1000}`,
          });
          await nft.resizeNftImage();
          await nft.save();
        }
      }
      const activity = Activity.create({
        txHash: transactionHash,
        logIndex,
        event: ACTIVITY_EVENTS.MINT,
        userAddress: to,
        createdAt: `${+timestamp * 1000}`,
        collectionId: nft.collectionId,
        ...nft.tokenIdentity,
      });
      await activity.save();

      nft.collection = await Collection.findOneBy({ id: nft.collectionId });

      if (nft.collection) {
        await nft.collection.calculateMetrics();
        await nft.updateCollectionProperty();
      }

      this.logger.log(`handleTransfer Success: ${tokenAddress}: ${tokenId}`);
      return;
    }

    if (BURN_ADDRESSES.includes(to)) {
      await nft.burn();
      this.logger.log(`handleTransfer Success: ${tokenAddress}: ${tokenId}`);
      return;
    }

    const fromUser = BURN_ADDRESSES.includes(from)
      ? null
      : await User.findOrCreate(from);
    const toUser = await User.findOrCreate(to);

    if (!nft.minted) {
      nft.minted = true;
    }
    nft.owner = toUser;
    nft.currentAskId = null;
    nft.highestBidId = null;

    await Ask.delete(nft.tokenIdentity);

    if (fromUser) {
      const activity = Activity.create({
        txHash: transactionHash,
        logIndex,
        event: ACTIVITY_EVENTS.TRANSFERS,
        userAddress: from,
        receiver: to,
        createdAt: `${+timestamp * 1000}`,
        ...nft.tokenIdentity,
      });

      if (nft.collectionId) {
        activity.collectionId = nft.collectionId;
      }

      await Promise.all([
        Bid.delete({ bidder: toUser.pubKey, ...nft.tokenIdentity }),
        activity.save(),
      ]);
    }
    await nft.save();
    await Showcase.delete({ nftId: nft.id });

    if (nft.collectionId) {
      await this.calculateCollection(nft.collectionId);
    }

    this.logger.log(`handleTransfer Success: ${tokenAddress}: ${tokenId}`);
  }

  async calculateCollection(collectionId: number) {
    const collection = await Collection.findOneBy({ id: collectionId });

    if (!collection) {
      throw new Error(`Collection ${collectionId} does not exist`);
    }
    await collection.calculateMetrics();
    await collection.calculateFloorPrice();
  }
}
