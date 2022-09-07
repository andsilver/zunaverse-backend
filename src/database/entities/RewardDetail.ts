import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('RewardDetails')
export class RewardDetail extends PrimaryEntity {
  @Column()
  nftId: number;

  @Column()
  userPubKey: string;

  @Column()
  rewardId: number;

  @Column()
  rewardTier: number;

  @Column()
  rewardType: 'static' | 'buyback';

  @Column()
  txHash: string;
}
