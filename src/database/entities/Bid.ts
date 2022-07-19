import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Bids')
export class Bid extends PrimaryEntity {
  @Column()
  nftId: number;

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
}
