import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Favorites')
@Index(['tokenId', 'tokenAddress', 'userAddress'], { unique: true })
@Index(['tokenId', 'tokenAddress'])
export class Favorite extends PrimaryEntity {
  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column()
  userAddress: string;
}
