import { EvmChain } from '@moralisweb3/common-evm-utils';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Moralis from 'moralis';
import { IsNull } from 'typeorm';
import Web3 from 'web3';
import { ACTIVITY_EVENTS, BURN_ADDRESSES } from './consts';
import { Activity } from './database/entities/Activity';
import { Ask } from './database/entities/Ask';
import { Bid } from './database/entities/Bid';

import { Collection } from './database/entities/Collection';
import { Currency } from './database/entities/Currency';
import { Favorite } from './database/entities/Favorite';
import { Nft } from './database/entities/Nft';
import { Notification } from './database/entities/Notification';
import { ShortLink } from './database/entities/ShortLink';
import { Transaction } from './database/entities/Transaction';
import { User } from './database/entities/User';
import { CloudinaryService } from './shared/services/cloudinary.service';
import { StreamService } from './stream/stream.service';

@Injectable()
export class FixService {
  constructor(
    private cloudinary: CloudinaryService,
    private stream: StreamService,
  ) {}

  async addCollectionProperties() {
    await Collection.update(
      {},
      {
        properties: {},
      },
    );
    const nfts = await Nft.find({});

    for (const nft of nfts) {
      nft.properties = nft.properties.map((p) => {
        return {
          name: (p.name.charAt(0).toUpperCase() + p.name.slice(1)).trim(),
          value: (p.value as string).trim(),
        };
      });
      await nft.save();
      await nft.updateCollectionProperty();
    }
  }

  async fix() {
    await this.fixTokenId();
  }

  async fixNftOwners() {
    // await this.addCoins();
    // await this.burn();
    // await this.collectionShortLinks();
    const chain =
      process.env.NODE_ENV === 'production'
        ? EvmChain.BSC
        : EvmChain.BSC_TESTNET;

    const nfts = await Nft.find({ relations: ['owner'] });

    for (const nft of nfts) {
      const tokenId = nft.tokenId;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await Moralis.EvmApi.nft.getNFTTokenIdOwners({
        tokenId,
        address: nft.tokenAddress,
        chain,
      });
      const {
        result: [res],
      } = result.toJSON();

      if (nft.minted && !res) {
        console.log('Burned NFT:\n', nft);
        continue;
      }

      if (!res) {
        if (!nft.minted) {
          continue;
        }
        console.log('No Owner: \n', nft);
        continue;
      }

      const realOwnerPubKey = res.owner_of;

      if (realOwnerPubKey !== nft.owner.pubKey) {
        console.log(nft);

        const realOwner = await User.findOrCreate(realOwnerPubKey);

        if (BURN_ADDRESSES.includes(realOwnerPubKey)) {
          await nft.burn();
          continue;
        }

        let cursor = '';

        while (1) {
          const r = await Moralis.EvmApi.nft.getNFTTransfers({
            address: nft.tokenAddress,
            tokenId: nft.tokenId,
            chain,
            limit: 100,
            cursor,
          });

          const res = r.toJSON();

          if (res.cursor) {
            cursor = res.cursor;
            continue;
          }
          const lastTx = res.result.pop();

          nft.owner = realOwner;
          nft.minted = true;
          nft.currentAskId = null;

          await nft.save();

          await Ask.delete(nft.tokenIdentity);
          await Bid.delete({ bidder: realOwner.pubKey, ...nft.tokenIdentity });
          await Activity.create({
            txHash: lastTx.transaction_hash,
            logIndex: lastTx.log_index,
            event: ACTIVITY_EVENTS.TRANSFERS,
            userAddress: lastTx.from_address.toLowerCase(),
            receiver: lastTx.to_address.toLowerCase(),
            createdAt: `${+lastTx.block_timestamp * 1000}`,
            ...nft.tokenIdentity,
          }).save();

          break;
        }
      }
    }
  }

  async fixTokenId() {
    // const nfts = await Nft.find({ relations: ['owner'] });

    // for (const nft of nfts) {
    //   if (!nft.tokenId.includes('0x')) {
    //     continue;
    //   }
    //   const tokenId = Web3.utils.hexToNumberString(nft.tokenId);
    //   nft.tokenId = tokenId;
    //   await nft.save();
    // }
    const activities = await Activity.find({});

    for (const n of activities) {
      if (!n.tokenId || !n.tokenId.includes('0x')) {
        continue;
      }
      const tokenId = Web3.utils.hexToNumberString(n.tokenId);
      n.tokenId = tokenId;
      await n.save();
    }

    const bids = await Bid.find({});

    for (const n of bids) {
      if (!n.tokenId || !n.tokenId.includes('0x')) {
        continue;
      }
      const tokenId = Web3.utils.hexToNumberString(n.tokenId);
      n.tokenId = tokenId;
      await n.save();
    }

    const asks = await Ask.find({});

    for (const n of asks) {
      if (!n.tokenId || !n.tokenId.includes('0x')) {
        continue;
      }
      const tokenId = Web3.utils.hexToNumberString(n.tokenId);
      n.tokenId = tokenId;
      await n.save();
    }

    const ffs = await Favorite.find({});

    for (const n of ffs) {
      if (!n.tokenId || !n.tokenId.includes('0x')) {
        continue;
      }
      const tokenId = Web3.utils.hexToNumberString(n.tokenId);
      n.tokenId = tokenId;
      await n.save();
    }

    const links = await ShortLink.find({});

    for (const n of links) {
      if (!n.tokenId || !n.tokenId.includes('0x')) {
        continue;
      }
      const tokenId = Web3.utils.hexToNumberString(n.tokenId);
      n.tokenId = tokenId;
      await n.save();
    }

    const ts = await Transaction.find({});

    for (const n of ts) {
      if (!n.tokenId || !n.tokenId.includes('0x')) {
        continue;
      }
      const tokenId = Web3.utils.hexToNumberString(n.tokenId);
      n.tokenId = tokenId;
      await n.save();
    }
  }

