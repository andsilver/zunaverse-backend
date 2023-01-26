import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IsNull } from 'typeorm';
import Web3 from 'web3';
import { Activity } from './database/entities/Activity';
import { Ask } from './database/entities/Ask';
import { Bid } from './database/entities/Bid';

import { Collection } from './database/entities/Collection';
import { Currency } from './database/entities/Currency';
import { Favorite } from './database/entities/Favorite';
import { Nft } from './database/entities/Nft';
import { Notification } from './database/entities/Notification';
import { Reward } from './database/entities/Reward';
import { RewardDetail } from './database/entities/RewardDetail';
import { ShortLink } from './database/entities/ShortLink';
import { Transaction } from './database/entities/Transaction';
import { User } from './database/entities/User';
import { CloudinaryService } from './shared/services/cloudinary.service';
import { fetchCoins } from './shared/utils/coingecko';
import { currencyAddressToSymbol } from './shared/utils/currency';

@Injectable()
export class FixService {
  constructor(private cloudinary: CloudinaryService) {}

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
    // await this.addCoins();
    // await this.burn();
    await this.collectionShortLinks();
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
