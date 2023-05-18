import { Column, Entity, Index } from 'typeorm';
import { unlinkSync } from 'fs';

import { NftCategory } from 'src/shared/types';
import { Nft } from './Nft';
import { PrimaryEntity } from './primary-entity';
import { uploadNftImageCloudinary } from 'src/shared/utils/cloudinary';
import { pinImage, pinMetadata } from 'src/shared/utils/pinata';
import { Collection } from './Collection';

@Entity('TempNfts')
export class TempNft extends PrimaryEntity {
  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: NftCategory, nullable: true })
  category: NftCategory;

  @Column()
  royaltyFee: number;

  @Column({ type: 'json' })
  properties: any;

  @Column({ nullable: true })
  erc20Address: string;

  @Column({ nullable: true })
  amount: string;

  @Column()
  @Index({ unique: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenUri: string;

  @Column({ nullable: true })
  filePath: string;

  @Index()
  @Column({ nullable: true })
  imageIpfsHash: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column()
  userId: number;

  @Column({ nullable: true })
  collectionId: number;

  @Column({ nullable: true })
  requestId: number;

  @Column({ nullable: true })
  signature: string;

  @Column({ nullable: true })
  onSale: boolean;

  static async createTempNft(
    tokenId: string,
    name: string,
    description: string,
    category: NftCategory,
    properties: any,
    royaltyFee: number,
    filePath: string,
    userId: number,
    signature?: string,
    erc20Address?: string,
    amount?: string,
    collectionId?: number,
    requestId?: number,
    onSale?: boolean,
  ) {
    let nft = await TempNft.findOneBy({ tokenId });

    if (nft) {
      return nft;
    }
    const { secure_url: thumbnail } = await uploadNftImageCloudinary(filePath);

    nft = TempNft.create({
      name,
      description,
      category,
      tokenId,
      filePath,
      thumbnail,
      properties,
      royaltyFee,
      userId,
      erc20Address: erc20Address || null,
      amount: amount || null,
      collectionId: collectionId || null,
      requestId: requestId || null,
      signature: signature || null,
      onSale: onSale || false,
    });
    return nft;
  }

  async pin() {
    if (this.tokenUri) {
      return;
    }
    let image = '';

    if (!this.imageIpfsHash) {
      if (!this.filePath) {
        throw new Error(`Cannot pin image for TempNft: ${this.id}`);
      }
      this.imageIpfsHash = await pinImage(this.filePath);
    }
    image = `ipfs://${this.imageIpfsHash}`;

    this.tokenUri = await pinMetadata(
      this.name,
      this.description,
      this.category,
      image,
      this.properties,
    );
    await this.save();
  }

  async saveAsNft(minted = false, removeAfterCreate = false) {
    if (!this.tokenUri) {
      throw new Error('Nft has not been processed yet');
    }
    let collection: Collection;

    if (this.collectionId) {
      collection = await Collection.findOneBy({ id: this.collectionId });
    }

    const nft = Nft.create({
      name: this.name,
      description: this.description,
      properties: this.properties,
      category: this.category,
      tokenId: this.tokenId,
      tokenAddress: process.env.MEDIA_CONTRACT.toLowerCase(),
      tokenUri: this.tokenUri,
      image: `ipfs://${this.imageIpfsHash}`,
      thumbnail: this.thumbnail,
      ownerId: this.userId,
      creatorId: this.userId,
      collectionId: this.collectionId,
      minted,
      royaltyFee: this.royaltyFee,
      onSale: this.onSale,
      signature: this.signature,
      revealDate: collection?.affiliation?.revealDate || null,
    });

    await nft.save();
    unlinkSync(this.filePath);

    if (removeAfterCreate) {
      await this.remove();
    }
    return nft;
  }
}
