import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { Collection } from './Collection';
import { PrimaryEntity } from './primary-entity';
import { User } from './User';

@Entity('Nfts')
export class Nft extends PrimaryEntity {
  @Column()
  @Index({ unique: true })
  tokenId: string;

  @Column()
  tokenUri: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'json' })
  properties: any[];

  @Column()
  royaltyFee: number;

  @Column()
  image: string;

  @ManyToOne(() => User)
  owner: User;

  @Column()
  ownerId: number;

  @ManyToOne(() => User)
  creator: User;

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
  mintedAt: number;

  @Column({ nullable: true })
  txHash: string;

  favorited: boolean;
  favorites: number;
  collection: Collection;
}
