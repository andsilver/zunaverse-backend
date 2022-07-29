import { Entity, Column, Index, OneToMany, ILike } from 'typeorm';
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

  @Column({ nullable: true })
  nonce: number;

  @OneToMany(() => Collection, (collection) => collection.owner)
  collections: Collection[];

  @Column({ type: 'boolean', default: false })
  verified = false;

  @Column({ type: 'boolean', default: false })
  featured = false;

  followers = 0;
  followings = 0;
  following = false;
  reported = false;

  static findByPubKey(pubKey: string) {
    if (!pubKey) {
      return null;
    }
    return User.findOne({ where: { pubKey: ILike(pubKey) } });
  }

  static async findOrCreate(pubKey: string) {
    if (!pubKey) {
      return null;
    }
    let user = await this.findByPubKey(pubKey);

    if (user) {
      return user;
    }
    user = new User();
    user.pubKey = pubKey.toLowerCase();
    await user.save();
    return user;
  }
}
