import { BeforeInsert, Column, Entity, Index, ManyToOne } from 'typeorm';
import fs from 'fs';
import { Logger } from '@nestjs/common';
import Moralis from 'moralis';
import axios from 'axios';

import { Activity } from './Activity';
import { Ask } from './Ask';
import { Bid } from './Bid';
import { Collection } from './Collection';
import { Favorite } from './Favorite';
import { Notification } from './Notification';
import { PrimaryEntity } from './primary-entity';
import { User } from './User';
import { downloadFile } from 'src/shared/utils/download-file';
import { uploadNftImageCloudinary } from 'src/shared/utils/cloudinary';
import { addNftAddressToStream, getChainId } from 'src/shared/utils/moralis';
import { convertIpfsIntoReadable } from 'src/shared/utils/helper';
import { pinata } from 'src/shared/utils/pinata';
import { NftCategory } from 'src/shared/types';
import { Currency } from './Currency';
import { ShortLink } from './ShortLink';

@Entity('Nfts')
@Index(['tokenId', 'tokenAddress'])
export class Nft extends PrimaryEntity {
  @Column()
  tokenId: string;

  @Column({ default: process.env.MEDIA_CONTRACT.toLowerCase() })
  tokenAddress: string;

  @Column({ nullable: true })
  tokenUri?: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: NftCategory;

  @Column({ type: 'json' })
  properties: any[];

