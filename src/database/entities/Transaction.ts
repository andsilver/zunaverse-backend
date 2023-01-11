import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Transactions')
@Index(['tokenId', 'tokenAddress'])
export class Transaction extends PrimaryEntity {
  @Column({ type: 'real', nullable: true })
  amount: number;

  @Column()
  currency: string;

  @Column({ type: 'real', nullable: true })
  usd: number;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column({ nullable: true })
  collectionId: number;

  @Column()
  buyer: string;

  @Column()
  seller: string;

  @Column()
  txHash: string;
}
