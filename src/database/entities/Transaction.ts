import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Transactions')
export class Transaction extends PrimaryEntity {
  @Column()
  amount: number;

  @Column()
  currency: string;

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