  async collectionShortLinks() {
    await ShortLink.delete({});
    const collections = await Collection.find({});

    for (const c of collections) {
      const s = new ShortLink();
      s.id = randomUUID();
      s.collectionId = c.id;
      await s.save();
    }
  }

  async burn() {
    let nfts = await Nft.findBy({
      collectionId: 1,
      txHash: IsNull(),
      minted: false,
      owner: {
        pubKey: '0x2818bfb42c39fe0643265dee392ea7f17221c75e',
      },
    });
    const collection = await Collection.findOneBy({
      id: 1,
    });
    nfts = nfts.filter(
      (n) =>
        ![
          195, 165, 179, 162, 127, 124, 229, 178, 165, 244, 117, 122, 147, 151,
          182, 201, 231, 236, 229, 272, 273, 297, 306, 386, 394,
        ].includes(n.id),
    );

    console.log(nfts.length, nfts.filter((n) => n.txHash === null).length);

    for (const nft of nfts) {
      await Bid.delete(nft.tokenIdentity);
      await Activity.delete(nft.tokenIdentity);
      await Ask.delete(nft.tokenIdentity);
      await Favorite.delete(nft.tokenIdentity);
      await Notification.delete(nft.tokenIdentity);
      await nft.remove();
    }
    await collection.calculateMetrics();
    await collection.calculateFloorPrice();
  }

  async fixNftTransfers() {
    const fromBlock = 25449520;

    const chain =
      process.env.NODE_ENV === 'production'
        ? EvmChain.BSC
        : EvmChain.BSC_TESTNET;

    const res = await Moralis.EvmApi.nft.getNFTContractTransfers({
      address: process.env.MEDIA_CONTRACT,
      chain,
      fromBlock,
    });

    const txs = res.toJSON();

    for (const tx of txs.result) {
      await this.stream.handleTransfer(
        tx.token_id,
        tx.token_address,
        tx.transaction_hash,
        tx.from_address,
        tx.to_address,
        +tx.log_index,
        tx.block_timestamp,
      );
    }
  }

  async fixBulkPriceSet() {
    const fromBlock = 26949686;

    const chain =
      process.env.NODE_ENV === 'production'
        ? EvmChain.BSC
        : EvmChain.BSC_TESTNET;

    const res = await Moralis.EvmApi.events.getContractEvents({
      chain,
      fromBlock,
      address: process.env.MARKET_CONTRACT,
      topic:
        '0x70c2398672297895be58f2db6fb72c1f5395909f266db7bb25e557545cffdccb',
      abi: {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: 'uint256[]',
            name: 'tokenIds',
            type: 'uint256[]',
          },
        ],
        name: 'BulkPriceSet',
        type: 'event',
      },
    });
    const { result } = res.toJSON();
    console.log(result);

    for (const item of result) {
      await this.stream.handleBulkPriceSet((item.data as any).tokenIds);
    }
  }

  async addCoins() {
    await Currency.create({
      name: 'Zuna',
      symbol: 'ZUNA',
      coinId: 'zuna',
      address: process.env.ZUNA_ADDRESS,
      usd: 0,
      decimals: 9,
    }).save();

    await Currency.create({
      name: 'Wrapped BNB',
      symbol: 'WBNB',
      coinId: 'wbnb',
      address: process.env.WBNB_ADDRESS,
      usd: 0,
      decimals: 18,
    }).save();
  }

  async addNftThumbnail() {
    const nfts = await Nft.find({
      where: {
        thumbnail: IsNull(),
      },
    });

    Logger.log(nfts.length);

    const chunkSize = 10;
    for (let i = 0; i < nfts.length; i += chunkSize) {
      const chunk = nfts.slice(i, i + chunkSize);
      // do whatever
      await Promise.all(
        chunk.map(async (nft) => {
          await nft.resizeNftImage();
        }),
      );
      await Nft.save(chunk);
    }

    Logger.log('Finished NFTs');

    const users = await User.find({
      where: {
        thumbnail: IsNull(),
      },
    });

    for (const user of users) {
      const [
        { secure_url: avatarUrl },
        { secure_url: thumbnailUrl },
        { secure_url: bannerUrl },
      ] = await Promise.all([
        user.avatar
          ? this.cloudinary.uploadImageCloudinary(user.avatar, 200)
          : Promise.resolve({ secure_url: null }),
        user.avatar
          ? this.cloudinary.uploadImageCloudinary(user.avatar, 60)
          : Promise.resolve({ secure_url: null }),
        user.banner
          ? this.cloudinary.uploadBannerImageCloudinary(user.banner)
          : Promise.resolve({ secure_url: null }),
        ,
      ]);
      user.avatar = avatarUrl;
      user.thumbnail = thumbnailUrl;
      user.banner = bannerUrl;
      await user.save();
    }

    Logger.log('Finished Users');

    const collections = await Collection.find({});

    for (const collection of collections) {
      const [{ secure_url: imageUrl }, { secure_url: bannerUrl }] =
        await Promise.all([
          collection.image
            ? this.cloudinary.uploadImageCloudinary(collection.image, 200)
            : Promise.resolve({ secure_url: null }),
          collection.banner
            ? this.cloudinary.uploadBannerImageCloudinary(collection.banner)
            : Promise.resolve({ secure_url: null }),
          ,
        ]);
      collection.image = imageUrl;
      collection.banner = bannerUrl;
      await collection.save();
    }
  }
}
