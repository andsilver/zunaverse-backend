import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('UserBuyHistory')
export class UserBuyHistory extends PrimaryEntity {
  @Column()
  @Index({ unique: true })
  userId: number;

  @Column()
  buyVolume: number;

  @Column()
  sellVolume: number;
}
