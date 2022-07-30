import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('UserBuyHistory')
export class UserBuyHistory extends PrimaryEntity {
  @Column()
  @Index({ unique: true })
  userId: number;

  @Column({ type: 'real' })
  buyVolume: number;

  @Column({ type: 'real' })
  sellVolume: number;
}