  @Column()
  royaltyFee: number;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ nullable: true })
  image: string;

  @ManyToOne(() => User)
  owner: User;

  @Column()
  ownerId: number;

  @ManyToOne(() => User)
  creator: User;

  @Column({ nullable: true })
  creatorId: number;

  @Column({ nullable: true })
  collectionId: number;

  @Column({ nullable: true })
  currentAskId: number;

  @Column({ nullable: true })
  signature: string;

  @Column()
  onSale: boolean;

  @Column()
  minted: boolean;

  @Column({ nullable: true })
  mintedAt: string;

  @Column({ nullable: true, default: 0 })
  rewardsMonths: number;

  @Column({ nullable: true })
  highestBidId: number;

  favorited: boolean;
  favorites: number;
  collection: Collection;
  currentAsk: Ask;

  async burn() {
    await Promise.all([
      Bid.delete(this.tokenIdentity),
      Activity.delete(this.tokenIdentity),
      Ask.delete(this.tokenIdentity),
      Favorite.delete(this.tokenIdentity),
      Notification.delete(this.tokenIdentity),
    ]);

    if (this.collectionId) {
      const collection = await Collection.findOneBy({
        id: this.collectionId,
      });
      await collection.calculateMetrics();
      await collection.calculateFloorPrice();

      this.collection = collection;
      await this.updateCollectionProperty();
    }
    await this.remove();

    if (this.isZunaNft) {
      await Promise.all([
        pinata.unpin(this.image.replace('ipfs://', '')),
        pinata.unpin(this.tokenUri.replace('ipfs://', '')),
      ]);
    }
  }

  get tokenIdentity() {
    return {
      tokenId: this.tokenId,
      tokenAddress: this.tokenAddress,
    };
  }

  async updateCollectionProperty(save = true) {
    if (!this.collectionId) {
      return;
    }
    const collection =
      this.collection ||
      (await Collection.findOneBy({ id: this.collectionId }));

    let collectionUpdated = false;

    for (const property of this.properties) {
      if (collection.properties[property.name]) {
        if (collection.properties[property.name].includes(property.value)) {
          continue;
        }
      } else {
        collection.properties[property.name] = [];
      }
      collection.properties[property.name].push(property.value);
      collectionUpdated = true;
    }

    if (save && collectionUpdated) {
      await collection.save();
    }
  }

  fixIpfsUrl() {
    if (this.image) {
      return convertIpfsIntoReadable(this.image, this.tokenAddress);
    } else {
      return '';
    }
  }

  async resizeNftImage(save?: boolean) {
    Logger.log(`Processing NFT image: ${this.name}`);
    const imageUrl = this.fixIpfsUrl();

    if (!imageUrl) {
      return;
    }
    const downloadPath = `${process.env.UPLOAD_FOLDER}/${this.tokenAddress}_${this.tokenId}`;
    Logger.log(`Nft image downloading: ${imageUrl}`);

    try {
      await new Promise(async (resolve, reject) => {
        setTimeout(() => reject('Timeout'), 20000);
        const res = await downloadFile(imageUrl, downloadPath);
        resolve(res);
      });
      Logger.log(`Nft image downloaded: ${this.name}`);
      // const file = fs.statSync(filename);

      // if (file.size > 20971520) {
      //   const outputpath = `${process.env.UPLOAD_FOLDER}/${this.tokenAddress}_${this.tokenId}_resized`;
      //   await sharp(filename).resize(600, null).toFile(outputpath);
      //   fs.unlinkSync(filename);
      //   downloadPath = outputpath;
      //   Logger.log(`Nft image resized: ${this.name}`);
      // }
      const { secure_url } = await uploadNftImageCloudinary(downloadPath);
      fs.unlinkSync(downloadPath);
      this.thumbnail = secure_url;
    } catch (err) {
      Logger.error(err);
      this.thumbnail = imageUrl;
    }

    if (save) {
      await this.save();
    }
    Logger.log(`Finished processing NFT image: ${this.name}`);
  }

  static noramlizeMoralisNft(nft) {
    if (!nft) {
      return null;
    }

    const result = Nft.create({
      tokenId: nft.token_id,
      tokenAddress: nft.token_address.toLowerCase(),
      description: nft.normalized_metadata.description,
      name: nft.normalized_metadata.name || nft.name,
      image: nft.normalized_metadata.image,
      thumbnail:
        nft.normalized_metadata.animation_url || nft.normalized_metadata.image,
      minted: true,
      owner: User.create({
        pubKey: nft.owner_of,
      }),
      creator: User.create({
        pubKey: nft.minter_address,
      }),
      tokenUri: nft.token_uri,
      properties: [],
      royaltyFee: 0,
      onSale: false,
    });
    if (result.thumbnail && result.thumbnail.includes('ipfs://')) {
      result.thumbnail = result.thumbnail.replace(
        'ipfs://',
        'https://ipfs.io/ipfs/',
      );
    }
    return result;
  }

  static async getNftFromMoralis(tokenAddress: string, tokenId: string) {
    try {
      const response = await Moralis.EvmApi.nft.getNFTMetadata({
        address: tokenAddress,
        chain: getChainId(),
        tokenId,
        normalizeMetadata: true,
      });

      if (!response) {
        return null;
      }
      const nft = response.toJSON();

      let metadata = nft.normalized_metadata;

      if (!metadata || !metadata.name) {
        if (nft.token_uri) {
          try {
            metadata = (await axios.get(nft.token_uri)).data;
            nft.normalized_metadata = metadata;
          } catch (err) {
            Logger.error(`Token URI Error: ${tokenAddress}: ${tokenId}`);
          }
        }
      }

      return Nft.noramlizeMoralisNft(nft);
    } catch (err) {
      console.error(
        `Failed to get moralis nft: ${tokenAddress} - ${tokenId}`,
        err,
      );
      return null;
    }
  }

  static async createFromMoralis(
    tokenAddress: string,
    tokenId: string,
  ): Promise<Nft> {
    const nft = await Nft.getNftFromMoralis(tokenAddress, tokenId);

    if (!nft) {
      return null;
    }
    const [owner, creator] = await Promise.all([
      User.findOrCreate(nft.owner.pubKey),
      User.findOrCreate(nft.creator.pubKey),
    ]);
    await nft.resizeNftImage();
    nft.owner = owner;
    nft.creator = creator;
    nft.ownerId = owner.id;

    return await nft.save();
  }

  async setHighestBidId() {
    const bid = await Bid.createQueryBuilder('b')
      .where(
        'b.tokenAddress = :tokenAddress AND b.tokenId = :tokenId',
        this.tokenIdentity,
      )
      .innerJoin(Currency, 'c', 'c.address = b.currency')
      .addSelect('COALESCE(c.usd * CAST(b.amount AS DECIMAL), 0)', 'price')
      .orderBy('price', 'DESC')
      .getOne();

    this.highestBidId = bid ? bid.id : null;

    await this.save();
  }

  @BeforeInsert()
  async beforeInsert() {
    this.fixTokenId();
    await this.addTokenAddressToStream();
    await this.saveShortLink();
  }

  fixTokenId() {
    if (this.tokenAddress !== process.env.MEDIA_CONTRACT.toLowerCase()) {
      return;
    }
    let endZero = 0;

    while (this.tokenId[endZero] === '0') {
      endZero += 1;
    }

    if (endZero !== 0) {
      this.tokenId = this.tokenId.slice(endZero);
    }
  }

  async addTokenAddressToStream() {
    if (this.isZunaNft) {
      return;
    }
    await addNftAddressToStream(this.tokenAddress);
  }

  async saveShortLink() {
    const shortLink = ShortLink.create({
      ...this.tokenIdentity,
    });
    await shortLink.saveWithId(this.name);
  }

  get isZunaNft() {
    return (
      this.tokenAddress.toLowerCase() ===
      process.env.MEDIA_CONTRACT.toLowerCase()
    );
  }
}
