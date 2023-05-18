import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';
import { Nft } from './Nft';

@Entity('Bids')
@Index(['tokenId', 'tokenAddress'])
export class Bid extends PrimaryEntity {
  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column()
  currency: string;

  @Column()
  amount: string;

  @Column()
  bidder: string;

  @Column({ type: 'json' })
  typedData: any;

  @Column({ default: 0 })
  collectionId: number;

  nft?: Nft;
}
