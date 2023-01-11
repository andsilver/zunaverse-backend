import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Favorites')
@Index(['nftId', 'userAddress'], { unique: true })
export class Favorite extends PrimaryEntity {
  @Column({ nullable: true })
  nftId: number;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column()
  userAddress: string;
}
