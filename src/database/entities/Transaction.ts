import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Transactions')
export class Transaction extends PrimaryEntity {
  @Column({ type: 'real', nullable: true })
  amount: number;

  @Column()
  currency: string;

  @Column({ type: 'real', nullable: true })
  usd: number;

  @Column()
  nftId: number;

  @Column({ nullable: true })
  collectionId: number;

  @Column()
  buyer: string;

  @Column()
  seller: string;

  @Column()
  txHash: string;
}
