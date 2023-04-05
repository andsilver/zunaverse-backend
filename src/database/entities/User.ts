import { BadRequestException } from '@nestjs/common';
import { BURN_ADDRESSES } from 'src/consts';
import {
  Entity,
  Column,
  Index,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import Web3 from 'web3';
import { Collection } from './Collection';
import { PrimaryEntity } from './primary-entity';

@Entity('Users')
export class User extends PrimaryEntity {
  @Column({
    nullable: true,
  })
  name: string;

  @Column({
    nullable: true,
  })
  avatar: string;

  @Column({
    nullable: true,
  })
  thumbnail: string;

  @Column({
    nullable: true,
  })
  banner: string;

  @Column({
    nullable: true,
  })
  twitter: string;

  @Column({
    nullable: true,
  })
  instagram: string;

  @Column({
    nullable: true,
  })
  bio: string;

  @Column({
    unique: true,
  })
  @Index()
  pubKey: string;

  @Column({ nullable: true, select: false })
  nonce: string;

  @OneToMany(() => Collection, (collection) => collection.owner)
  collections: Collection[];

  @Column({ type: 'boolean', default: false })
  verified = false;

  @Column({ type: 'boolean', default: false })
  featured = false;

  @Column({ type: 'boolean', default: false })
  admin = false;

  @BeforeInsert()
  @BeforeUpdate()
  validatePubkey() {
    if (Web3.utils.isAddress(this.pubKey)) {
      return;
    }
    throw new Error('The user pub key is not a blockchain address');
  }

  followers = 0;
  followings = 0;
  following = false;
  reported = false;
  createdItems = 0;
  collectedItems = 0;
  onSaleItems = 0;
  likedItems = 0;

  static findByPubKey(pubKey: string) {
    if (!pubKey) {
      return null;
    }
    return User.findOneBy({ pubKey: pubKey.toLowerCase() });
  }

  static async findOrCreate(pubKey: string) {
    if (!pubKey) {
      return null;
    }
    pubKey = pubKey.toLowerCase();

    let user = await User.findByPubKey(pubKey);

    if (user) {
      return user;
    }

    if (BURN_ADDRESSES.includes(pubKey)) {
      throw new BadRequestException('Cannot create dead user');
    }
    user = User.create({
      pubKey,
    });
    await user.save();
    return user;
  }
}
