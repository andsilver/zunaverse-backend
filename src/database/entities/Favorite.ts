import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Favorites')
@Index(['nftId', 'userAddress'], { unique: true })
export class Favorite extends PrimaryEntity {
  @Column()
  nftId: number;

  @Column()
  userAddress: string;
}
