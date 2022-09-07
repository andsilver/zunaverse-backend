import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Rewards')
export class Reward extends PrimaryEntity {
  @Column()
  rewardType: 'static' | 'buyback';

  @Column({ type: 'json' })
  tier1Holders: string[];

  @Column({ type: 'json' })
  tier2Holders: string[];

  @Column({ type: 'json' })
  tier3Holders: string[];

  @Column({ type: 'json' })
  tier4Holders: string[];

  @Column({ type: 'json' })
  tier5Holders: string[];

  @Column({ type: 'json' })
  tier6Holders: string[];

  @Column({ nullable: true })
  totalAmount: string;

  @Column({ type: 'json', nullable: true })
  transactionIds: string[];

  @Column()
  txHash: string;
}
